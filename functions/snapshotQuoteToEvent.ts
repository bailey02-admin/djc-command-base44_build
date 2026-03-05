/**
 * PHASE D: Fallback snapshot trigger — applies only if event is missing financial snapshot fields.
 * Idempotent: checks if snapshot already exists before applying.
 * Fired by mutateEvent when event status ∈ groups["official_booked"].
 *
 * Safe fallback: if StatusGroup settings are missing or official_booked group is not found,
 * falls back to legacy hardcoded defaults so snapshot logic never silently stops.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Legacy fallback: used only if settings are missing
const LEGACY_OFFICIAL_BOOKED = new Set(["booked_pending", "booked", "planning_in_progress", "finalized"]);

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

    // Fetch current event and status groups in parallel
    const [eventRows, groupRows] = await Promise.all([
      base44.asServiceRole.entities.Event.filter({ id: event_id }),
      base44.asServiceRole.entities.StatusGroup.filter({ key: "official_booked" }).catch(() => []),
    ]);

    const event = eventRows[0];
    if (!event || event.is_deleted) {
      return Response.json({ error: "Event not found" }, { status: 404 });
    }

    // Determine which statuses are "official booked"
    // Safe fallback: if group missing, use legacy hardcoded set
    const officialBookedGroup = groupRows[0];
    let officialBookedStatuses;
    if (officialBookedGroup?.statuses?.length > 0) {
      officialBookedStatuses = new Set(officialBookedGroup.statuses);
      console.log(`[snapshotQuoteToEvent] Using configured official_booked group: ${[...officialBookedStatuses].join(", ")}`);
    } else {
      officialBookedStatuses = LEGACY_OFFICIAL_BOOKED;
      console.warn("[snapshotQuoteToEvent] official_booked group missing or empty — falling back to legacy defaults");
    }

    const isOfficialBooked = officialBookedStatuses.has(event.status);
    if (!isOfficialBooked) {
      return Response.json({ ok: true, skipped: true, reason: `Event status "${event.status}" not in official_booked group` });
    }

    // Idempotency: check if snapshot already exists
    const hasSnapshot = event.total_fee && event.total_fee > 0;
    if (hasSnapshot) {
      return Response.json({ ok: true, skipped: true, reason: "Snapshot already present" });
    }

    // Load quote
    let quoteSnapshot = {
      add_ons: [],
      discount_amount: 0,
      discount_reason: "",
      tax_amount: 0,
      total_fee: 0,
    };

    try {
      const quoteRes = await base44.asServiceRole.functions.invoke("getQuotes", { lead_id });
      const quotes = quoteRes.quotes || [];
      if (quotes.length > 0) {
        const quote = quotes[0];
        quoteSnapshot = {
          add_ons: quote.add_ons || [],
          discount_amount: quote.discount_amount || 0,
          discount_reason: quote.discount_reason || "",
          tax_amount: quote.tax_amount || 0,
          total_fee: quote.total_amount || 0,
        };
      }
    } catch (e) {
      console.warn(`[snapshotQuoteToEvent] quote fetch failed for lead ${lead_id}:`, e.message);
      return Response.json({ ok: true, skipped: true, reason: "No quote found" });
    }

    // Apply snapshot
    await base44.asServiceRole.entities.Event.update(event_id, quoteSnapshot);

    return Response.json({ ok: true, snapshot_applied: true });
  } catch (err) {
    console.error("[snapshotQuoteToEvent] error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});