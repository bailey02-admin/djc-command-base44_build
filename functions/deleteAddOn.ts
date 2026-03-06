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

    const { id } = await req.json();
    if (!id) return Response.json({ error: "id required" }, { status: 400 });

    await base44.asServiceRole.entities.AddOn.update(id, { is_active: false });
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});