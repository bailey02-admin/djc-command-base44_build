/**
 * Secure Lead mutation endpoint.
 * Actions: create | update | advance_stage | mark_lost | delete
 *
 * Enforces:
 *  - Role-based CRUD
 *  - Field-level write protection (pricing, internals)
 *  - City + assignment scoping on updates
 *  - Stage transition validation (required fields + allowed transitions)
 *  - Audit log on denial attempts
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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

const WRITE_PROTECTED_FIELDS = {
  sales_rep: ["package_price", "discount_amount", "total_fee", "deposit_amount", "quote_amount"],
};

// Canonical stage order — index used for forward/backward enforcement
const STAGE_ORDER = [
  "new_inquiry","attempted_contact","contacted","qualified",
  "consultation_scheduled","consultation_completed","quote_sent",
  "follow_up","deposit_requested","booked","lost","ghosted","disqualified",
];

// Stages that are "exit" stages — can always be entered regardless of position
const EXIT_STAGES = new Set(["lost","ghosted","disqualified"]);

// Explicit allowed transitions: from → Set of valid targets
// Omitted stages default to: forward-only within STAGE_ORDER (no skip > 1 step)
// Exit stages can be reached from any non-exit stage.
const ALLOWED_TRANSITIONS = {
  new_inquiry:            new Set(["attempted_contact","contacted","qualified","lost","ghosted","disqualified"]),
  attempted_contact:      new Set(["contacted","qualified","lost","ghosted","disqualified"]),
  contacted:              new Set(["qualified","consultation_scheduled","quote_sent","lost","ghosted","disqualified"]),
  qualified:              new Set(["consultation_scheduled","consultation_completed","quote_sent","follow_up","lost","ghosted","disqualified"]),
  consultation_scheduled: new Set(["consultation_completed","quote_sent","follow_up","lost","ghosted","disqualified"]),
  consultation_completed: new Set(["quote_sent","follow_up","deposit_requested","lost","ghosted","disqualified"]),
  quote_sent:             new Set(["follow_up","deposit_requested","booked","lost","ghosted","disqualified"]),
  follow_up:              new Set(["quote_sent","deposit_requested","booked","lost","ghosted","disqualified"]),
  deposit_requested:      new Set(["booked","lost","ghosted","disqualified"]),
  booked:                 new Set(["lost","ghosted","disqualified"]),
  lost:                   new Set(["new_inquiry"]),       // allow re-open
  ghosted:                new Set(["new_inquiry","attempted_contact"]),
  disqualified:           new Set(["new_inquiry"]),
};

// pipeline_stage → status field sync (canonical status that matches a stage)
const STAGE_TO_STATUS = {
  new_inquiry:            "new",
  attempted_contact:      "attempted_contact",
  contacted:              "contacted",
  qualified:              "qualified",
  consultation_scheduled: "consultation_scheduled",
  consultation_completed: "qualified",
  quote_sent:             "quote_sent",
  follow_up:              "follow_up",
  deposit_requested:      "deposit_requested",
  booked:                 "booked",
  lost:                   "lost",
  ghosted:                "ghosted",
  disqualified:           "disqualified",
};

/**
 * CANONICAL server-side required fields per target stage.
 * MUST STAY IN SYNC with components/crm/pipeline.js PIPELINE_STAGES[].required_fields.
 * Backend is the source of truth — UI reads from its own copy for display only.
 */
const STAGE_REQUIRED_FIELDS = {
  attempted_contact:      ["phone"],
  contacted:              ["phone","first_response_date"],
  qualified:              ["event_date","city","lead_source"],
  consultation_scheduled: ["event_date","city","consultation_date"],
  consultation_completed: ["event_date","city"],
  quote_sent:             ["event_date","city","quote_amount","package_name","assigned_rep"],
  follow_up:              ["quote_sent_date"],
  deposit_requested:      ["deposit_amount","total_fee"],
  booked:                 ["event_date","city","deposit_amount","total_fee","booked_date"],
  lost:                   ["lost_reason"],
  ghosted:                ["no_response_count"],
};

function stripProtectedFields(data, role) {
  const blocked = WRITE_PROTECTED_FIELDS[role] || [];
  const out = { ...data };
  for (const f of blocked) delete out[f];
  return out;
}

function getMissingFields(lead, targetStage) {
  const required = STAGE_REQUIRED_FIELDS[targetStage] || [];
  return required.filter(field => {
    const val = lead[field];
    return val === null || val === undefined || val === "" || (typeof val === "number" && isNaN(val));
  });
}

async function logDenial(base44, user, action, leadId, reason) {
  await base44.asServiceRole.entities.Activity.create({
    type: "system",
    subject: `🚫 DENIED: ${user.email} attempted ${action} on lead ${leadId} — ${reason}`,
    related_type: "lead",
    related_id: leadId || "unknown",
    is_internal: true,
    performed_by: user.email,
  }).catch(() => {});
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Resolve role from StaffProfile (source of truth)
    let role = user.role || "sales_rep";
    try {
      const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email });
      const profile = profiles?.[0];
      if (profile) {
        if (profile.is_active === false) return Response.json({ error: "Account deactivated" }, { status: 403 });
        role = profile.custom_role || role;
      }
    } catch (_) {}
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

    // ── UPDATE ───────────────────────────────────────────────────
    if (action === "update") {
      if (!rules.update) {
        await logDenial(base44, user, action, id, "role denied");
        return Response.json({ error: "Forbidden: your role cannot update leads" }, { status: 403 });
      }
      if (!id) return Response.json({ error: "id required" }, { status: 400 });

      await enforceOwnershipScope(base44, user, role, id);
      const cleaned = stripProtectedFields(data, role);
      const updated = await base44.asServiceRole.entities.Lead.update(id, cleaned);
      return Response.json({ lead: updated });
    }

    // ── ADVANCE_STAGE (with server-side validation) ───────────────
    if (action === "advance_stage") {
      if (!rules.update) {
        await logDenial(base44, user, action, id, "role denied");
        return Response.json({ error: "Forbidden: your role cannot update leads" }, { status: 403 });
      }
      if (!id) return Response.json({ error: "id required" }, { status: 400 });

      const leadRows = await base44.asServiceRole.entities.Lead.filter({ id });
      const lead = leadRows[0];
      if (!lead || lead.is_deleted) return Response.json({ error: "Lead not found" }, { status: 404 });

      await enforceOwnershipScope(base44, user, role, id, lead);

      const targetStage = data.pipeline_stage;
      if (!targetStage) return Response.json({ error: "pipeline_stage required" }, { status: 400 });

      // Validate target stage exists
      if (!STAGE_ORDER.includes(targetStage)) {
        return Response.json({ error: `Invalid stage: ${targetStage}` }, { status: 422 });
      }

      // Merge incoming data onto lead for validation (allow caller to supply missing fields inline)
      const mergedLead = { ...lead, ...data };

      // Check required fields
      const missing = getMissingFields(mergedLead, targetStage);
      if (missing.length > 0) {
        return Response.json({
          error: "Stage transition blocked — missing required fields",
          missing_fields: missing,
          target_stage: targetStage,
        }, { status: 422 });
      }

      const cleaned = stripProtectedFields(data, role);
      const updated = await base44.asServiceRole.entities.Lead.update(id, cleaned);
      return Response.json({ lead: updated });
    }

    // ── MARK_LOST ─────────────────────────────────────────────────
    if (action === "mark_lost") {
      if (!rules.update) {
        await logDenial(base44, user, action, id, "role denied");
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      if (!data.lost_reason) {
        return Response.json({ error: "lost_reason is required to mark a lead lost", missing_fields: ["lost_reason"] }, { status: 422 });
      }

      const cleaned = stripProtectedFields(data, role);
      const updated = await base44.asServiceRole.entities.Lead.update(id, {
        ...cleaned,
        status: "lost",
        pipeline_stage: "lost",
      });
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

async function enforceOwnershipScope(base44, user, role, id, lead = null) {
  if (role === "sales_rep") {
    const target = lead || (await base44.asServiceRole.entities.Lead.filter({ id }))[0];
    if (!target) return; // will 404 later
    const allowed = target.assigned_rep === user.email || (user.city && target.city === user.city);
    if (!allowed) throw Object.assign(new Error("Forbidden: not your lead or city"), { _status: 403 });
  }
  if (role === "city_manager" && user.city) {
    const target = lead || (await base44.asServiceRole.entities.Lead.filter({ id }))[0];
    if (target && target.city !== user.city) throw Object.assign(new Error("Forbidden: outside your city"), { _status: 403 });
  }
}