/**
 * saveStatusSettings — admin-only CRUD for EventStatus and StatusGroup.
 *
 * Enforcement rules:
 *  - Admin only
 *  - EventStatus.key is immutable after creation
 *  - Cannot delete a status used by any Event; only deactivate
 *  - official_booked group must remain non-empty
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const { action, data } = await req.json();

    // ── upsert_status ─────────────────────────────────────────────────────────
    if (action === 'upsert_status') {
      const { id, key, label, color, sort_order, is_active } = data;
      if (!label) {
        return Response.json({ error: "label is required" }, { status: 400 });
      }

      if (id) {
        // UPDATE: key cannot change
        const existing = await base44.asServiceRole.entities.EventStatus.filter({ id });
        if (!existing[0]) return Response.json({ error: "Status not found" }, { status: 404 });
        // Only allow updating label, color, sort_order, is_active — never key
        await base44.asServiceRole.entities.EventStatus.update(id, {
          label,
          color: color || "",
          sort_order: sort_order ?? existing[0].sort_order ?? 0,
          is_active: is_active !== false,
        });
      } else {
        // CREATE: key required and must be unique
        if (!key) return Response.json({ error: "key is required for new statuses" }, { status: 400 });
        const existing = await base44.asServiceRole.entities.EventStatus.list("key", 500);
        if (existing.some(s => s.key === key)) {
          return Response.json({ error: `Status key "${key}" already exists` }, { status: 409 });
        }
        await base44.asServiceRole.entities.EventStatus.create({
          key,
          label,
          color: color || "",
          sort_order: sort_order ?? 0,
          is_active: is_active !== false,
        });
      }
      return Response.json({ ok: true });
    }

    // ── deactivate_status ─────────────────────────────────────────────────────
    if (action === 'deactivate_status') {
      const { id } = data;
      if (!id) return Response.json({ error: "id required" }, { status: 400 });

      const existing = await base44.asServiceRole.entities.EventStatus.filter({ id });
      const status = existing[0];
      if (!status) return Response.json({ error: "Status not found" }, { status: 404 });

      // Check no events currently use this status
      const eventsWithStatus = await base44.asServiceRole.entities.Event.filter({ status: status.key, is_deleted: false });
      if (eventsWithStatus.length > 0) {
        return Response.json({
          error: `Cannot deactivate "${status.label}" — ${eventsWithStatus.length} event(s) currently use this status. Reassign them first.`,
        }, { status: 409 });
      }

      await base44.asServiceRole.entities.EventStatus.update(id, { is_active: false });
      return Response.json({ ok: true });
    }

    // ── upsert_group ──────────────────────────────────────────────────────────
    if (action === 'upsert_group') {
      const { id, key, label, description, statuses, required } = data;
      if (!key || !label || !Array.isArray(statuses)) {
        return Response.json({ error: "key, label, and statuses array required" }, { status: 400 });
      }

      // Validate all status keys exist
      const allStatuses = await base44.asServiceRole.entities.EventStatus.list("key", 500);
      const validKeys = new Set(allStatuses.map(s => s.key));
      for (const statusKey of statuses) {
        if (!validKeys.has(statusKey)) {
          return Response.json({ error: `Invalid status key: "${statusKey}"` }, { status: 400 });
        }
      }

      // official_booked group must never be empty
      if (key === "official_booked" && statuses.length === 0) {
        return Response.json({ error: "The official_booked group cannot be empty — it controls quote snapshot logic." }, { status: 400 });
      }

      // required groups cannot be empty
      if (required && statuses.length === 0) {
        return Response.json({ error: "Required groups cannot be empty" }, { status: 400 });
      }

      if (id) {
        await base44.asServiceRole.entities.StatusGroup.update(id, { key, label, description, statuses, required: required || false });
      } else {
        // Check key uniqueness
        const existingGroups = await base44.asServiceRole.entities.StatusGroup.list("key", 200);
        if (existingGroups.some(g => g.key === key)) {
          return Response.json({ error: `Group key "${key}" already exists` }, { status: 409 });
        }
        await base44.asServiceRole.entities.StatusGroup.create({ key, label, description, statuses, required: required || false });
      }
      return Response.json({ ok: true });
    }

    // ── delete_group ──────────────────────────────────────────────────────────
    if (action === 'delete_group') {
      const { id } = data;
      if (!id) return Response.json({ error: "id required" }, { status: 400 });

      // Do not allow deleting official_booked
      const existing = await base44.asServiceRole.entities.StatusGroup.filter({ id });
      const group = existing[0];
      if (!group) return Response.json({ error: "Group not found" }, { status: 404 });
      if (group.key === "official_booked") {
        return Response.json({ error: "The official_booked group cannot be deleted — it is required for system logic." }, { status: 403 });
      }

      await base44.asServiceRole.entities.StatusGroup.delete(id);
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[saveStatusSettings] error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});