import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const BLOCKED = new Set(["dj", "client"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email });
    const profile = profiles?.[0];
    const role = profile?.custom_role || user.role || "sales_rep";
    if (BLOCKED.has(role)) return Response.json({ error: "Forbidden" }, { status: 403 });

    const { active_only = false } = await req.json().catch(() => ({}));
    const filter = active_only ? { is_active: true } : {};
    const packages = await base44.asServiceRole.entities.Package.filter(filter, "sort_order", 200);

    return Response.json({ packages });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});