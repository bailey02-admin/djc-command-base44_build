/**
 * getFinancePayments — Finance Payments List (v2)
 *
 * RBAC: admin, finance → full access
 *        city_manager  → scoped to profile.cities
 *        others        → 403
 *
 * Performance:
 *  - City-scoping: fetch only matching-city event IDs first (lean query), build a Set
 *  - Payment filter: push status + payment_type to DB filter where possible
 *  - Event enrichment: single bulk fetch of all events keyed by ID (no N+1)
 *  - Search: done post-enrichment on the filtered set
 *  - Pagination: server-side slice
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ALLOWED_ROLES = new Set(["admin", "finance", "city_manager"]);

const FINANCE_VISIBLE_STATUSES = new Set([
  "booked_pending", "booked", "planning_in_progress", "finalized", "completed"
]);

async function getProfile(base44, email) {
  const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: email.toLowerCase() });
  const p = profiles?.[0];
  if (!p) return null;
  return p;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const profile = await getProfile(base44, user.email);
    if (!profile || profile.is_active === false) {
      return Response.json({ error: "Account not provisioned or deactivated" }, { status: 403 });
    }
    if (!ALLOWED_ROLES.has(profile.custom_role)) {
      return Response.json({ error: "Forbidden: insufficient role" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      date_from,
      date_to,
      city,
      method,
      status: paymentStatus,
      event_status,
      balance_due_only,
      search,
      limit: rawLimit = 50,
      skip: rawSkip = 0,
    } = body;

    const limit = Math.min(Math.max(Number(rawLimit) || 50, 1), 200);
    const skip = Math.max(Number(rawSkip) || 0, 0);

    // ── Step 1: Determine city scope ──────────────────────────────────────────
    const isCityManager = profile.custom_role === "city_manager";
    const scopedCities = isCityManager ? (profile.cities || []) : [];
    const filterCity = (city && city !== "all") ? city : null;

    // City managers can only see their own cities; admins/finance can filter freely
    const effectiveCity = isCityManager
      ? (filterCity && scopedCities.includes(filterCity) ? filterCity : null)
      : filterCity;

    // ── Step 1b: Load finance_visible statuses from settings ──────────────────
    let configuredFinanceStatuses = [...FINANCE_VISIBLE_STATUSES];
    try {
      const groups = await base44.asServiceRole.entities.StatusGroup.filter({ key: "finance_visible" });
      const financeGroup = groups?.[0];
      if (financeGroup?.statuses?.length > 0) {
        configuredFinanceStatuses = financeGroup.statuses;
      }
    } catch (_) { /* fall back to defaults */ }

    // ── Step 2: Fetch events (lean) for city scoping + enrichment ─────────────
    const eventFilter = { is_deleted: false };
    if (effectiveCity) {
      eventFilter.city = effectiveCity;
    }

    // Finance visible statuses filter — applied if event_status not explicitly set
    const financeStatuses = event_status && event_status !== "all"
      ? [event_status]
      : configuredFinanceStatuses;

    // Fetch all events (we need for enrichment anyway; ~few hundred max for most orgs)
    const t0 = Date.now();
    const allEvents = await base44.asServiceRole.entities.Event.filter(eventFilter, "-event_date", 5000);
    
    // Build eventMap + filter to finance-visible statuses
    const eventMap = {};
    const allowedEventIds = new Set();
    for (const e of allEvents) {
      eventMap[e.id] = e;
      if (financeStatuses.includes(e.status)) {
        allowedEventIds.add(e.id);
      }
    }

    // If city_manager with no explicit city, restrict to their cities
    if (isCityManager && !effectiveCity) {
      const citySet = new Set(scopedCities);
      for (const [id, ev] of Object.entries(eventMap)) {
        if (!citySet.has(ev.city)) allowedEventIds.delete(id);
      }
    }

    // ── Step 3: Build payment DB filter ──────────────────────────────────────
    const paymentDbFilter = {};
    if (paymentStatus && paymentStatus !== "all") {
      paymentDbFilter.status = paymentStatus;
    }
    if (method && method !== "all") {
      paymentDbFilter.payment_method = method;
    }

    // ── Step 4: Fetch payments ────────────────────────────────────────────────
    // Fetch broadly then filter — SDK doesn't support array/in filters
    const rawPayments = await base44.asServiceRole.entities.Payment.filter(
      paymentDbFilter, "-paid_date", 10000
    );

    // ── Step 5: Enrich + apply remaining filters ──────────────────────────────
    let enriched = [];
    for (const p of rawPayments) {
      // Must belong to a finance-visible event
      if (p.event_id && !allowedEventIds.has(p.event_id)) continue;

      const ev = p.event_id ? (eventMap[p.event_id] || {}) : {};
      const enrichedP = {
        ...p,
        event_name: ev.event_name || null,
        event_date: ev.event_date || null,
        event_status: ev.status || null,
        city: ev.city || null,
        contact_name: p.contact_name || ev.contact_name || null,
      };

      // Date filter — paid_date primary, fallback due_date
      if (date_from) {
        const dateVal = enrichedP.paid_date || enrichedP.due_date;
        if (!dateVal || dateVal < date_from) continue;
      }
      if (date_to) {
        const dateVal = enrichedP.paid_date || enrichedP.due_date;
        if (!dateVal || dateVal.slice(0, 10) > date_to) continue;
      }

      // Balance due toggle
      if (balance_due_only) {
        const evFull = eventMap[p.event_id];
        if (evFull) {
          const totalFee = evFull.package_price || 0;
          // We'd need all payments for this event to compute balance — approximate:
          // Include if payment is pending/overdue (likely means balance outstanding)
          if (enrichedP.status === "paid" || enrichedP.status === "waived") continue;
        }
      }

      // Search
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        const haystack = [
          enrichedP.contact_name, enrichedP.event_name, enrichedP.transaction_reference,
          enrichedP.id, enrichedP.event_id, p.notes
        ].map(v => (v || "").toLowerCase()).join(" ");
        if (!haystack.includes(q)) continue;
      }

      enriched.push(enrichedP);
    }

    const total = enriched.length;
    const page = enriched.slice(skip, skip + limit);
    const t1 = Date.now();

    return Response.json({
      payments: page,
      total,
      skip,
      limit,
      _timing_ms: t1 - t0,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});