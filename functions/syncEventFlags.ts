/**
 * syncEventFlags — auto-syncs planning_complete, music_complete, timeline_complete
 * and optionally creates a payment schedule on booking.
 *
 * Actions:
 *   sync_flags      — re-evaluate all three flags from child records, update event
 *   create_payment_schedule — auto-create deposit + balance payment records if none exist
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Rules for planning_complete: required planning fields
const PLANNING_REQUIRED = [
  "bride_full_name",
  "groom_full_name",
  "formality_level",
  "dj_freedom_level",
];

// Rules for music_complete: must have at least one special song AND reviewed must/do-not-play
const MUSIC_REQUIRED_CATEGORIES = ["first_dance", "grand_entrance"];
const MUSIC_MINIMUM_TOTAL = 3; // at least 3 songs total

// Rules for timeline_complete: at minimum N items including a grand entrance + last dance
const TIMELINE_MINIMUM_ITEMS = 5;
const TIMELINE_KEY_SEGMENTS = ["grand entrance", "first dance", "dinner"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action, event_id, deposit_amount, balance_amount, deposit_due_date, balance_due_days_before } = body;

    if (!event_id) return Response.json({ error: "event_id required" }, { status: 400 });

    if (action === "sync_flags") {
      // Load child records in parallel
      const [planningArr, music, timeline, eventArr] = await Promise.all([
        base44.asServiceRole.entities.EventPlanning.filter({ event_id }),
        base44.asServiceRole.entities.MusicSelection.filter({ event_id }),
        base44.asServiceRole.entities.TimelineItem.filter({ event_id }),
        base44.asServiceRole.entities.Event.filter({ id: event_id }),
      ]);

      const planning = planningArr[0] || null;
      const event = eventArr[0];
      if (!event) return Response.json({ error: "Event not found" }, { status: 404 });

      // Evaluate planning_complete
      let planning_complete = false;
      if (planning) {
        const filled = PLANNING_REQUIRED.filter(f => planning[f] !== null && planning[f] !== undefined && planning[f] !== "");
        planning_complete = filled.length >= PLANNING_REQUIRED.length - 1; // allow 1 optional miss
      }

      // Evaluate music_complete
      const musicCategories = new Set(music.map(m => m.category));
      const hasRequiredSongs = MUSIC_REQUIRED_CATEGORIES.some(c => musicCategories.has(c));
      const music_complete = music.length >= MUSIC_MINIMUM_TOTAL && hasRequiredSongs;

      // Evaluate timeline_complete
      const itemNames = timeline.map(t => (t.segment_name || "").toLowerCase());
      const hasKeySegments = TIMELINE_KEY_SEGMENTS.filter(seg => itemNames.some(n => n.includes(seg)));
      const timeline_complete = timeline.length >= TIMELINE_MINIMUM_ITEMS && hasKeySegments.length >= 1;

      // Only update if flags changed
      const updates = {};
      if (event.planning_complete !== planning_complete) updates.planning_complete = planning_complete;
      if (event.music_complete !== music_complete) updates.music_complete = music_complete;
      if (event.timeline_complete !== timeline_complete) updates.timeline_complete = timeline_complete;

      if (Object.keys(updates).length > 0) {
        const updated = await base44.asServiceRole.entities.Event.update(event_id, updates);

        // Write ChangeLog entries for each changed flag
        await Promise.all(Object.entries(updates).map(([field, newVal]) =>
          base44.asServiceRole.entities.ChangeLog.create({
            related_type: "event",
            related_id: event_id,
            related_name: event.event_name,
            field_name: field,
            old_value: String(event[field] ?? false),
            new_value: String(newVal),
            changed_by: "system:auto_sync",
            change_category: field.includes("music") ? "music" : field.includes("timeline") ? "timeline" : "planning",
          })
        ));

        return Response.json({ updated: true, changes: updates, event: updated });
      }

      return Response.json({ updated: false, changes: {}, flags: { planning_complete, music_complete, timeline_complete } });
    }

    if (action === "create_payment_schedule") {
      // Check if payments already exist for this event
      const existing = await base44.asServiceRole.entities.Payment.filter({ event_id });
      if (existing.length > 0) {
        return Response.json({ created: false, reason: "Payment records already exist", count: existing.length });
      }

      const eventArr = await base44.asServiceRole.entities.Event.filter({ id: event_id });
      const event = eventArr[0];
      if (!event) return Response.json({ error: "Event not found" }, { status: 404 });

      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const daysBeforeFinal = balance_due_days_before || 14;

      // If no package_price, create $0-placeholder records so staff can fill in manually
      const depAmount = deposit_amount || (event.package_price ? Math.round(event.package_price * 0.5) : 0);
      const balAmount = balance_amount || (event.package_price ? Math.round(event.package_price * 0.5) : 0);

      // Balance due = event_date - N days, but never before today
      let balanceDueDate = todayStr;
      if (event.event_date) {
        const eventDt = new Date(event.event_date + "T00:00:00");
        eventDt.setDate(eventDt.getDate() - daysBeforeFinal);
        // If computed due date is in the past (event < 14d away), due today
        balanceDueDate = eventDt >= today ? eventDt.toISOString().split("T")[0] : todayStr;
      }

      const created = [];

      const dep = await base44.asServiceRole.entities.Payment.create({
        event_id,
        contact_name: event.contact_name || "",
        payment_type: "deposit",
        amount: depAmount,
        due_date: deposit_due_date || todayStr,
        status: "pending",
        notes: depAmount === 0 ? "Price not set — update amount manually" : undefined,
      });
      created.push(dep);

      const bal = await base44.asServiceRole.entities.Payment.create({
        event_id,
        contact_name: event.contact_name || "",
        payment_type: "final_balance",
        amount: balAmount,
        due_date: balanceDueDate,
        status: "pending",
        notes: balAmount === 0 ? "Price not set — update amount manually" : undefined,
      });
      created.push(bal);

      // Log activity
      await base44.asServiceRole.entities.Activity.create({
        type: "system",
        subject: `Payment schedule auto-created (${created.length} records)`,
        description: created.map(p => `${p.payment_type}: $${p.amount} due ${p.due_date}`).join(" | "),
        related_type: "event",
        related_id: event_id,
        related_name: event.event_name,
        is_internal: true,
        performed_by: "system",
      });

      return Response.json({ created: true, payments: created });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});