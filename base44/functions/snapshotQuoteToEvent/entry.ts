/**
 * PHASE D: Fallback snapshot trigger — applies financial snapshot from Quote → Event.
 * Idempotent: checks if snapshot already exists before applying.
 * Supports new add_ons structure {add_on_id, name, qty, unit_price, line_total}
 * and normalizes legacy {name, price} items safely.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const LEGACY_OFFICIAL_BOOKED = new Set(["booked_pending", "booked"]);

function normalizeAddOn(a) {
  if (a.unit_price !== undefined) {
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

    const body = await req.json().catch(() => ({}));
    const { event_id, lead_id } = body;
    if (!event_id || !lead_id) {
      return Response.json({ error: "event_id and lead_id required" }, { status: 400 });
    }

    const [eventRows, groupRows] = await Promise.all([
      base44.asServiceRole.entities.Event.filter({ id: event_id }),
      base44.asServiceRole.entities.StatusGroup.list("key", 100).catch(() => []),
    ]);

    const event = eventRows[0];
    if (!event || event.is_deleted) {
      return Response.json({ error: "Event not found" }, { status: 404 });
    }

    const officialBookedGroup = groupRows.find(g =>
      g.key === "official_booked" && (g.entity_key === "event" || !g.entity_key)
    );

    let officialBookedStatuses;
    if (officialBookedGroup?.statuses?.length > 0) {
      officialBookedStatuses = new Set(officialBookedGroup.statuses);
    } else {
      officialBookedStatuses = LEGACY_OFFICIAL_BOOKED;
    }

    const isOfficialBooked = officialBookedStatuses.has(event.status);
    if (!isOfficialBooked) {
      return Response.json({ ok: true, skipped: true, reason: `Event status "${event.status}" not in official_booked group` });
    }

    // Idempotency: skip if snapshot already present
    if (event.total_fee && event.total_fee > 0) {
      return Response.json({ ok: true, skipped: true, reason: "Snapshot already present" });
    }

    // Load quote — direct entity access (no nested function call, more reliable)
    let quoteSnapshot = { add_ons: [], discount_amount: 0, discount_reason: "", tax_amount: 0, total_fee: 0 };

    let quotes = [];
    try {
      quotes = await base44.asServiceRole.entities.Quote.filter({ lead_id }, "-created_date", 1);
    } catch (e) {
      console.warn(`[snapshotQuoteToEvent] quote fetch failed for lead ${lead_id}:`, e.message);
      return Response.json({ ok: true, skipped: true, reason: "No quote found" });
    }
    if (quotes.length === 0) {
      return Response.json({ ok: true, skipped: true, reason: "No quote found" });
    }
    const quote = quotes[0];
    const normalizedAddOns = (quote.add_ons || []).map(normalizeAddOn);
    quoteSnapshot = {
      package_id: quote.package_id || null,
      package_name: quote.package_name || null,
      package_price: Number(quote.package_price || quote.base_price) || 0,
      add_ons: normalizedAddOns,
      discount_amount: Number(quote.discount_amount) || 0,
      discount_reason: quote.discount_reason || "",
      tax_amount: Number(quote.tax_amount) || 0,
      travel_fee: Number(quote.travel_fee) || 0,
      total_fee: Number(quote.total_fee || quote.total_amount) || 0,
    };

    await base44.asServiceRole.entities.Event.update(event_id, quoteSnapshot);
    return Response.json({ ok: true, snapshot_applied: true });
  } catch (err) {
    console.error("[snapshotQuoteToEvent] error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});