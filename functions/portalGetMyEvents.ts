/**
 * portalGetMyEvents — Returns all events for the authenticated client.
 *
 * Ownership: resolves Contact by user.email, then returns events where
 * event.contact_id === contact.id
 *
 * Returns upcoming + past split, with payment summary per event.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const CLIENT_EVENT_FIELDS = [
  "id", "event_name", "event_type", "event_date", "start_time", "end_time",
  "venue_name", "city", "status", "package_name", "package_price",
  "contact_id", "planning_complete", "timeline_complete", "music_complete",
  "contract_signed", "deposit_paid", "balance_paid", "final_call_completed",
  "planning_lock_at", "planning_submitted_at",
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Resolve Contact by email
    const contactRows = await base44.asServiceRole.entities.Contact.filter({ email: user.email }).catch(() => []);
    const contact = contactRows[0] || null;

    if (!contact) {
      return Response.json({ events: [], upcoming: [], past: [], contact: null });
    }

    // Fetch all non-deleted events for this contact
    const allEvents = await base44.asServiceRole.entities.Event.filter(
      { contact_id: contact.id, is_deleted: false },
      "event_date",
      100
    );

    const today = new Date().toISOString().split("T")[0];

    // Project to safe fields only and compute payment summary
    const safeEvents = await Promise.all(allEvents.map(async (event) => {
      const safe = {};
      for (const f of CLIENT_EVENT_FIELDS) {
        if (event[f] !== undefined) safe[f] = event[f];
      }
      safe.event_id = event.id;

      // Payment summary
      const payments = await base44.asServiceRole.entities.Payment.filter({ event_id: event.id }, "-created_date", 50).catch(() => []);
      const amountPaidTotal = payments
        .filter(p => p.status === "paid")
        .reduce((sum, p) => sum + (p.amount || 0), 0);
      const totalFee = event.total_fee ?? event.package_price ?? 0;
      safe.amount_paid_total = amountPaidTotal;
      safe.remaining_balance = Math.max(0, totalFee - amountPaidTotal);

      return safe;
    }));

    const upcoming = safeEvents.filter(e => e.event_date >= today);
    const past = safeEvents.filter(e => e.event_date < today);

    return Response.json({
      events: safeEvents,
      upcoming,
      past,
      contact: { id: contact.id, first_name: contact.first_name, last_name: contact.last_name },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});