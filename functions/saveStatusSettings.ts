import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const { action, data } = await req.json();

    if (action === 'upsert_status') {
      const { id, key, label, color, sort_order, is_active } = data;
      if (!key || !label) {
        return Response.json({ error: "key and label required" }, { status: 400 });
      }

      if (id) {
        await base44.asServiceRole.entities.EventStatus.update(id, { key, label, color, sort_order, is_active });
      } else {
        await base44.asServiceRole.entities.EventStatus.create({ key, label, color, sort_order: sort_order || 0, is_active: is_active !== false });
      }
      return Response.json({ ok: true });
    }

    if (action === 'deactivate_status') {
      const { id } = data;
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      await base44.asServiceRole.entities.EventStatus.update(id, { is_active: false });
      return Response.json({ ok: true });
    }

    if (action === 'upsert_group') {
      const { id, key, label, description, statuses, required } = data;
      if (!key || !label || !Array.isArray(statuses)) {
        return Response.json({ error: "key, label, and statuses array required" }, { status: 400 });
      }

      // Validate statuses exist
      const allStatuses = await base44.asServiceRole.entities.EventStatus.list("key", 500);
      const validKeys = new Set(allStatuses.map(s => s.key));
      for (const statusKey of statuses) {
        if (!validKeys.has(statusKey)) {
          return Response.json({ error: `Invalid status key: ${statusKey}` }, { status: 400 });
        }
      }

      // Check required group non-empty
      if (required && statuses.length === 0) {
        return Response.json({ error: "Required group cannot be empty" }, { status: 400 });
      }

      if (id) {
        await base44.asServiceRole.entities.StatusGroup.update(id, { key, label, description, statuses, required });
      } else {
        await base44.asServiceRole.entities.StatusGroup.create({ key, label, description, statuses, required: required || false });
      }
      return Response.json({ ok: true });
    }

    if (action === 'delete_group') {
      const { id } = data;
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      await base44.asServiceRole.entities.StatusGroup.delete(id);
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[saveStatusSettings] error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});