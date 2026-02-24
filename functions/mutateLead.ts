/**
 * Secure Lead mutation endpoint.
 * Actions: create | update | advance_stage | mark_lost | delete
 *
 * Enforces:
 *  - Role-based CRUD
 *  - Field-level write protection (pricing, internals)
 *  - City + assignment scoping on updates
 *  - Audit log on denial attempts
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Who can do what
const LEAD_WRITE_RULES = {
  admin:            { create: true, update: true, delete: true },
  city_manager:     { create: true, update: true, delete: false },
  sales_manager:    { create: true, update: true, delete: false },
  sales_rep:        { create: true, update: true, delete: false },
  dj:               { create: false, update: false, delete: false },
  office_finalizer: { create: false, update: false, delete: false },
  finance:          { create: false, update: false, delete: false },
  client:           { create: false, update: false, delete: false },
};

// Fields that cannot be written by these roles
const WRITE_PROTECTED_FIELDS = {
  sales_rep: ["package_price", "discount_amount", "total_fee", "deposit_amount", "quote_amount"],
};

function stripProtectedFields(data, role) {
  const blocked = WRITE_PROTECTED_FIELDS[role] || [];
  const out = { ...data };
  for (const f of blocked) delete out[f];
  return out;
}

async function logDenial(base44, user, action, leadId, reason) {
  await base44.asServiceRole.entities.Activity.create({
    type: "system",
    subject: `🚫 DENIED: ${user.email} attempted ${action} on lead ${leadId} — ${reason}`,
    related_type: "lead",
    related_id: leadId || "unknown",
    is_internal: true,
    performed_by: user.email,
  }).catch(() => {}); // don't fail the response if log fails
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = user.role || "sales_rep";
    const rules = LEAD_WRITE_RULES[role] || { create: false, update: false, delete: false };

    const body = await req.json().catch(() => ({}));
    const { action, id, data = {} } = body;

    // ── CREATE ────────────────────────────────────────────────────
    if (action === "create") {
      if (!rules.create) {
        await logDenial(base44, user, "create_lead", null, "role denied");
        return Response.json({ error: "Forbidden: your role cannot create leads" }, { status: 403 });
      }
      const cleaned = stripProtectedFields(data, role);
      cleaned.inquiry_date = cleaned.inquiry_date || new Date().toISOString();
      const lead = await base44.asServiceRole.entities.Lead.create(cleaned);
      return Response.json({ lead });
    }

    // ── UPDATE / ADVANCE_STAGE / MARK_LOST ───────────────────────
    if (["update", "advance_stage", "mark_lost"].includes(action)) {
      if (!rules.update) {
        await logDenial(base44, user, action, id, "role denied");
        return Response.json({ error: "Forbidden: your role cannot update leads" }, { status: 403 });
      }
      if (!id) return Response.json({ error: "id required" }, { status: 400 });

      // Verify ownership / city scope for sales_rep
      if (role === "sales_rep") {
        const rows = await base44.asServiceRole.entities.Lead.filter({ id });
        const lead = rows[0];
        if (!lead) return Response.json({ error: "Not found" }, { status: 404 });
        const allowed = lead.assigned_rep === user.email || (user.city && lead.city === user.city);
        if (!allowed) {
          await logDenial(base44, user, action, id, "not assigned or wrong city");
          return Response.json({ error: "Forbidden: not your lead or city" }, { status: 403 });
        }
      }
      if (role === "city_manager" && user.city) {
        const rows = await base44.asServiceRole.entities.Lead.filter({ id });
        const lead = rows[0];
        if (lead && lead.city !== user.city) {
          await logDenial(base44, user, action, id, "outside city");
          return Response.json({ error: "Forbidden: outside your city" }, { status: 403 });
        }
      }

      const cleaned = stripProtectedFields(data, role);
      const updated = await base44.asServiceRole.entities.Lead.update(id, cleaned);
      return Response.json({ lead: updated });
    }

    // ── DELETE ────────────────────────────────────────────────────
    if (action === "delete") {
      if (!rules.delete) {
        await logDenial(base44, user, "delete_lead", id, "role denied");
        return Response.json({ error: "Forbidden: your role cannot delete leads" }, { status: 403 });
      }
      await base44.asServiceRole.entities.Lead.update(id, { is_deleted: true });
      return Response.json({ ok: true });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});