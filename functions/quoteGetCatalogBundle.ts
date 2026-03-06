import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const BLOCKED = new Set(["dj", "client"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email });
    const role = profiles?.[0]?.custom_role || user.role || "sales_rep";
    if (BLOCKED.has(role)) return Response.json({ error: "Forbidden" }, { status: 403 });

    const [packages, addOns] = await Promise.all([
      base44.asServiceRole.entities.Package.filter({ is_active: true }, "sort_order", 200),
      base44.asServiceRole.entities.AddOn.filter({ is_active: true }, "sort_order", 200),
    ]);

    return Response.json({ packages, addOns });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});