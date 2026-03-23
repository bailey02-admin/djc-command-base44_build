/**
 * Secure Quote read endpoint — PHASE B: Lead-only access.
 *
 * CRITICAL: lead_id is REQUIRED. Quotes are never accessed standalone.
 * - All reads must specify lead_id
 * - Server-side validates caller has access to that lead (RBAC/city scoping)
 * - Returns at most one quote per lead (1-1 relationship)
 *
 * Key changes:
 * - DB-level filter by lead_id (MANDATORY), status
 * - City-scoping: enforce caller's city matches lead's city
 * - Slim field projection for list views
 * - Expiration enrichment (read-only computed fields)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const BLOCKED_ROLES = new Set(["dj", "client"]);

// Slim fields for quotes list view
const LIST_VIEW_FIELDS = new Set([
  "id", "lead_id", "event_id", "contact_name", "package_name",
  "total_amount", "status", "version", "valid_until", "sent_date",
  "base_price", "discount_amount", "travel_fee",
]);

function projectFields(record) {
  const out = {};
  for (const key of LIST_VIEW_FIELDS) {
    if (record[key] !== undefined) out[key] = record[key];
  }
  out.id = record.id;
  return out;
}

function enrichExpiry(q) {
  const today = new Date().toISOString().split("T")[0];
  const isExpired = q.status === "sent" && q.valid_until && q.valid_until < today;
  return { ...q, is_expired: isExpired, effective_status: isExpired ? "expired" : q.status };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Resolve role from StaffProfile
    let role = user.role || "sales_rep";
    try {
      const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email });
      const profile = profiles?.[0];
      if (profile) {
        if (profile.is_active === false) return Response.json({ error: "Account deactivated" }, { status: 403 });
        role = profile.custom_role || role;
      }
    } catch (_) {}
    if (BLOCKED_ROLES.has(role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const {
      lead_id,
      slim = true,
    } = body;

    // PHASE B: lead_id is REQUIRED — quotes are never accessed standalone
    if (!lead_id) {
      return Response.json({ error: "lead_id is required — quotes are only accessible within a lead context" }, { status: 400 });
    }

    // Validate caller has access to this lead via RBAC/city scoping
    const lead = (await base44.asServiceRole.entities.Lead.filter({ id: lead_id }))[0];
    if (!lead) {
      return Response.json({ error: "Lead not found" }, { status: 404 });
    }

    // City-scoped roles: enforce caller's city matches lead's city
    if (["sales_rep", "city_manager"].includes(role) && user.city && lead.city !== user.city) {
      return Response.json({ error: "Forbidden: you do not have access to this lead" }, { status: 403 });
    }

    // Fetch quote for this lead (1-1 relationship)
    const quotes = await base44.asServiceRole.entities.Quote.filter({ lead_id }, "-created_date", 1);

    // Enrich with expiry computed fields, then optionally slim
    const result = quotes
      .map(enrichExpiry)
      .map(q => slim ? { ...projectFields(q), is_expired: q.is_expired, effective_status: q.effective_status } : q);

    return Response.json({ quotes: result });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});