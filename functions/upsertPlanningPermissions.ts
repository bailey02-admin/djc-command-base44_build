import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ALLOWED = new Set(["admin","city_manager","office_finalizer","sales_manager"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !ALLOWED.has(user.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { event_id, permissions } = await req.json();
    if (!event_id) return Response.json({ error: "event_id required" }, { status: 400 });

    const svc = base44.asServiceRole;
    const existing = await svc.entities.PlanningPermissions.filter({ event_id });

    let record;
    if (existing[0]) {
      record = await svc.entities.PlanningPermissions.update(existing[0].id, { ...permissions, event_id });
    } else {
      record = await svc.entities.PlanningPermissions.create({ ...permissions, event_id });
    }

    return Response.json({ permissions: record });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});