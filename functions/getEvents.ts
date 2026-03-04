/**
 * getEvents — secure, paginated event list for internal staff.
 *
 * Computed fields returned per event (beyond raw DB fields):
 *   statusCityLabel     – "Booked – TUL"
 *   balance_due_amount  – finance-gated
 *   organization_name   – from Contact.organization_name (batch-fetched)
 *   salesperson_name    – from Lead.assigned_rep (batch-fetched)
 *   inquiry_source_label – lead_source formatted label (from Event.lead_source or Lead)
 *   add_ons_summary     – comma-joined add-on names from accepted/sent Quote (batch-fetched)
 *   add_ons_count       – number of add-ons
 *
 * Response: { events: [...], total: N, page: { skip, limit, returned }, _timing_ms }
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

// Finance-only fields hidden from non-finance roles
const FINANCE_HIDDEN_ROLES = new Set(["dj", "office_finalizer", "sales_rep"]);

const LEAD_SOURCE_LABELS = {
  website:       "Website",
  google_ads:    "Google Ads",
  meta_ads:      "Meta Ads",
  referral:      "Referral",
  bridal_show:   "Bridal Show",
  the_knot:      "The Knot",
  weddingwire:   "WeddingWire",
  yelp:          "Yelp",
  phone_call:    "Phone Call",
  walk_in:       "Walk-In",
  vendor_referral: "Vendor Referral",
  repeat_client: "Repeat Client",
  other:         "Other",
};

function computeDerivedFields(record, role) {
  // statusCityLabel: "Booked – TUL"
  const statusLabel = (record.status || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  record.statusCityLabel = record.city ? `${statusLabel} – ${record.city}` : statusLabel;

  // balance_due: server-computed, finance-gated
  if (!FINANCE_HIDDEN_ROLES.has(role)) {
    const fee = record.total_fee ?? record.package_price ?? null;
    record.balance_due_amount = fee != null ? (record.balance_paid ? 0 : fee) : null;
  }

  // inquiry_source_label from denormed lead_source on event
  if (record.lead_source) {
    record.inquiry_source_label = LEAD_SOURCE_LABELS[record.lead_source] || record.lead_source;
  }

  return record;
}

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

Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = user.role || "sales_rep";
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
      if (filters[key] && filters[key] !== "all") {
        dbFilter[key] = filters[key];
      }
    }

    const filterVenueName   = filters.venue_name ? filters.venue_name.toLowerCase() : null;
    const filterUnassignedDj = filters.assigned_dj_id === "__unassigned__";
    const filterDjId = (!filterUnassignedDj && filters.assigned_dj_id && filters.assigned_dj_id !== "any")
      ? filters.assigned_dj_id : null;
    const filterSalesperson  = filters.salesperson ? filters.salesperson.toLowerCase() : null;
    const filterInquirySource = filters.inquiry_source && filters.inquiry_source !== "all"
      ? filters.inquiry_source : null;
    const filterAddOnsPresent = filters.add_ons_present === true;

    if (filterInquirySource) dbFilter.lead_source = filterInquirySource;

    if (role === "dj") {
      dbFilter.assigned_dj = user.email;
    }

    const today    = new Date().toISOString().split("T")[0];
    const fromDate = (date_from !== undefined && date_from !== null && date_from !== "") ? date_from : today;
    const toDate   = (date_to   !== undefined && date_to   !== null && date_to   !== "") ? date_to   : null;

    // ── Step 1: Fetch events ───────────────────────────────────────────────
    const tDb = Date.now();
    let allEvents = await base44.asServiceRole.entities.Event.filter(dbFilter, sort, HARD_CAP);
    console.log(`[getEvents] DB fetch: ${Date.now() - tDb}ms, raw=${allEvents.length}`);

    // ── Step 2: In-memory filters ─────────────────────────────────────────
    allEvents = allEvents.filter(e => !e.is_deleted);

    if (filterUnassignedDj) allEvents = allEvents.filter(e => !e.assigned_dj_id);
    if (filterDjId)         allEvents = allEvents.filter(e => e.assigned_dj_id === filterDjId);
    if (filterVenueName)    allEvents = allEvents.filter(e => (e.venue_name || "").toLowerCase().includes(filterVenueName));

    const searchQ = filters.search ? filters.search.toLowerCase() : null;
    if (searchQ) {
      allEvents = allEvents.filter(e =>
        (e.event_name    || "").toLowerCase().includes(searchQ) ||
        (e.contact_name  || "").toLowerCase().includes(searchQ) ||
        (e.venue_name    || "").toLowerCase().includes(searchQ)
      );
    }

    allEvents = allEvents.filter(e => {
      if (!e.event_date) return false;
      if (fromDate && e.event_date < fromDate) return false;
      if (toDate   && e.event_date > toDate)   return false;
      return true;
    });

    // ── Step 3: Batch-fetch enrichment data (no N+1) ──────────────────────
    const tEnrich = Date.now();

    // Collect unique contact_ids and lead_ids from this filtered set
    const contactIds = [...new Set(allEvents.map(e => e.contact_id).filter(Boolean))];
    const leadIds    = [...new Set(allEvents.map(e => e.lead_id   ).filter(Boolean))];
    const eventIds   = allEvents.map(e => e.id);

    // Parallel batch fetches
    const [contactsRaw, leadsRaw, quotesRaw] = await Promise.all([
      contactIds.length > 0
        ? base44.asServiceRole.entities.Contact.filter({ id: { $in: contactIds } }, null, contactIds.length + 10)
        : Promise.resolve([]),
      leadIds.length > 0
        ? base44.asServiceRole.entities.Lead.filter({ id: { $in: leadIds } }, null, leadIds.length + 10)
        : Promise.resolve([]),
      eventIds.length > 0
        ? base44.asServiceRole.entities.Quote.filter(
            { event_id: { $in: eventIds }, status: { $in: ["accepted", "sent", "viewed"] } },
            null,
            eventIds.length * 3
          )
        : Promise.resolve([]),
    ]);

    // Build lookup maps
    const contactMap = {};
    for (const c of contactsRaw) contactMap[c.id] = c;

    const leadMap = {};
    for (const l of leadsRaw) leadMap[l.id] = l;

    // Quote map: event_id → best quote (prefer accepted, then most recent)
    const quoteMap = {};
    for (const q of quotesRaw) {
      const existing = quoteMap[q.event_id];
      if (!existing || q.status === "accepted" || q.version > (existing.version || 1)) {
        quoteMap[q.event_id] = q;
      }
    }

    console.log(`[getEvents] enrichment batch: ${Date.now() - tEnrich}ms contacts=${contactsRaw.length} leads=${leadsRaw.length} quotes=${quotesRaw.length}`);

    // Attach enrichment fields to each event
    for (const e of allEvents) {
      const contact = contactMap[e.contact_id];
      const lead    = leadMap[e.lead_id];
      const quote   = quoteMap[e.id];

      // organization_name: from Contact
      e.organization_name = contact?.organization_name || null;

      // salesperson_name: from Lead.assigned_rep (email string — display as-is or strip @domain)
      if (lead?.assigned_rep) {
        const rep = lead.assigned_rep;
        e.salesperson_name = rep.includes("@") ? rep.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : rep;
      } else {
        e.salesperson_name = null;
      }

      // inquiry_source_label: from Event.lead_source (denormed) or Lead.lead_source
      const src = e.lead_source || lead?.lead_source || null;
      e.inquiry_source_label = src ? (LEAD_SOURCE_LABELS[src] || src) : null;

      // add_ons: from best Quote linked to this event
      if (quote?.add_ons?.length > 0) {
        const addOns = quote.add_ons.filter(a => a.name);
        e.add_ons_count   = addOns.length;
        e.add_ons_summary = addOns.map(a => a.price != null ? `${a.name} ($${a.price})` : a.name).join(", ");
      } else {
        e.add_ons_count   = 0;
        e.add_ons_summary = null;
      }
    }

    // add_ons_present filter (applied after enrichment)
    if (filterAddOnsPresent) {
      allEvents = allEvents.filter(e => e.add_ons_count > 0);
    }

    // salesperson filter (applied after enrichment, in-memory)
    if (filterSalesperson) {
      allEvents = allEvents.filter(e => (e.salesperson_name || "").toLowerCase().includes(filterSalesperson));
    }

    // ── Step 4: total before pagination ───────────────────────────────────
    const total = allEvents.length;

    // ── Step 5: Paginate & project ────────────────────────────────────────
    const paginated = allEvents.slice(skip, skip + limit);

    // Extended project: include enriched computed fields
    const ENRICHED_KEYS = [
      "organization_name", "salesperson_name",
      "inquiry_source_label", "add_ons_summary", "add_ons_count",
    ];
    const DJ_HIDDEN_ENRICHED = new Set(["salesperson_name"]); // DJs don't need sales info

    const result = paginated.map(e => {
      const projected = computeDerivedFields(projectFields(e, role), role);
      for (const key of ENRICHED_KEYS) {
        if (role === "dj" && DJ_HIDDEN_ENRICHED.has(key)) continue;
        if (e[key] !== undefined) projected[key] = e[key];
      }
      return projected;
    });

    console.log(`[getEvents] total=${total} skip=${skip} limit=${limit} returned=${result.length} elapsed=${Date.now() - t0}ms`);

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