/**
 * Secure Lead mutation endpoint.
 * Actions: create | update | advance_stage | mark_lost | delete
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const PIPELINE_CONFIG_KEY = 'lead_pipeline_config_v2';

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

const DEFAULT_STAGE_TO_STATUS = {
  new_inquiry: "new",
  attempted_contact: "attempted_contact",
  contacted: "contacted",
  qualified: "qualified",
  consultation_scheduled: "consultation_scheduled",
  consultation_completed: "qualified",
  quote_sent: "quote_sent",
  follow_up: "follow_up",
  deposit_requested: "deposit_requested",
  booked: "booked",
  lost: "lost",
  ghosted: "ghosted",
  disqualified: "disqualified",
};

const DEFAULT_PIPELINE_STAGES = [
  { key: "new_inquiry", label: "New Inquiry", sort_order: 10, is_active: true, is_terminal: false, description: "Fresh inbound lead that still needs first-touch qualification.", required_fields: [], allowed_next_stages: ["attempted_contact", "contacted", "qualified", "lost", "ghosted", "disqualified"] },
  { key: "attempted_contact", label: "Attempted Contact", sort_order: 20, is_active: true, is_terminal: false, description: "Outreach started but a real conversation has not happened yet.", required_fields: ["phone"], allowed_next_stages: ["contacted", "qualified", "lost", "ghosted", "disqualified"] },
  { key: "contacted", label: "Contacted", sort_order: 30, is_active: true, is_terminal: false, description: "Lead has responded and initial contact has been made.", required_fields: ["phone", "first_response_date"], allowed_next_stages: ["qualified", "consultation_scheduled", "quote_sent", "lost", "ghosted", "disqualified"] },
  { key: "qualified", label: "Qualified", sort_order: 40, is_active: true, is_terminal: false, description: "Lead meets basic fit and event qualification requirements.", required_fields: ["event_date", "city", "lead_source"], allowed_next_stages: ["consultation_scheduled", "consultation_completed", "quote_sent", "follow_up", "lost", "ghosted", "disqualified"] },
  { key: "consultation_scheduled", label: "Consultation Scheduled", sort_order: 50, is_active: true, is_terminal: false, description: "Consultation is booked and awaiting completion.", required_fields: ["event_date", "city", "consultation_date"], allowed_next_stages: ["consultation_completed", "quote_sent", "follow_up", "lost", "ghosted", "disqualified"] },
  { key: "consultation_completed", label: "Consultation Completed", sort_order: 60, is_active: true, is_terminal: false, description: "Consultation finished and the lead is ready for quoting or follow-up.", required_fields: ["event_date", "city"], allowed_next_stages: ["quote_sent", "follow_up", "deposit_requested", "lost", "ghosted", "disqualified"] },
  { key: "quote_sent", label: "Quote Sent", sort_order: 70, is_active: true, is_terminal: false, description: "Pricing has been sent and the deal is now in follow-up / closing mode.", required_fields: ["event_date", "city", "quote_amount", "package_name", "assigned_rep"], allowed_next_stages: ["follow_up", "deposit_requested", "booked", "lost", "ghosted", "disqualified"] },
  { key: "follow_up", label: "Follow Up", sort_order: 80, is_active: true, is_terminal: false, description: "Active follow-up after quote or consultation.", required_fields: ["quote_sent_date"], allowed_next_stages: ["quote_sent", "deposit_requested", "booked", "lost", "ghosted", "disqualified"] },
  { key: "deposit_requested", label: "Deposit Requested", sort_order: 90, is_active: true, is_terminal: false, description: "Deposit has been requested and booking is pending payment.", required_fields: ["deposit_amount", "total_fee"], allowed_next_stages: ["booked", "lost", "ghosted", "disqualified"] },
  { key: "booked", label: "Booked", sort_order: 100, is_active: true, is_terminal: false, description: "Lead is won and converted to a booked customer.", required_fields: ["event_date", "city", "deposit_amount", "total_fee", "booked_date"], allowed_next_stages: ["lost", "ghosted", "disqualified"] },
  { key: "lost", label: "Lost", sort_order: 110, is_active: true, is_terminal: true, description: "Opportunity closed-lost.", required_fields: ["lost_reason"], allowed_next_stages: ["new_inquiry"] },
  { key: "ghosted", label: "Ghosted / No Response", sort_order: 120, is_active: true, is_terminal: true, description: "Lead stopped responding after repeated outreach attempts.", required_fields: ["no_response_count"], allowed_next_stages: ["new_inquiry", "attempted_contact"] },
  { key: "disqualified", label: "Disqualified", sort_order: 130, is_active: true, is_terminal: true, description: "Lead is not a fit and should be closed out.", required_fields: [], allowed_next_stages: ["new_inquiry"] },
];

function stripProtectedFields(data, role) {
  const blocked = WRITE_PROTECTED_FIELDS[role] || [];
  const out = { ...data };
  for (const field of blocked) delete out[field];
  return out;
}

function normalizePipelineStages(stages = []) {
  const rawMap = Object.fromEntries((stages || []).map((stage) => [stage.key, stage]));
  return DEFAULT_PIPELINE_STAGES.map((stage) => {
    const incoming = rawMap[stage.key] || {};
    return {
      ...stage,
      label: incoming.label ?? stage.label,
      sort_order: Number.isFinite(Number(incoming.sort_order)) ? Number(incoming.sort_order) : stage.sort_order,
      is_active: incoming.is_active === undefined ? stage.is_active : !!incoming.is_active,
      is_terminal: incoming.is_terminal === undefined ? stage.is_terminal : !!incoming.is_terminal,
      description: incoming.description ?? stage.description,
      required_fields: Array.isArray(incoming.required_fields) ? incoming.required_fields : stage.required_fields,
      allowed_next_stages: Array.isArray(incoming.allowed_next_stages) ? incoming.allowed_next_stages : stage.allowed_next_stages,
      automations: Array.isArray(incoming.automations) ? incoming.automations : [],
    };
  }).sort((a, b) => a.sort_order - b.sort_order);
}

async function getPipelineStageMap(base44) {
  const existing = await base44.asServiceRole.entities.Settings.filter({ key: PIPELINE_CONFIG_KEY });
  const record = existing?.[0];
  let parsed = {};

  if (record?.value) {
    try {
      parsed = JSON.parse(record.value);
    } catch (_) {
      parsed = {};
    }
  }

  const stages = normalizePipelineStages(parsed?.stages || []);
  return Object.fromEntries(stages.map((stage) => [stage.key, stage]));
}

function getMissingFields(lead, targetStage, stageMap) {
  const required = stageMap[targetStage]?.required_fields || [];
  return required.filter((field) => {
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

    if (action === "update") {
      if (!rules.update) {
        await logDenial(base44, user, action, id, "role denied");
        return Response.json({ error: "Forbidden: your role cannot update leads" }, { status: 403 });
      }
      if (!id) return Response.json({ error: "id required" }, { status: 400 });

      const leadRows = await base44.asServiceRole.entities.Lead.filter({ id });
      const lead = leadRows[0];
      if (!lead || lead.is_deleted) return Response.json({ error: "Lead not found" }, { status: 404 });
      await enforceOwnershipScope(base44, user, role, id, lead);

      if (data.pipeline_stage && data.pipeline_stage !== lead.pipeline_stage) {
        return Response.json({ error: "Use advance_stage for pipeline stage changes" }, { status: 400 });
      }

      const cleaned = stripProtectedFields(data, role);
      const updated = await base44.asServiceRole.entities.Lead.update(id, cleaned);
      return Response.json({ lead: updated });
    }

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

      const stageMap = await getPipelineStageMap(base44);
      const targetConfig = stageMap[targetStage];
      if (!targetConfig) {
        return Response.json({ error: `Invalid stage: ${targetStage}` }, { status: 422 });
      }

      const currentStage = lead.pipeline_stage || "new_inquiry";
      const currentConfig = stageMap[currentStage] || stageMap.new_inquiry;

      if (currentStage !== targetStage && targetConfig.is_active === false) {
        return Response.json({
          error: `Target stage is inactive: ${targetStage}`,
          current_stage: currentStage,
          target_stage: targetStage,
          allowed_targets: currentConfig?.allowed_next_stages || [],
        }, { status: 422 });
      }

      if (currentStage !== targetStage) {
        const allowedTargets = currentConfig?.allowed_next_stages || [];
        if (!allowedTargets.includes(targetStage)) {
          await logDenial(base44, user, "advance_stage", id, `invalid transition ${currentStage} → ${targetStage}`);
          return Response.json({
            error: `Transition not allowed: ${currentStage} → ${targetStage}`,
            current_stage: currentStage,
            target_stage: targetStage,
            allowed_targets: allowedTargets,
          }, { status: 422 });
        }
      }

      const mergedLead = { ...lead, ...data };
      const missing = getMissingFields(mergedLead, targetStage, stageMap);
      if (missing.length > 0) {
        return Response.json({
          error: "Stage transition blocked — missing required fields",
          missing_fields: missing,
          target_stage: targetStage,
          current_stage: currentStage,
          allowed_targets: currentConfig?.allowed_next_stages || [],
        }, { status: 422 });
      }

      const cleaned = stripProtectedFields(data, role);
      const syncedStatus = DEFAULT_STAGE_TO_STATUS[targetStage];
      if (syncedStatus && !cleaned.status) cleaned.status = syncedStatus;

      const updated = await base44.asServiceRole.entities.Lead.update(id, cleaned);
      return Response.json({ lead: updated });
    }

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
    return Response.json({ error: err.message }, { status: err._status || 500 });
  }
});

async function enforceOwnershipScope(base44, user, role, id, lead = null) {
  let profileCities = [];
  try {
    const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email });
    const profile = profiles?.[0];
    if (profile) {
      profileCities = profile.cities?.length > 0
        ? profile.cities
        : (profile.default_city ? [profile.default_city] : []);
    }
  } catch (_) {}

  if (role === "sales_rep") {
    const target = lead || (await base44.asServiceRole.entities.Lead.filter({ id }))[0];
    if (!target) return;
    const inCity = profileCities.length > 0 && profileCities.includes(target.city);
    const assigned = target.assigned_rep === user.email;
    if (!inCity && !assigned) {
      throw Object.assign(new Error("Forbidden: not your lead or city"), { _status: 403 });
    }
  }

  if (role === "city_manager" && profileCities.length > 0) {
    const target = lead || (await base44.asServiceRole.entities.Lead.filter({ id }))[0];
    if (target && !profileCities.includes(target.city)) {
      throw Object.assign(new Error("Forbidden: outside your city"), { _status: 403 });
    }
  }
}