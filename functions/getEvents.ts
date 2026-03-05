/**
 * getEvents — secure, paginated event list for internal staff.
 *
 * Computed fields returned per event (beyond raw DB fields):
 *   statusCityLabel      – "Booked – TUL"
 *   balance_due_amount   – finance-gated
 *   organization_name    – from Contact.organization_name (batch-fetched)
 *   salesperson_name     – from Lead.assigned_rep → User.full_name (batch-fetched)
 *   inquiry_source_label – lead_source formatted label
 *   add_ons_summary      – "Name x2, Name x1, +2 more" from best Quote
 *   add_ons_count        – count of distinct add-on line items
 *   add_ons_total_qty    – sum of all qty values
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const EVENT_READ_DENIED = new Set(["client"]);
const HARD_CAP = 500;

const LIST_FIELDS = [
  "id", "event_name", "event_type", "event_date", "start_time", "end_time", "setup_time",
  "city", "venue_name", "venue_id", "contact_name", "contact_id", "status",
  "assigned_dj", "assigned_dj_id", "assigned_mc", "assigned_mc_id",
  "assigned_finalizer", "assigned_city_manager",
  "planning_complete", "timeline_complete", "music_complete",
  "contract_signed", "deposit_paid", "balance_paid", "final_call_completed",
  "dj_briefed", "readiness_score", "is_deleted", "lead_id",
  "package_name", "package_price", "total_fee",
  "guest_count", "planning_lock_at", "planning_submitted_at",
  "updated_date", "booked_date", "lead_source",
  "client_changed_after_review", "dj_reviewed_at",
];

const FINANCE_HIDDEN_ROLES = new Set(["dj", "office_finalizer", "sales_rep"]);

const LEAD_SOURCE_LABELS = {
  website:         "Website",
  google_ads:      "Google Ads",
  meta_ads:        "Meta Ads",
  referral:        "Referral",
  bridal_show:     "Bridal Show",
  the_knot:        "The Knot",
  weddingwire:     "WeddingWire",
  yelp:            "Yelp",
  phone_call:      "Phone Call",
  walk_in:         "Walk-In",
  vendor_referral: "Vendor Referral",
  repeat_client:   "Repeat Client",
  other:           "Other",
};

const ROLE_HIDDEN = {
  dj:               ["contact_email","contact_phone","package_price","survey_score","survey_avg","survey_flag","survey_comments","lead_id","internal_notes"],
  office_finalizer: ["package_price","internal_notes","survey_score","survey_avg","survey_flag","survey_comments"],
  sales_rep:        ["package_price"],
  finance:          ["internal_notes"],
};

function projectFields(record, role) {
  const hidden = new Set(ROLE_HIDDEN[role] || []);
  const out = {};
  for (const key of LIST_FIELDS) {
    if (hidden.has(key)) continue;
    if (record[key] !== undefined) out[key] = record[key];
  }
  out.id = record.id;
  return out;
}

function computeBaseFields(record, role) {
  const statusLabel = (record.status || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  record.statusCityLabel = record.city ? `${statusLabel} – ${record.city}` : statusLabel;

  if (!FINANCE_HIDDEN_ROLES.has(role)) {
    const fee = record.total_fee ?? record.package_price ?? null;
    record.balance_due_amount = fee != null ? (record.balance_paid ? 0 : fee) : null;
  }

  if (record.lead_source) {
    record.inquiry_source_label = LEAD_SOURCE_LABELS[record.lead_source] || record.lead_source;
  }

  return record;
}

// Normalize add-on: support legacy {name, price} and new {name, qty, amount}
function normalizeAddOn(a) {
  return {
    name:   a.name || "",
    qty:    Number(a.qty)  || 1,
    amount: Number(a.amount ?? a.price) || 0,
  };
}

function buildAddOnsSummary(rawAddOns) {
  const addOns = (rawAddOns || []).filter(a => a.name).map(normalizeAddOn);
  const count   = addOns.length;
  if (count === 0) return { summary: null, count: 0, total_qty: 0 };

  const total_qty = addOns.reduce((s, a) => s + a.qty, 0);
  const MAX = 3;
  const shown = addOns.slice(0, MAX);
  const parts = shown.map(a => a.qty > 1 ? `${a.name} x${a.qty}` : a.name);
  if (count > MAX) parts.push(`+${count - MAX} more`);
  return { summary: parts.join(", "), count, total_qty };
}

// Fetch ALL records for a given entity up to cap — used for small reference tables (Contacts, Leads, Users)
// Since the SDK doesn't support $in, we overfetch and filter in memory.
async function fetchAll(sdk, entityName, cap = 1000) {
  return sdk.entities[entityName].list("-updated_date", cap).catch(() => []);
}

Deno.serve(async (req) => {
  const t0 = Date.now();
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
    } catch (_) { /* StaffProfile not yet available — use platform role */ }

    if (EVENT_READ_DENIED.has(role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const {
      limit: rawLimit = 50,
      skip: rawSkip = 0,
      sort = "event_date",
      filters = {},
      date_from,
      date_to,
    } = body;

    const limit = Math.min(Number(rawLimit) || 25, 200);
    const skip  = Math.max(Number(rawSkip) || 0, 0);

    // ── Build DB filter ────────────────────────────────────────────────────
    const dbFilter = {};
    for (const key of ["status", "city", "event_type", "contact_id", "venue_id"]) {
      if (filters[key] && filters[key] !== "all") dbFilter[key] = filters[key];
    }
    if (filters.inquiry_source && filters.inquiry_source !== "all") {
      dbFilter.lead_source = filters.inquiry_source;
    }

    const filterVenueName    = filters.venue_name ? filters.venue_name.toLowerCase() : null;
    const filterUnassignedDj = filters.assigned_dj_id === "__unassigned__";
    const filterDjId = (!filterUnassignedDj && filters.assigned_dj_id && filters.assigned_dj_id !== "any")
      ? filters.assigned_dj_id : null;
    const filterSalesperson   = filters.salesperson ? filters.salesperson.toLowerCase() : null;
    const filterAddOnsPresent = filters.add_ons_present === true;

    if (role === "dj") dbFilter.assigned_dj = user.email;

    const today    = new Date().toISOString().split("T")[0];
    const fromDate = (date_from !== undefined && date_from !== null && date_from !== "") ? date_from : today;
    const toDate   = (date_to   !== undefined && date_to   !== null && date_to   !== "") ? date_to   : null;

    // ── Step 1: Fetch events + reference tables in parallel ────────────────
    const tDb = Date.now();
    const [allEventsRaw, allContacts, allLeads] = await Promise.all([
      base44.asServiceRole.entities.Event.filter(dbFilter, sort, HARD_CAP),
      fetchAll(base44.asServiceRole, "Contact", 2000),
      fetchAll(base44.asServiceRole, "Lead", 2000),
    ]);
    console.log(`[getEvents] parallel fetch: ${Date.now() - tDb}ms events=${allEventsRaw.length} contacts=${allContacts.length} leads=${allLeads.length}`);

    // ── Step 2: Build lookup maps ─────────────────────────────────────────
    const contactMap = {};
    for (const c of allContacts) if (c.id) contactMap[c.id] = c;

    const leadMap = {};
    for (const l of allLeads) if (l.id) leadMap[l.id] = l;

    // ── Step 3: In-memory filters ─────────────────────────────────────────
    let allEvents = allEventsRaw.filter(e => !e.is_deleted);
    if (filterUnassignedDj) allEvents = allEvents.filter(e => !e.assigned_dj_id);
    if (filterDjId)         allEvents = allEvents.filter(e => e.assigned_dj_id === filterDjId);
    if (filterVenueName)    allEvents = allEvents.filter(e => (e.venue_name || "").toLowerCase().includes(filterVenueName));

    const searchQ = filters.search ? filters.search.toLowerCase() : null;
    if (searchQ) {
      allEvents = allEvents.filter(e =>
        (e.event_name   || "").toLowerCase().includes(searchQ) ||
        (e.contact_name || "").toLowerCase().includes(searchQ) ||
        (e.venue_name   || "").toLowerCase().includes(searchQ)
      );
    }

    allEvents = allEvents.filter(e => {
      if (!e.event_date) return false;
      if (fromDate && e.event_date < fromDate) return false;
      if (toDate   && e.event_date > toDate)   return false;
      return true;
    });

    // ── Step 4: Collect rep emails → batch fetch Users ─────────────────────
    const relevantLeadIds = new Set(allEvents.map(e => e.lead_id).filter(Boolean));
    const repEmails = [...new Set(
      allLeads.filter(l => relevantLeadIds.has(l.id) && l.assigned_rep).map(l => l.assigned_rep)
    )];

    const allUsers = repEmails.length > 0
      ? await fetchAll(base44.asServiceRole, "User", 500)
      : [];

    const userByEmail = {};
    for (const u of allUsers) if (u.email) userByEmail[u.email.toLowerCase()] = u;

    console.log(`[getEvents] enrichment ready: users=${allUsers.length} repEmails=${repEmails.length}`);

    // ── Step 6: Attach enrichment to each event ───────────────────────────
    for (const e of allEvents) {
      const contact = contactMap[e.contact_id];
      const lead    = leadMap[e.lead_id];

      // organization_name from Contact
      e.organization_name = contact?.organization_name || null;

      // salesperson_name: Lead.assigned_rep → User.full_name
      if (lead?.assigned_rep) {
        const repEmail = lead.assigned_rep;
        const repUser  = userByEmail[repEmail.toLowerCase()];
        if (repUser?.full_name) {
          e.salesperson_name = repUser.full_name;
        } else {
          const localPart = repEmail.includes("@") ? repEmail.split("@")[0] : repEmail;
          e.salesperson_name = localPart.replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        }
      } else {
        e.salesperson_name = null;
      }

      // inquiry_source_label
      const src = e.lead_source || lead?.lead_source || null;
      e.inquiry_source_label = src ? (LEAD_SOURCE_LABELS[src] || src) : null;

      // add-ons from event snapshot (PHASE D: now from event.add_ons, not quote)
      const { summary, count, total_qty } = buildAddOnsSummary(e.add_ons);
      e.add_ons_count     = count;
      e.add_ons_total_qty = total_qty;
      e.add_ons_summary   = summary;
    }

    // Post-enrichment filters
    if (filterAddOnsPresent) allEvents = allEvents.filter(e => e.add_ons_count > 0);
    if (filterSalesperson)   allEvents = allEvents.filter(e => (e.salesperson_name || "").toLowerCase().includes(filterSalesperson));

    // ── Step 7: Total + paginate + project ────────────────────────────────
    const total     = allEvents.length;
    const paginated = allEvents.slice(skip, skip + limit);

    const ENRICHED_KEYS = [
      "organization_name", "salesperson_name",
      "inquiry_source_label", "add_ons_summary", "add_ons_count", "add_ons_total_qty",
    ];
    const DJ_HIDDEN_ENRICHED = new Set(["salesperson_name"]);

    const result = paginated.map(e => {
      const projected = computeBaseFields(projectFields(e, role), role);
      for (const key of ENRICHED_KEYS) {
        if (role === "dj" && DJ_HIDDEN_ENRICHED.has(key)) continue;
        if (e[key] !== undefined) projected[key] = e[key];
      }
      return projected;
    });

    console.log(`[getEvents] done total=${total} skip=${skip} limit=${limit} returned=${result.length} elapsed=${Date.now() - t0}ms`);

    return Response.json({
      events: result,
      total,
      page: { skip, limit, returned: result.length },
      _timing_ms: Date.now() - t0,
    });
  } catch (err) {
    console.error("[getEvents] error:", err.message, err.stack);
    return Response.json({ error: err.message }, { status: 500 });
  }
});