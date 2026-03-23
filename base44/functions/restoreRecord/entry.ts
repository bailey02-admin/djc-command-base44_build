/**
 * Restore soft-deleted Lead or Event. Admin only.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!["admin", "city_manager", "sales_manager"].includes(user.role)) {
      return Response.json({ error: "Forbidden: admin/manager only" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { entity_type, id } = body;

    if (!id || !entity_type) return Response.json({ error: "entity_type and id required" }, { status: 400 });

    let record;
    if (entity_type === "lead") {
      record = await base44.asServiceRole.entities.Lead.update(id, { is_deleted: false });
    } else if (entity_type === "event") {
      record = await base44.asServiceRole.entities.Event.update(id, { is_deleted: false });
    } else {
      return Response.json({ error: "Unsupported entity_type" }, { status: 400 });
    }

    await base44.asServiceRole.entities.Activity.create({
      type: "system",
      subject: `${entity_type} restored from archive`,
      related_type: entity_type,
      related_id: id,
      is_internal: true,
      performed_by: user.email,
    }).catch(() => {});

    return Response.json({ ok: true, record });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});