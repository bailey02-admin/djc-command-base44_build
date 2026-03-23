/**
 * getFinancePaymentsByMonth — Finance Income by Month (v2)
 *
 * RBAC: admin, finance → full; city_manager → city-scoped
 *
 * Returns per-month breakdown for a given year:
 *   month, event_count, event_income, scheduled_count, scheduled_amount,
 *   final_count, final_total, total_paid
 *
 * Performance: two bulk fetches (payments + events), all aggregation in memory.
 * No N+1. Typical dataset: <5000 payments, <1000 events per year.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ALLOWED_ROLES = new Set(["admin", "finance", "city_manager"]);

const DEFAULT_FINANCE_STATUSES = new Set([
  "booked_pending", "booked", "planning_in_progress", "finalized", "completed"
]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email.toLowerCase() });
    const profile = profiles?.[0];
    if (!profile || profile.is_active === false) {
      return Response.json({ error: "Account not provisioned or deactivated" }, { status: 403 });
    }
    if (!ALLOWED_ROLES.has(profile.custom_role)) {
      return Response.json({ error: "Forbidden: insufficient role" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      year: rawYear,
      city,
      finance_statuses, // optional override (e.g. from tests)
    } = body;

    const year = Number(rawYear) || new Date().getFullYear();
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const isCityManager = profile.custom_role === "city_manager";
    const scopedCities = isCityManager ? (profile.cities || []) : [];
    const filterCity = (city && city !== "all") ? city : null;
    const effectiveCity = isCityManager
      ? (filterCity && scopedCities.includes(filterCity) ? filterCity : null)
      : filterCity;

    // Load finance_visible group from settings (unless caller passed explicit override)
    let resolvedStatuses = DEFAULT_FINANCE_STATUSES;
    if (Array.isArray(finance_statuses) && finance_statuses.length > 0) {
      resolvedStatuses = new Set(finance_statuses);
    } else {
      try {
        const groups = await base44.asServiceRole.entities.StatusGroup.filter({ key: "finance_visible" });
        const financeGroup = groups?.[0];
        if (financeGroup?.statuses?.length > 0) {
          resolvedStatuses = new Set(financeGroup.statuses);
        }
      } catch (_) { /* fall back to defaults */ }
    }

    const financeStatuses = resolvedStatuses;

    const t0 = Date.now();

    // ── Fetch events for the year ─────────────────────────────────────────────
    const eventFilter = { is_deleted: false };
    if (effectiveCity) eventFilter.city = effectiveCity;

    const allEvents = await base44.asServiceRole.entities.Event.filter(eventFilter, "-event_date", 5000);

    const eventMap = {};
    const financeEventIds = new Set();
    for (const e of allEvents) {
      eventMap[e.id] = e;
      if (financeStatuses.has(e.status)) {
        // City manager: restrict to their cities
        if (isCityManager && !effectiveCity) {
          if (!scopedCities.includes(e.city)) continue;
        }
        financeEventIds.add(e.id);
      }
    }

    // ── Fetch all payments (no year filter in DB — filter in memory) ──────────
    const allPayments = await base44.asServiceRole.entities.Payment.list("-paid_date", 10000);

    // ── Initialize 12-month buckets ───────────────────────────────────────────
    const months = {};
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, "0")}`;
      months[key] = {
        month: key,
        event_count: 0,       // events with event_date in this month
        event_income: 0,      // sum of paid payments paid_date in this month
        scheduled_count: 0,   // payments due in month, not yet paid
        scheduled_amount: 0,
        final_count: 0,       // final_balance or last-payment type
        final_total: 0,
        total_paid: 0,        // all paid payments in this month
      };
    }

    // ── Count events per month (by event_date) ────────────────────────────────
    for (const e of allEvents) {
      if (!e.event_date || !financeEventIds.has(e.id)) continue;
      if (e.event_date < yearStart || e.event_date > yearEnd) continue;
      const monthKey = e.event_date.slice(0, 7);
      if (months[monthKey]) months[monthKey].event_count++;
    }

    // ── Aggregate payments ────────────────────────────────────────────────────
    for (const p of allPayments) {
      // Must belong to a finance-visible event
      if (!financeEventIds.has(p.event_id)) continue;

      const amount = p.amount || 0;

      // Paid payments — bucket by paid_date
      if (p.status === "paid" && p.paid_date) {
        if (p.paid_date < yearStart || p.paid_date > yearEnd) continue;
        const monthKey = p.paid_date.slice(0, 7);
        if (!months[monthKey]) continue;

        months[monthKey].event_income += amount;
        months[monthKey].total_paid += amount;

        // Final payment detection: type === final_balance, OR payment_type === "installment" that clears balance
        if (p.payment_type === "final_balance") {
          months[monthKey].final_count++;
          months[monthKey].final_total += amount;
        }
      }

      // Scheduled (due but not paid) — bucket by due_date
      if ((p.status === "pending" || p.status === "overdue") && p.due_date) {
        if (p.due_date < yearStart || p.due_date > yearEnd) continue;
        const monthKey = p.due_date.slice(0, 7);
        if (!months[monthKey]) continue;

        months[monthKey].scheduled_count++;
        months[monthKey].scheduled_amount += amount;
      }
    }

    // ── Build sorted result ───────────────────────────────────────────────────
    const result = Object.values(months).sort((a, b) => a.month.localeCompare(b.month));

    // Totals
    const totals = result.reduce((acc, m) => {
      acc.event_count += m.event_count;
      acc.event_income += m.event_income;
      acc.scheduled_count += m.scheduled_count;
      acc.scheduled_amount += m.scheduled_amount;
      acc.final_count += m.final_count;
      acc.final_total += m.final_total;
      acc.total_paid += m.total_paid;
      return acc;
    }, { event_count: 0, event_income: 0, scheduled_count: 0, scheduled_amount: 0, final_count: 0, final_total: 0, total_paid: 0 });

    const t1 = Date.now();

    return Response.json({
      year,
      months: result,
      totals,
      _timing_ms: t1 - t0,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});