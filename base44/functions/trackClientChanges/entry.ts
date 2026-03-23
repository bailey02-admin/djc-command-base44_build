/**
 * trackClientChanges — Server-side change tracking for planning/music/timeline.
 *
 * Called by clientPortalSave (and any other client-facing write path) after
 * a client edits planning, music, or timeline records.
 *
 * If event.dj_reviewed_at is set and the change is AFTER that timestamp:
 *   1. Set event.client_changed_after_review = true
 *   2. Write ChangeLog entries
 *   3. Create "re-brief DJ" + "finalizer review" tasks (idempotent via idempotency_key)
 *   4. Write Activity warning
 *
 * Can also be called server-side from MusicTimeline/Planning mutations.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const TRACKED_ENTITIES = new Set(["MusicSelection","TimelineItem","EventPlanning"]);

const ENTITY_CHANGE_CATEGORY = {
  MusicSelection: "music",
  TimelineItem:   "timeline",
  EventPlanning:  "planning",
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { event_id, entity_type, change_description = "", changed_fields = [], changed_by } = body;

    if (!event_id) return Response.json({ error: "event_id required" }, { status: 400 });
    if (entity_type && !TRACKED_ENTITIES.has(entity_type)) {
      return Response.json({ error: `entity_type must be one of: ${[...TRACKED_ENTITIES].join(", ")}` }, { status: 400 });
    }

    const eventRows = await base44.asServiceRole.entities.Event.filter({ id: event_id });
    const event = eventRows[0];
    if (!event || event.is_deleted) return Response.json({ error: "Event not found" }, { status: 404 });

    const performedBy = changed_by || user.email;
    const now = new Date().toISOString();
    const changeCategory = ENTITY_CHANGE_CATEGORY[entity_type] || "general";

    // Write ChangeLog entry
    await base44.asServiceRole.entities.ChangeLog.create({
      related_type:    "event",
      related_id:      event_id,
      related_name:    event.event_name || "",
      field_name:      entity_type || "unknown",
      old_value:       "",
      new_value:       change_description.slice(0, 500),
      changed_by:      performedBy,
      change_category: changeCategory,
      is_critical:     false,
      dj_notified:     false,
    }).catch(() => {});

    // Check if DJ has reviewed this event
    if (!event.dj_reviewed_at) {
      // No review yet — just log, no alert needed
      return Response.json({ ok: true, flagged: false, reason: "dj_reviewed_at not set" });
    }

    const reviewedAt = new Date(event.dj_reviewed_at);
    const changeAt   = new Date(now);

    if (changeAt <= reviewedAt) {
      // Change happened before or at review time — no action
      return Response.json({ ok: true, flagged: false, reason: "change predates dj_reviewed_at" });
    }

    // ── Change is AFTER DJ review — flag it ───────────────────────

    // Only flag if not already flagged (avoid spam)
    if (!event.client_changed_after_review) {
      await base44.asServiceRole.entities.Event.update(event_id, {
        client_changed_after_review: true,
      });
    }

    // Write Activity warning
    await base44.asServiceRole.entities.Activity.create({
      type:          "system",
      subject:       `⚠️ Client changed ${changeCategory} after DJ review`,
      description:   change_description || `${entity_type} modified after dj_reviewed_at (${event.dj_reviewed_at})`,
      related_type:  "event",
      related_id:    event_id,
      related_name:  event.event_name || "",
      is_internal:   true,
      performed_by:  performedBy,
    }).catch(() => {});

    // Create re-brief tasks (idempotent per event per day)
    const todayStr = new Date().toISOString().split("T")[0];
    const djTaskKey    = `client_change_dj_rebrief:${event_id}:${todayStr}`;
    const finTaskKey   = `client_change_finalizer:${event_id}:${todayStr}`;

    const [existingDJ, existingFin] = await Promise.all([
      base44.asServiceRole.entities.Task.filter({ idempotency_key: djTaskKey }, "-created_date", 1),
      base44.asServiceRole.entities.Task.filter({ idempotency_key: finTaskKey }, "-created_date", 1),
    ]);

    const tasksCreated = [];

    if (existingDJ.length === 0) {
      const t = await base44.asServiceRole.entities.Task.create({
        title:            `⚠️ Re-brief DJ — client changed ${changeCategory} after review`,
        description:      `Client updated ${changeCategory} on ${todayStr}. Re-confirm details with ${event.assigned_dj || "assigned DJ"}.`,
        category:         "dj_prep",
        priority:         "urgent",
        status:           "pending",
        related_type:     "event",
        related_id:       event_id,
        related_name:     event.event_name || "",
        due_date:         todayStr,
        idempotency_key:  djTaskKey,
        assigned_to:      event.assigned_dj || user.email,
      });
      tasksCreated.push(t);
    }

    if (existingFin.length === 0) {
      const t = await base44.asServiceRole.entities.Task.create({
        title:            `Finalizer: review client ${changeCategory} changes before event`,
        category:         "finalization",
        priority:         "high",
        status:           "pending",
        related_type:     "event",
        related_id:       event_id,
        related_name:     event.event_name || "",
        due_date:         todayStr,
        idempotency_key:  finTaskKey,
        assigned_to:      event.assigned_finalizer || user.email,
      });
      tasksCreated.push(t);
    }

    return Response.json({ ok: true, flagged: true, tasks_created: tasksCreated.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});