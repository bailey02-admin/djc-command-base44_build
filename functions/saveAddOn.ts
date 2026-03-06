import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const MANAGER_ROLES = new Set(["admin", "finance", "city_manager", "sales_manager"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email });
    const role = profiles?.[0]?.custom_role || user.role;
    if (!MANAGER_ROLES.has(role)) return Response.json({ error: "Forbidden: manager role required" }, { status: 403 });

    const { action, id, data } = await req.json();
    if (!action || !data) return Response.json({ error: "action and data required" }, { status: 400 });
    if (!data.name || data.unit_price == null) return Response.json({ error: "name and unit_price required" }, { status: 400 });

    const svc = base44.asServiceRole;
    let result;
    if (action === "create") {
      result = await svc.entities.AddOn.create(data);
    } else if (action === "update") {
      if (!id) return Response.json({ error: "id required for update" }, { status: 400 });
      result = await svc.entities.AddOn.update(id, data);
    } else {
      return Response.json({ error: "action must be create or update" }, { status: 400 });
    }

    return Response.json({ addOn: result });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});