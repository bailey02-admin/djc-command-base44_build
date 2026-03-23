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

    const { lead_id, package_id } = await req.json();
    if (!lead_id) return Response.json({ error: "lead_id required" }, { status: 400 });

    const svc = base44.asServiceRole;
    const quotes = await svc.entities.Quote.filter({ lead_id }, "-created_date", 1);
    const quote = quotes[0];
    if (!quote) return Response.json({ error: "Quote not found for this lead" }, { status: 404 });

    let updateData;
    if (!package_id) {
      // Clear package
      updateData = { package_id: null, package_name: null, package_price: null, base_price: 0 };
    } else {
      const pkgs = await svc.entities.Package.filter({ id: package_id, is_active: true });
      const pkg = pkgs[0];
      if (!pkg) return Response.json({ error: "Package not found or inactive" }, { status: 404 });
      updateData = {
        package_id: pkg.id,
        package_name: pkg.name,
        package_price: pkg.base_price,
        base_price: pkg.base_price,
      };
    }

    const updated = await svc.entities.Quote.update(quote.id, updateData);
    return Response.json({ quote: updated });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});