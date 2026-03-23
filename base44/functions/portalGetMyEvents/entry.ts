/**
 * portalGetMyEvents — Returns all events for the authenticated client.
 *
 * Ownership: PRIMARY = user.contact_id (stamped at user creation).
 * Fallback: email-based contact lookup (migration path for legacy records).
 *
 * Returns upcoming + past split, with payment summary per event.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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

    // Admin impersonation: allow overriding contact_id
    // Use StaffProfile.custom_role per Truth Doc — never platform role
    const body = await req.json().catch(() => ({}));
    let isPrivileged = user.role === "admin"; // fast path for platform admins
    if (!isPrivileged && body.impersonate_contact_id) {
      const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email }).catch(() => []);
      const profile = profiles?.[0];
      isPrivileged = profile && ["admin", "city_manager", "office_finalizer"].includes(profile.custom_role);
    }
    const overrideContactId = isPrivileged && body.impersonate_contact_id ? body.impersonate_contact_id : null;

    // Resolve contact_id: PRIMARY = user.contact_id, FALLBACK = email lookup
    let contactId = overrideContactId || user.contact_id || null;
    let contactMeta = null;

    if (contactId) {
      const rows = await base44.asServiceRole.entities.Contact.filter({ id: contactId }).catch(() => []);
      if (rows[0]) contactMeta = { id: rows[0].id, first_name: rows[0].first_name, last_name: rows[0].last_name };
    } else {
      // Email fallback for migration
      const contactRows = await base44.asServiceRole.entities.Contact.filter({ email: user.email }).catch(() => []);
      const contact = contactRows[0] || null;
      if (contact) {
        contactId = contact.id;
        contactMeta = { id: contact.id, first_name: contact.first_name, last_name: contact.last_name };
      }
    }

    if (!contactId) {
      return Response.json({ events: [], upcoming: [], past: [], contact: null });
    }

    // Fetch all non-deleted events for this contact
    const allEvents = await base44.asServiceRole.entities.Event.filter(
      { contact_id: contactId, is_deleted: false },
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
      contact: contactMeta,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});