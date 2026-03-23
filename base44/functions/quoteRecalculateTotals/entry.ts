import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const BLOCKED = new Set(["dj", "client"]);

// Normalize legacy add_on items: {name, price} → {name, qty:1, unit_price:price, line_total:price}
function normalizeAddOn(a) {
  if (a.add_on_id !== undefined || a.unit_price !== undefined) {
    // New format — ensure computed fields
    const qty = Number(a.qty) || 1;
    const unit_price = Number(a.unit_price) || 0;
    return { ...a, qty, unit_price, line_total: qty * unit_price };
  }
  // Legacy: { name, price }
  const price = Number(a.price) || 0;
  return { name: a.name, qty: 1, unit_price: price, line_total: price };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email });
    const role = profiles?.[0]?.custom_role || user.role || "sales_rep";
    if (BLOCKED.has(role)) return Response.json({ error: "Forbidden" }, { status: 403 });

    const { lead_id } = await req.json();
    if (!lead_id) return Response.json({ error: "lead_id required" }, { status: 400 });

    const quotes = await base44.asServiceRole.entities.Quote.filter({ lead_id }, "-created_date", 1);
    const quote = quotes[0];
    if (!quote) return Response.json({ error: "Quote not found" }, { status: 404 });

    const normalizedAddOns = (quote.add_ons || []).map(normalizeAddOn);
    const packagePrice = Number(quote.package_price || quote.base_price) || 0;
    const addOnsTotal = normalizedAddOns.reduce((s, a) => s + (a.line_total || 0), 0);
    const discount = Number(quote.discount_amount) || 0;
    const travel = Number(quote.travel_fee) || 0;
    const tax = Number(quote.tax_amount) || 0;
    const total_fee = Math.max(0, packagePrice + addOnsTotal - discount + travel + tax);

    const updated = await base44.asServiceRole.entities.Quote.update(quote.id, {
      add_ons: normalizedAddOns,
      total_amount: total_fee,
      total_fee,
    });

    return Response.json({ quote: updated, total_fee });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});