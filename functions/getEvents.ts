/**
 * getEvents — secure, paginated event list for internal staff.
 *
 * No local imports (inlines redactEvent to ensure deployment succeeds).
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

function computeDerivedFields(record, role) {
  // statusCityLabel: "Booked – TUL"
  const statusLabel = (record.status || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  record.statusCityLabel = record.city ? `${statusLabel} – ${record.city}` : statusLabel;

  // balance_due: server-computed, finance-gated
  if (!FINANCE_HIDDEN_ROLES.has(role)) {
    const fee = record.total_fee ?? record.package_price ?? null;
    if (fee != null) {
      record.balance_due_amount = record.balance_paid ? 0 : fee;
    } else {
      record.balance_due_amount = null;
    }
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

    // ── Build DB filter (no is_deleted — handle in-memory) ────────────────
    const dbFilter = {};

    for (const key of ["status", "city", "event_type", "contact_id"]) {
      if (filters[key] && filters[key] !== "all") {
        dbFilter[key] = filters[key];
      }
    }

    const filterUnassignedDj = filters.assigned_dj_id === "__unassigned__";

    if (role === "dj") {
      dbFilter.assigned_dj = user.email;
    }

    const today = new Date().toISOString().split("T")[0];
    const fromDate = (date_from !== undefined && date_from !== null && date_from !== "") ? date_from : today;
    const toDate   = (date_to   !== undefined && date_to   !== null && date_to   !== "") ? date_to   : null;

    // ── Step 1: Fetch ──────────────────────────────────────────────────────
    const tDb = Date.now();
    let allEvents = await base44.asServiceRole.entities.Event.filter(dbFilter, sort, HARD_CAP);
    console.log(`[getEvents] DB fetch: ${Date.now() - tDb}ms, raw=${allEvents.length}`);
    console.log(`[getEvents] is_deleted sample:`, allEvents.slice(0, 10).map(e => e.is_deleted));

    // ── Step 2: In-memory filters ─────────────────────────────────────────
    allEvents = allEvents.filter(e => !e.is_deleted);

    if (filterUnassignedDj) {
      allEvents = allEvents.filter(e => !e.assigned_dj_id);
    }

    allEvents = allEvents.filter(e => {
      if (!e.event_date) return false;
      if (fromDate && e.event_date < fromDate) return false;
      if (toDate   && e.event_date > toDate)   return false;
      return true;
    });

    // ── Step 3: total before pagination ───────────────────────────────────
    const total = allEvents.length;

    // ── Step 4: Paginate ──────────────────────────────────────────────────
    const paginated = allEvents.slice(skip, skip + limit);
    const result    = paginated.map(e => projectFields(e, role));

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