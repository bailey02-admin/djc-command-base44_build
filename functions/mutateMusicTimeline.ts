/**
 * mutateMusicTimeline — Secure write endpoint for MusicSelection and TimelineItem entities.
 * Entity: MusicSelection or TimelineItem (specified in body.entity)
 * Actions: create | delete | bulkCreate
 *
 * Access: admin, city_manager, sales_manager, office_finalizer only.
 * DJs and clients cannot write music/timeline data via this function.
 * (Clients use clientPortalSave for their own songs.)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const ALLOWED = new Set(["admin", "city_manager", "sales_manager", "office_finalizer"]);

async function verifyEventAccess(base44, event_id, role, userCity) {
  if (!event_id) return { ok: false, error: "event_id required" };
  const rows = await base44.asServiceRole.entities.Event.filter({ id: event_id });
  const event = rows[0];
  if (!event || event.is_deleted) return { ok: false, error: "Event not found" };
  if (role === "city_manager" && userCity && event.city !== userCity) {
    return { ok: false, error: "Forbidden: event is outside your city" };
  }
  return { ok: true, event };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = user.role || "sales_rep";
    if (!ALLOWED.has(role)) {
      return Response.json({ error: "Forbidden: your role cannot modify music or timeline items" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { entity, action, event_id, data = {}, id, items = [] } = body;

    if (!["MusicSelection", "TimelineItem"].includes(entity)) {
      return Response.json({ error: "entity must be MusicSelection or TimelineItem" }, { status: 400 });
    }

    const entityRef = base44.asServiceRole.entities[entity];

    if (action === "create") {
      const targetEventId = data.event_id || event_id;
      const { ok, error } = await verifyEventAccess(base44, targetEventId, role, user.city);
      if (!ok) return Response.json({ error }, { status: 403 });
      if (!data.event_id) data.event_id = targetEventId;
      const record = await entityRef.create(data);
      return Response.json({ record });
    }

    if (action === "bulkCreate") {
      if (!items || items.length === 0) return Response.json({ error: "items required" }, { status: 400 });
      const targetEventId = items[0]?.event_id || event_id;
      const { ok, error } = await verifyEventAccess(base44, targetEventId, role, user.city);
      if (!ok) return Response.json({ error }, { status: 403 });
      const created = [];
      for (const item of items) {
        const record = await entityRef.create({ ...item, event_id: targetEventId });
        created.push(record);
      }
      return Response.json({ records: created, count: created.length });
    }

    if (action === "delete") {
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      await entityRef.delete(id);
      return Response.json({ ok: true });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});