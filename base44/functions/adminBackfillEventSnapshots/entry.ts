/**
 * Admin-only: Backfill financial snapshots for events that are missing them.
 * Finds Events with lead_id where total_fee is null/0 OR package_name is null OR add_ons is empty.
 * For each candidate, calls snapshotQuoteToEvent logic inline (idempotent).
 *
 * Input: { date_from?, date_to?, city? }
 * Output: { scanned, updated, skipped, errors[] }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const LEGACY_OFFICIAL_BOOKED = new Set([
  "booked_pending","booked","planning_in_progress","finalized","completed"
]);

function normalizeAddOn(a) {
  if (a.unit_price !== undefined) {
    const qty = Number(a.qty) || 1;
    const unit_price = Number(a.unit_price) || 0;
    return { ...a, qty, unit_price, line_total: qty * unit_price };
  }
  const price = Number(a.price) || 0;
  return { name: a.name, qty: 1, unit_price: price, line_total: price };
}

function needsSnapshot(event) {
  const missingFee = !event.total_fee || Number(event.total_fee) === 0;
  const missingPackage = !event.package_name;
  const missingAddOns = !event.add_ons || !Array.isArray(event.add_ons) || event.add_ons.length === 0;
  return missingFee || missingPackage || missingAddOns;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden: Admin only" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { date_from, date_to, city } = body;

    // Build filter — must have a lead_id, not deleted
    const filterQuery = { is_deleted: false };
    if (city) filterQuery.city = city;

    // Fetch up to 500 events — paginate if needed in the future
    const allEvents = await base44.asServiceRole.entities.Event.list("-event_date", 500);

    // Filter client-side for date range and lead_id presence
    const candidates = allEvents.filter(e => {
      if (e.is_deleted) return false;
      if (!e.lead_id) return false;
      if (city && e.city !== city) return false;
      if (date_from && e.event_date < date_from) return false;
      if (date_to && e.event_date > date_to) return false;
      return needsSnapshot(e);
    });

    const stats = { scanned: candidates.length, updated: 0, skipped: 0, errors: [] };

    for (const event of candidates) {
      try {
        // Fetch quote directly — no nested function call (more reliable)
        let quoteSnapshot = null;
        try {
          const quotes = await base44.asServiceRole.entities.Quote.filter(
            { lead_id: event.lead_id }, "-created_date", 1
          );
          if (quotes.length === 0) {
            stats.skipped++;
            continue;
          }
          const quote = quotes[0];
          const normalizedAddOns = (quote.add_ons || []).map(normalizeAddOn);
          const totalFee = Number(quote.total_fee || quote.total_amount) || 0;
          if (!totalFee && !quote.package_name) {
            stats.skipped++;
            continue;
          }
          quoteSnapshot = {
            package_id: quote.package_id || null,
            package_name: quote.package_name || null,
            package_price: Number(quote.package_price || quote.base_price) || 0,
            add_ons: normalizedAddOns,
            discount_amount: Number(quote.discount_amount) || 0,
            discount_reason: quote.discount_reason || "",
            tax_amount: Number(quote.tax_amount) || 0,
            travel_fee: Number(quote.travel_fee) || 0,
            total_fee: totalFee,
          };
        } catch (qErr) {
          stats.skipped++;
          continue;
        }

        await base44.asServiceRole.entities.Event.update(event.id, quoteSnapshot);
        stats.updated++;
      } catch (err) {
        stats.errors.push({ event_id: event.id, event_name: event.event_name, error: err.message });
      }
    }

    return Response.json({ ok: true, ...stats });
  } catch (err) {
    console.error("[adminBackfillEventSnapshots]", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});