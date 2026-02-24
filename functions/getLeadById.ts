/**
 * Secure single-Lead read endpoint with full field redaction.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const LEAD_READ_DENIED = new Set(["dj", "client"]);

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = user.role || "sales_rep";
    if (LEAD_READ_DENIED.has(role)) {
      return Response.json({ error: "Forbidden: your role cannot access leads" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { id } = body;
    if (!id) return Response.json({ error: "id is required" }, { status: 400 });

    const leads = await base44.asServiceRole.entities.Lead.filter({ id });
    const lead = leads[0];
    if (!lead || lead.is_deleted) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // Sales rep: can only view leads they own or in their city
    if (role === "sales_rep") {
      const allowed = lead.assigned_rep === user.email || (user.city && lead.city === user.city);
      if (!allowed) return Response.json({ error: "Forbidden: not your lead or city" }, { status: 403 });
    }
    // City manager: only their city
    if (role === "city_manager" && user.city && lead.city !== user.city) {
      return Response.json({ error: "Forbidden: outside your city" }, { status: 403 });
    }

    return Response.json({ lead: redactFields(lead, role) });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});