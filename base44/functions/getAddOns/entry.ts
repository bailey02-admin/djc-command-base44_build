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

    const { active_only = false, category } = await req.json().catch(() => ({}));
    const filter = {};
    if (active_only) filter.is_active = true;
    if (category) filter.category = category;

    const addOns = await base44.asServiceRole.entities.AddOn.filter(filter, "sort_order", 200);
    return Response.json({ addOns });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});