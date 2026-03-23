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

    const { lead_id, items } = await req.json();
    if (!lead_id || !Array.isArray(items)) return Response.json({ error: "lead_id and items[] required" }, { status: 400 });

    const svc = base44.asServiceRole;
    const quotes = await svc.entities.Quote.filter({ lead_id }, "-created_date", 1);
    const quote = quotes[0];
    if (!quote) return Response.json({ error: "Quote not found for this lead" }, { status: 404 });

    // Load all referenced add-on prices from catalog (never trust client-side prices)
    const addOnIds = items.map(i => i.add_on_id).filter(Boolean);
    const catalogAddOns = await Promise.all(
      addOnIds.map(id => svc.entities.AddOn.filter({ id }).then(r => r[0]).catch(() => null))
    );
    const catalogMap = {};
    for (const a of catalogAddOns) {
      if (a) catalogMap[a.id] = a;
    }

    const normalizedAddOns = items.map(item => {
      const catalogItem = catalogMap[item.add_on_id];
      if (!catalogItem) return null; // skip unknown add-ons
      const qty = Math.max(1, Number(item.qty) || 1);
      const unit_price = Number(catalogItem.unit_price) || 0;
      return {
        add_on_id: catalogItem.id,
        name: catalogItem.name,
        qty,
        unit_price,
        line_total: qty * unit_price,
      };
    }).filter(Boolean);

    const updated = await svc.entities.Quote.update(quote.id, { add_ons: normalizedAddOns });
    return Response.json({ quote: updated, add_ons: normalizedAddOns });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});