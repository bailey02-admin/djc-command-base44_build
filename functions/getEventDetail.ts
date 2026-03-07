/**
 * Secure Event Detail bundle endpoint.
 * Returns role-filtered event + related data in one round-trip.
 * NOTE: No local imports — access control inlined to avoid deployment failures.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ─── Inlined access control ───────────────────────────────────────────────────
const DJ_HIDDEN = [
  "contact_email", "contact_phone", "package_price",
  "survey_score", "survey_avg", "survey_flag", "survey_comments",
  "lead_id", "internal_notes",
];
const ROLE_HIDDEN = {
  dj:               DJ_HIDDEN,
  office_finalizer: ["package_price", "internal_notes", "survey_score", "survey_avg", "survey_flag", "survey_comments"],
  sales_rep:        ["package_price"],
  finance:          ["internal_notes"],
};

function redactEvent(record, role) {
  const hidden = ROLE_HIDDEN[role];
  if (!hidden || hidden.length === 0) return { ...record };
  const out = { ...record };
  for (const f of hidden) delete out[f];
  return out;
}

function canAccessEvent(user, event) {
  const role = user.role || "sales_rep";
  switch (role) {
    case "admin": case "sales_manager": case "sales_rep":
    case "city_manager": case "office_finalizer": case "finance":
      return true;
    case "dj":
      return event.assigned_dj_id === user.id || event.assigned_dj === user.email ||
             event.assigned_mc_id === user.id || event.assigned_mc === user.email;
    default:
      return false;
  }
}

const CONTACT_FIELDS_BY_ROLE = {
  admin:            ["id","first_name","last_name","email","phone","secondary_phone","preferred_contact_method","city","notes"],
  sales_manager:    ["id","first_name","last_name","email","phone","secondary_phone","preferred_contact_method"],
  sales_rep:        ["id","first_name","last_name","email","phone","secondary_phone","preferred_contact_method"],
  city_manager:     ["id","first_name","last_name","email","phone","secondary_phone","preferred_contact_method"],
  office_finalizer: ["id","first_name","last_name","email","phone","secondary_phone","preferred_contact_method"],
  finance:          ["id","first_name","last_name"],
  dj:               ["id","first_name","last_name","preferred_contact_method"],
  client:           null,
};

function safeContactSummary(contact, role) {
  if (!contact) return null;
  const allowed = CONTACT_FIELDS_BY_ROLE[role || "sales_rep"];
  if (!allowed) return null;
  const out = {};
  for (const f of allowed) {
    if (contact[f] !== undefined) out[f] = contact[f];
  }
  return out;
}
// ─── End inlined access control ───────────────────────────────────────────────

const OFFICE_FINALIZER_EXCLUDED_ACTIVITY_TYPES = new Set(["system", "survey", "dj_survey", "finance"]);
const DJ_EXCLUDED_ACTIVITY_TYPES = new Set(["system"]);

const CLIENT_SAFE_FIELDS = [
  "id", "event_name", "event_type", "event_date", "start_time", "end_time",
  "venue_name", "guest_count", "status", "contract_signed", "deposit_paid",
  "balance_paid", "planning_complete", "timeline_complete", "music_complete",
  "final_call_completed", "city", "package_name", "package_price", "total_fee",
  "add_ons", "discount_amount", "tax_amount",
  "planning_lock_at", "planning_submitted_at",
];

function computePaymentSummary(rawPayments, event) {
  const amountPaidTotal = rawPayments
    .filter(p => p.status === "paid")
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalFee = event.total_fee ?? event.package_price ?? 0;
  const remainingBalance = Math.max(0, totalFee - amountPaidTotal);
  return { amount_paid_total: amountPaidTotal, remaining_balance: remainingBalance };
}

async function fetchLinks(base44, event) {
  const settingsRows = await base44.asServiceRole.entities.Settings.filter({ category: "general" }).catch(() => []);
  const settingsMap = Object.fromEntries(settingsRows.map(s => [s.key, s.value]));
  return {
    payment_link: event.payment_link || settingsMap["payment_link"] || null,
    finalizer_call_link: event.finalizer_call_link || settingsMap["finalizer_call_link"] || null,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Resolve role from StaffProfile (source of truth), fallback to platform role
    let role = user.role || "sales_rep";
    try {
      const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email });
      const profile = profiles?.[0];
      if (profile) {
        if (profile.is_active === false) return Response.json({ error: "Account deactivated" }, { status: 403 });
        role = profile.custom_role || role;
      }
    } catch (_) { /* StaffProfile unavailable — use platform role */ }

    const body = await req.json().catch(() => ({}));
    const { id } = body;
    if (!id) return Response.json({ error: "id required" }, { status: 400 });

    const rows = await base44.asServiceRole.entities.Event.filter({ id });
    const event = rows[0];
    if (!event || event.is_deleted) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // ─── CLIENT path ──────────────────────────────────────────────────────────
    if (role === "client") {
      let resolvedContactId = user.contact_id || null;
      if (!resolvedContactId) {
        const emailContactRows = await base44.asServiceRole.entities.Contact.filter({ email: user.email }).catch(() => []);
        resolvedContactId = emailContactRows[0]?.id || null;
      }
      if (!resolvedContactId) {
        return Response.json({ error: "Forbidden: no contact record linked to your account" }, { status: 403 });
      }
      if (!event.contact_id || event.contact_id !== resolvedContactId) {
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

      // Quote summary — built from Event snapshot fields only (no live Quote read post-conversion)
      const quoteSnapshot = (event.total_fee || event.package_price) ? {
        package_name: event.package_name || null,
        total_amount: event.total_fee || event.package_price || 0,
        add_ons: event.add_ons || [],
        discount_amount: event.discount_amount || 0,
        tax_amount: event.tax_amount || 0,
        source: "event_snapshot",
      } : null;

      return Response.json({
        event: { ...safeEvent, event_id: event.id, amount_paid_total, remaining_balance,
          payment_link: links.payment_link, finalizer_call_link: links.finalizer_call_link },
        lead_summary: null,
        quote_summary: quoteSnapshot,
        timeline, musicSelections, planning, contact: null, activities: [], tasks: [], payments: [],
      });
    }

    // ─── Non-client access check ──────────────────────────────────────────────
    if (!canAccessEvent(user, event)) {
      return Response.json({ error: "Forbidden: access denied" }, { status: 403 });
    }

    const contactPromise = event.contact_id
      ? base44.asServiceRole.entities.Contact.filter({ id: event.contact_id })
          .then(r => safeContactSummary(r[0] || null, role))
      : Promise.resolve(null);

    const [rawActivities, tasks, rawPayments, musicSelections, timeline, planningArr, contact, leadRows] = await Promise.all([
      base44.asServiceRole.entities.Activity.filter({ related_id: id }, "-created_date", 50),
      base44.asServiceRole.entities.Task.filter({ related_id: id }, "-due_date", 20),
      base44.asServiceRole.entities.Payment.filter({ event_id: id }, "-created_date", 50),
      base44.asServiceRole.entities.MusicSelection.filter({ event_id: id }, "category", 100),
      base44.asServiceRole.entities.TimelineItem.filter({ event_id: id }, "order", 50),
      base44.asServiceRole.entities.EventPlanning.filter({ event_id: id }),
      contactPromise,
      event.lead_id ? base44.asServiceRole.entities.Lead.filter({ id: event.lead_id }) : Promise.resolve([]),
    ]);

    let activities;
    if (role === "dj") {
      activities = rawActivities.filter(a => !a.is_internal && !DJ_EXCLUDED_ACTIVITY_TYPES.has(a.type));
    } else if (role === "office_finalizer") {
      activities = rawActivities.filter(a => !a.is_internal && !OFFICE_FINALIZER_EXCLUDED_ACTIVITY_TYPES.has(a.type));
    } else {
      activities = rawActivities;
    }

    const redacted = redactEvent(event, role);

    // Lead summary + quote snapshot from Event fields only (no live Quote read post-conversion)
    const lead = leadRows[0] || null;
    const quoteData = (event.total_fee || event.package_price) ? {
      package_name: event.package_name || null,
      total_amount: event.total_fee || event.package_price || 0,
      add_ons: event.add_ons || [],
      discount_amount: event.discount_amount || 0,
      tax_amount: event.tax_amount || 0,
      travel_fee: event.travel_fee || 0,
      source: "event_snapshot",
    } : null;
    const leadSummary = lead ? {
      id: lead.id,
      client_name: `${lead.client_first_name} ${lead.client_last_name || ""}`.trim(),
      assigned_rep: lead.assigned_rep,
      lead_source: lead.lead_source,
      inquiry_date: lead.inquiry_date,
    } : null;

    if (role === "office_finalizer") {
      const { amount_paid_total, remaining_balance } = computePaymentSummary(rawPayments, event);
      const links = await fetchLinks(base44, event);
      return Response.json({
        event: { ...redacted, event_id: event.id },
        lead_summary: leadSummary,
        quote_summary: quoteData,
        contact, activities, tasks,
        payments_summary: { amount_paid_total, remaining_balance,
          payment_link: links.payment_link, finalizer_call_link: links.finalizer_call_link },
        musicSelections, timeline, planning: planningArr[0] || null,
      });
    }

    const payments = ["admin", "city_manager", "sales_manager", "finance"].includes(role) ? rawPayments : [];
    const { amount_paid_total, remaining_balance } = computePaymentSummary(rawPayments, event);

    return Response.json({
      event: { ...redacted, event_id: event.id, amount_paid_total, remaining_balance },
      lead_summary: leadSummary,
      quote_summary: quoteData,
      contact, activities, tasks, payments, musicSelections, timeline,
      planning: planningArr[0] || null,
    });
  } catch (err) {
    console.error("[getEventDetail] error:", err.message, err.stack);
    return Response.json({ error: err.message }, { status: 500 });
  }
});