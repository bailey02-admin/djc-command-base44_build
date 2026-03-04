/**
 * PHASE D: Fallback snapshot trigger — applies only if event is missing financial snapshot fields.
 * Idempotent: checks if snapshot already exists before applying.
 * Fired by mutateEvent when event status→booked.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

    // Fetch current event
    const eventRows = await base44.asServiceRole.entities.Event.filter({ id: event_id });
    const event = eventRows[0];
    if (!event || event.is_deleted) {
      return Response.json({ error: "Event not found" }, { status: 404 });
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
    return Response.json({ error: err.message }, { status: 500 });
  }
});