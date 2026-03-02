/**
 * Secure Event Detail bundle endpoint.
 * Returns role-filtered event + related data in one round-trip.
 *
 * Role behaviour summary:
 *   client         → minimal safe view, ownership-checked, includes payment_summary + links
 *   dj             → event (redacted) + music/timeline/planning + filtered activities; no payments
 *   office_finalizer → global access; payments_summary only (no raw rows); filtered activities
 *   finance        → full payments; redacted event (no internal_notes)
 *   admin/sales_manager/city_manager/sales_rep → standard full bundle
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { canAccessEvent, redactEvent, safeContactSummary } from './crm/accessControl.js';

// Activity types/categories excluded for office_finalizer
const OFFICE_FINALIZER_EXCLUDED_ACTIVITY_TYPES = new Set([
  "system", "survey", "dj_survey", "finance",
]);

// Activity types excluded for DJs
const DJ_EXCLUDED_ACTIVITY_TYPES = new Set(["system"]);

// Client-safe event fields
const CLIENT_SAFE_FIELDS = [
  "id", "event_name", "event_type", "event_date", "start_time", "end_time",
  "venue_name", "guest_count", "status", "contract_signed", "deposit_paid",
  "balance_paid", "planning_complete", "timeline_complete", "music_complete",
  "final_call_completed", "city",
];

/** Compute payment totals from a raw payment array */
function computePaymentSummary(rawPayments, event) {
  const paidStatuses = new Set(["paid"]);
  const amountPaidTotal = rawPayments
    .filter(p => paidStatuses.has(p.status))
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const totalFee = event.package_price || 0;
  const remainingBalance = Math.max(0, totalFee - amountPaidTotal);

  return { amount_paid_total: amountPaidTotal, remaining_balance: remainingBalance };
}

/** Pull payment_link and finalizer_call_link from Settings records */
async function fetchLinks(base44, event) {
  // Prefer event-level overrides (future proofing), then global settings
  const settingsRows = await base44.asServiceRole.entities.Settings.filter({ category: "general" }).catch(() => []);
  const settingsMap = Object.fromEntries(settingsRows.map(s => [s.key, s.value]));

  const payment_link = event.payment_link || settingsMap["payment_link"] || null;
  const finalizer_call_link = event.finalizer_call_link || settingsMap["finalizer_call_link"] || null;

  return { payment_link, finalizer_call_link };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = user.role || "sales_rep";

    const body = await req.json().catch(() => ({}));
    const { id } = body;
    if (!id) return Response.json({ error: "id required" }, { status: 400 });

    // Fetch event
    const rows = await base44.asServiceRole.entities.Event.filter({ id });
    const event = rows[0];
    if (!event || event.is_deleted) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // ─── CLIENT path ─────────────────────────────────────────────────────────
    if (role === "client") {
      // Ownership check: match on contact email
      let contactEmail = event.contact_email || null;
      if (event.contact_id) {
        const contactRows = await base44.asServiceRole.entities.Contact.filter({ id: event.contact_id }).catch(() => []);
        contactEmail = contactRows[0]?.email || contactEmail;
      }
      if (contactEmail && contactEmail.toLowerCase() !== user.email.toLowerCase()) {
        return Response.json({ error: "Forbidden: not your event" }, { status: 403 });
      }

      const [musicSelections, timeline, rawPayments, planning, links] = await Promise.all([
        base44.asServiceRole.entities.MusicSelection.filter({ event_id: id }, "category", 100),
        base44.asServiceRole.entities.TimelineItem.filter({ event_id: id }, "order", 50),
        base44.asServiceRole.entities.Payment.filter({ event_id: id }, "-created_date", 50),
        base44.asServiceRole.entities.EventPlanning.filter({ event_id: id }).then(r => r[0] || null),
        fetchLinks(base44, event),
      ]);

      const { amount_paid_total, remaining_balance } = computePaymentSummary(rawPayments, event);

      const safeEvent = {};
      for (const f of CLIENT_SAFE_FIELDS) {
        if (event[f] !== undefined) safeEvent[f] = event[f];
      }

      return Response.json({
        event: {
          ...safeEvent,
          event_id: event.id,
          amount_paid_total,
          remaining_balance,
          payment_link: links.payment_link,
          finalizer_call_link: links.finalizer_call_link,
        },
        timeline,
        musicSelections,
        planning,
        contact: null,
        activities: [],
        tasks: [],
        payments: [],
      });
    }

    // ─── Non-client: centralized access check ────────────────────────────────
    if (!canAccessEvent(user, event)) {
      return Response.json({ error: "Forbidden: access denied" }, { status: 403 });
    }

    // ─── Fetch all related data in parallel ──────────────────────────────────
    const contactPromise = event.contact_id
      ? base44.asServiceRole.entities.Contact.filter({ id: event.contact_id })
          .then(r => safeContactSummary(r[0] || null, role))
      : Promise.resolve(null);

    const [rawActivities, tasks, rawPayments, musicSelections, timeline, planningArr, contact] = await Promise.all([
      base44.asServiceRole.entities.Activity.filter({ related_id: id }, "-created_date", 50),
      base44.asServiceRole.entities.Task.filter({ related_id: id }, "-due_date", 20),
      base44.asServiceRole.entities.Payment.filter({ event_id: id }, "-created_date", 50),
      base44.asServiceRole.entities.MusicSelection.filter({ event_id: id }, "category", 100),
      base44.asServiceRole.entities.TimelineItem.filter({ event_id: id }, "order", 50),
      base44.asServiceRole.entities.EventPlanning.filter({ event_id: id }),
      contactPromise,
    ]);

    // ─── Activity filtering by role ──────────────────────────────────────────
    let activities;
    if (role === "dj") {
      activities = rawActivities.filter(
        a => !a.is_internal && !DJ_EXCLUDED_ACTIVITY_TYPES.has(a.type)
      );
    } else if (role === "office_finalizer") {
      activities = rawActivities.filter(
        a => !a.is_internal && !OFFICE_FINALIZER_EXCLUDED_ACTIVITY_TYPES.has(a.type)
      );
    } else {
      activities = rawActivities;
    }

    // ─── Payment visibility by role ──────────────────────────────────────────
    const redacted = redactEvent(event, role);

    if (role === "office_finalizer") {
      const { amount_paid_total, remaining_balance } = computePaymentSummary(rawPayments, event);
      const links = await fetchLinks(base44, event);

      return Response.json({
        event: { ...redacted, event_id: event.id },
        contact,
        activities,
        tasks,
        payments_summary: {
          amount_paid_total,
          remaining_balance,
          payment_link: links.payment_link,
        },
        musicSelections,
        timeline,
        planning: planningArr[0] || null,
      });
    }

    // Roles that see full raw payment ledger
    const payments = ["admin", "city_manager", "sales_manager", "finance"].includes(role)
      ? rawPayments
      : [];

    return Response.json({
      event: { ...redacted, event_id: event.id },
      contact,
      activities,
      tasks,
      payments,
      musicSelections,
      timeline,
      planning: planningArr[0] || null,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});