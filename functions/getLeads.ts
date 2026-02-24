/**
 * Secure Lead read endpoint.
 * Enforces: role-based access, city scoping, assignment scoping, field redaction.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Roles that cannot read leads at all
const LEAD_READ_DENIED = new Set(["dj", "client"]);

// Fields to strip per role before returning to browser
const LEAD_HIDDEN_FIELDS = {
  sales_rep:        ["package_price", "discount_amount", "internal_notes", "gclid", "fbclid", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"],
  office_finalizer: ["package_price", "discount_amount", "gclid", "fbclid"],
  finance:          ["internal_notes"],
};

function redactFields(record, role) {
  const hidden = LEAD_HIDDEN_FIELDS[role] || [];
  if (hidden.length === 0) return record;
  const out = { ...record };
  for (const f of hidden) delete out[f];
  return out;
}

function scopeFilter(leads, user) {
  const role = user.role;
  // City manager: all leads in their city (stored on user profile as city)
  if (role === "city_manager" && user.city) {
    return leads.filter(l => l.city === user.city);
  }
  // Sales rep: only leads assigned to them OR in their city
  if (role === "sales_rep") {
    return leads.filter(l => l.assigned_rep === user.email || (user.city && l.city === user.city));
  }
  // Sales manager: all leads (no city restriction — manages multiple cities)
  return leads;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = user.role || "sales_rep";

    if (LEAD_READ_DENIED.has(role)) {
      return Response.json({ error: "Forbidden: your role cannot access leads" }, { status: 403 });
    }

    // Parse optional filter params from request body
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const { limit = 200, sort = "-created_date", filters = {} } = body;

    // Fetch via service role so we always get all records, then scope server-side
    let leads = await base44.asServiceRole.entities.Lead.list(sort, limit);

    // Remove soft-deleted
    leads = leads.filter(l => !l.is_deleted);

    // Apply extra filters from caller (status, city, etc.)
    for (const [key, val] of Object.entries(filters)) {
      if (val && val !== "all") leads = leads.filter(l => l[key] === val);
    }

    // Apply role-based scoping
    if (!["admin", "sales_manager", "finance", "office_finalizer"].includes(role)) {
      leads = scopeFilter(leads, user);
    }

    // Redact fields per role
    const result = leads.map(l => redactFields(l, role));

    return Response.json({ leads: result, total: result.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});