import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const CONFIG_KEY = 'lead_pipeline_config_v2';
const PAGE_SIZE = 200;

const DEFAULT_PIPELINE_STAGES = [
  { key: 'new_inquiry', label: 'New Inquiry', sort_order: 10, is_active: true, is_terminal: false, description: 'Fresh inbound lead that still needs first-touch qualification.', required_fields: [], allowed_next_stages: ['attempted_contact', 'contacted', 'qualified', 'lost', 'ghosted', 'disqualified'] },
  { key: 'attempted_contact', label: 'Attempted Contact', sort_order: 20, is_active: true, is_terminal: false, description: 'Outreach started but a real conversation has not happened yet.', required_fields: ['phone'], allowed_next_stages: ['contacted', 'qualified', 'lost', 'ghosted', 'disqualified'] },
  { key: 'contacted', label: 'Contacted', sort_order: 30, is_active: true, is_terminal: false, description: 'Lead has responded and initial contact has been made.', required_fields: ['phone', 'first_response_date'], allowed_next_stages: ['qualified', 'consultation_scheduled', 'quote_sent', 'lost', 'ghosted', 'disqualified'] },
  { key: 'qualified', label: 'Qualified', sort_order: 40, is_active: true, is_terminal: false, description: 'Lead meets basic fit and event qualification requirements.', required_fields: ['event_date', 'city', 'lead_source'], allowed_next_stages: ['consultation_scheduled', 'consultation_completed', 'quote_sent', 'follow_up', 'lost', 'ghosted', 'disqualified'] },
  { key: 'consultation_scheduled', label: 'Consultation Scheduled', sort_order: 50, is_active: true, is_terminal: false, description: 'Consultation is booked and awaiting completion.', required_fields: ['event_date', 'city', 'consultation_date'], allowed_next_stages: ['consultation_completed', 'quote_sent', 'follow_up', 'lost', 'ghosted', 'disqualified'] },
  { key: 'consultation_completed', label: 'Consultation Completed', sort_order: 60, is_active: true, is_terminal: false, description: 'Consultation finished and the lead is ready for quoting or follow-up.', required_fields: ['event_date', 'city'], allowed_next_stages: ['quote_sent', 'follow_up', 'deposit_requested', 'lost', 'ghosted', 'disqualified'] },
  { key: 'quote_sent', label: 'Quote Sent', sort_order: 70, is_active: true, is_terminal: false, description: 'Pricing has been sent and the deal is now in follow-up / closing mode.', required_fields: ['event_date', 'city', 'quote_amount', 'package_name', 'assigned_rep'], allowed_next_stages: ['follow_up', 'deposit_requested', 'booked', 'lost', 'ghosted', 'disqualified'] },
  { key: 'follow_up', label: 'Follow Up', sort_order: 80, is_active: true, is_terminal: false, description: 'Active follow-up after quote or consultation.', required_fields: ['quote_sent_date'], allowed_next_stages: ['quote_sent', 'deposit_requested', 'booked', 'lost', 'ghosted', 'disqualified'] },
  { key: 'deposit_requested', label: 'Deposit Requested', sort_order: 90, is_active: true, is_terminal: false, description: 'Deposit has been requested and booking is pending payment.', required_fields: ['deposit_amount', 'total_fee'], allowed_next_stages: ['booked', 'lost', 'ghosted', 'disqualified'] },
  { key: 'booked', label: 'Booked', sort_order: 100, is_active: true, is_terminal: false, description: 'Lead is won and converted to a booked customer.', required_fields: ['event_date', 'city', 'deposit_amount', 'total_fee', 'booked_date'], allowed_next_stages: ['lost', 'ghosted', 'disqualified'] },
  { key: 'lost', label: 'Lost', sort_order: 110, is_active: true, is_terminal: true, description: 'Opportunity closed-lost.', required_fields: ['lost_reason'], allowed_next_stages: ['new_inquiry'] },
  { key: 'ghosted', label: 'Ghosted / No Response', sort_order: 120, is_active: true, is_terminal: true, description: 'Lead stopped responding after repeated outreach attempts.', required_fields: ['no_response_count'], allowed_next_stages: ['new_inquiry', 'attempted_contact'] },
  { key: 'disqualified', label: 'Disqualified', sort_order: 130, is_active: true, is_terminal: true, description: 'Lead is not a fit and should be closed out.', required_fields: [], allowed_next_stages: ['new_inquiry'] },
];

const VALID_STAGE_KEYS = new Set(DEFAULT_PIPELINE_STAGES.map((stage) => stage.key));
const VALID_FIELD_KEYS = new Set([
  'phone', 'first_response_date', 'event_date', 'city', 'lead_source', 'consultation_date', 'quote_amount',
  'package_name', 'assigned_rep', 'quote_sent_date', 'deposit_amount', 'total_fee', 'booked_date', 'lost_reason', 'no_response_count',
]);

async function fetchAllLeads(base44) {
  const rows = [];
  const seenIds = new Set();
  let skip = 0;

  while (true) {
    const batch = await base44.asServiceRole.entities.Lead.list('-created_date', PAGE_SIZE, skip);
    if (!Array.isArray(batch) || batch.length === 0) break;

    let added = 0;
    for (const item of batch) {
      if (!item?.id || seenIds.has(item.id)) continue;
      seenIds.add(item.id);
      rows.push(item);
      added += 1;
    }

    if (batch.length < PAGE_SIZE || added === 0) break;
    skip += PAGE_SIZE;
  }

  return rows;
}

const VALID_TRIGGER_TYPES = new Set(['on_enter', 'on_exit']);
const VALID_ACTION_TYPES = new Set(['create_task', 'assign_owner', 'log_activity', 'send_message', 'sla_rule']);

function sanitizeAutomations(rules) {
  if (!Array.isArray(rules)) return [];
  return rules.filter(r => r && r.id && VALID_TRIGGER_TYPES.has(r.trigger) && VALID_ACTION_TYPES.has(r.action_type));
}

function normalizeStages(stages) {
  const incomingMap = Object.fromEntries((stages || []).map((stage) => [stage.key, stage]));
  return DEFAULT_PIPELINE_STAGES.map((stage) => {
    const incoming = incomingMap[stage.key] || {};
    return {
      key: stage.key,
      label: String(incoming.label ?? stage.label).trim(),
      sort_order: Number.isFinite(Number(incoming.sort_order)) ? Number(incoming.sort_order) : stage.sort_order,
      is_active: incoming.is_active === undefined ? stage.is_active : !!incoming.is_active,
      is_terminal: incoming.is_terminal === undefined ? stage.is_terminal : !!incoming.is_terminal,
      description: String(incoming.description ?? stage.description ?? '').trim(),
      required_fields: Array.isArray(incoming.required_fields) ? [...new Set(incoming.required_fields)] : [...stage.required_fields],
      allowed_next_stages: Array.isArray(incoming.allowed_next_stages) ? [...new Set(incoming.allowed_next_stages)] : [...stage.allowed_next_stages],
      automations: sanitizeAutomations(incoming.automations),
    };
  }).sort((a, b) => a.sort_order - b.sort_order);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email });
    const profile = profiles?.[0];
    const role = profile?.custom_role || user.role;
    if (role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    if (!Array.isArray(body?.stages) || body.stages.length === 0) {
      return Response.json({ error: 'stages array is required' }, { status: 400 });
    }

    const incomingKeys = new Set(body.stages.map((stage) => stage.key));
    if (incomingKeys.size !== DEFAULT_PIPELINE_STAGES.length || DEFAULT_PIPELINE_STAGES.some((stage) => !incomingKeys.has(stage.key))) {
      return Response.json({ error: 'All canonical stage keys must be preserved' }, { status: 400 });
    }

    const normalized = normalizeStages(body.stages);

    for (const stage of normalized) {
      if (!stage.label) return Response.json({ error: `Label is required for ${stage.key}` }, { status: 400 });
      if (stage.key === 'new_inquiry' && !stage.is_active) {
        return Response.json({ error: 'new_inquiry must remain active' }, { status: 400 });
      }
      for (const field of stage.required_fields) {
        if (!VALID_FIELD_KEYS.has(field)) {
          return Response.json({ error: `Invalid required field: ${field}` }, { status: 400 });
        }
      }
      for (const nextStage of stage.allowed_next_stages) {
        if (!VALID_STAGE_KEYS.has(nextStage)) {
          return Response.json({ error: `Invalid allowed next stage: ${nextStage}` }, { status: 400 });
        }
      }
    }

    const allLeads = await fetchAllLeads(base44);
    for (const stage of normalized.filter((item) => item.is_active === false)) {
      const inUseCount = allLeads.filter((lead) => !lead.is_deleted && lead.pipeline_stage === stage.key).length;
      if (inUseCount > 0) {
        return Response.json({ error: `Cannot deactivate ${stage.label} — ${inUseCount} lead(s) currently use this stage.` }, { status: 409 });
      }
    }

    const payload = JSON.stringify({ version: 2, stages: normalized });
    const existing = await base44.asServiceRole.entities.Settings.filter({ key: CONFIG_KEY });
    const record = existing?.[0];

    if (record) {
      await base44.asServiceRole.entities.Settings.update(record.id, {
        value: payload,
        category: 'pipeline',
        label: 'Lead Pipeline Configuration',
        description: 'Admin-managed pipeline stage settings used by the Settings UI and mutateLead validation.',
      });
    } else {
      await base44.asServiceRole.entities.Settings.create({
        key: CONFIG_KEY,
        value: payload,
        category: 'pipeline',
        label: 'Lead Pipeline Configuration',
        description: 'Admin-managed pipeline stage settings used by the Settings UI and mutateLead validation.',
      });
    }

    return Response.json({ ok: true, stages: normalized });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});