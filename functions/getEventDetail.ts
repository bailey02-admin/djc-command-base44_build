/**
 * Secure Event Detail bundle endpoint.
 * Returns role-filtered event + activities + tasks + payments + music + timeline + contact summary
 * in one round-trip, enforcing all field redaction and access rules.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const EVENT_HIDDEN_FIELDS = {
  dj:               ["package_price", "contact_email", "contact_phone", "lead_id", "internal_notes"],
  sales_rep:        ["package_price", "internal_notes"],
  office_finalizer: ["package_price"],
  finance:          ["internal_notes"],
};

const CONTACT_SUMMARY_FIELDS = ["id", "first_name", "last_name", "email", "phone", "secondary_phone", "preferred_contact_method", "city", "role", "notes"];

function redactEvent(record, role) {
  const hidden = EVENT_HIDDEN_FIELDS[role] || [];
  if (!hidden.length) return record;
  const out = { ...record };
  for (const f of hidden) delete out[f];
  return out;
}

function safeContactSummary(contact) {
  if (!contact) return null;
  const out = {};
  for (const f of CONTACT_SUMMARY_FIELDS) {
    if (contact[f] !== undefined) out[f] = contact[f];
  }
  return out;
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

    // CLIENT: return safe-only fields (no internal notes, no pricing, no staff info)
    if (role === "client") {
      const CLIENT_SAFE_FIELDS = [
        "id", "event_name", "event_type", "event_date", "start_time", "end_time",
        "venue_name", "guest_count", "status", "contract_signed", "deposit_paid",
        "balance_paid", "planning_complete", "timeline_complete", "music_complete",
        "final_call_completed",
      ];
      const safeEvent = {};
      for (const f of CLIENT_SAFE_FIELDS) {
        if (event[f] !== undefined) safeEvent[f] = event[f];
      }
      const [musicSelections, timeline, rawPayments, planning] = await Promise.all([
        base44.asServiceRole.entities.MusicSelection.filter({ event_id: id }, "category", 100),
        base44.asServiceRole.entities.TimelineItem.filter({ event_id: id }, "order", 50),
        base44.asServiceRole.entities.Payment.filter({ event_id: id }, "-created_date", 20),
        base44.asServiceRole.entities.EventPlanning.filter({ event_id: id }).then(r => r[0] || null),
      ]);
      const payments = rawPayments.map(p => ({
        id: p.id, payment_type: p.payment_type,
        amount: p.amount, due_date: p.due_date, status: p.status,
      }));
      return Response.json({
        event: { ...safeEvent, event_id: event.id },
        musicSelections, timeline, payments, planning,
        activities: [], tasks: [], contact: null,
      });
    }

    // DJ: only events they are assigned to
    if (role === "dj" && event.assigned_dj !== user.email) {
      return Response.json({ error: "Forbidden: not your event" }, { status: 403 });
    }
    // City manager / sales_rep: city scoped
    if (["city_manager", "sales_rep"].includes(role) && user.city && event.city !== user.city) {
      return Response.json({ error: "Forbidden: outside your city" }, { status: 403 });
    }

    // Parallel fetch of all related data + contact summary
    const contactPromise = event.contact_id
      ? base44.asServiceRole.entities.Contact.filter({ id: event.contact_id }).then(rows => safeContactSummary(rows[0] || null))
      : Promise.resolve(null);

    const [rawActivities, tasks, rawPayments, musicSelections, timeline, planningArr, contact] = await Promise.all([
      base44.asServiceRole.entities.Activity.filter({ related_id: id }, "-created_date", 50),
      base44.asServiceRole.entities.Task.filter({ related_id: id }, "-due_date", 20),
      base44.asServiceRole.entities.Payment.filter({ event_id: id }, "-created_date", 20),
      base44.asServiceRole.entities.MusicSelection.filter({ event_id: id }, "category", 100),
      base44.asServiceRole.entities.TimelineItem.filter({ event_id: id }, "order", 50),
      base44.asServiceRole.entities.EventPlanning.filter({ event_id: id }),
      contactPromise,
    ]);

    // DJs: strip internal activities
    const activities = role === "dj"
      ? rawActivities.filter(a => !a.is_internal && a.type !== "system")
      : rawActivities;

    // DJs and non-finance: no payment data
    const payments = ["admin", "city_manager", "sales_manager", "finance"].includes(role)
      ? rawPayments
      : [];

    const redacted = redactEvent(event, role);
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