import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const CONFIG_KEY = 'lead_pipeline_config_v2';

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

const PIPELINE_FIELD_OPTIONS = [
  { key: 'phone', label: 'Phone Number' },
  { key: 'first_response_date', label: 'First Response Date' },
  { key: 'event_date', label: 'Event Date' },
  { key: 'city', label: 'Event City' },
  { key: 'lead_source', label: 'Lead Source' },
  { key: 'consultation_date', label: 'Consultation Date' },
  { key: 'quote_amount', label: 'Quote Amount' },
  { key: 'package_name', label: 'Package Name' },
  { key: 'assigned_rep', label: 'Assigned Rep' },
  { key: 'quote_sent_date', label: 'Quote Sent Date' },
  { key: 'deposit_amount', label: 'Deposit Amount' },
  { key: 'total_fee', label: 'Total Fee' },
  { key: 'booked_date', label: 'Booked Date' },
  { key: 'lost_reason', label: 'Lost Reason' },
  { key: 'no_response_count', label: 'No Response Count' },
];

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const existing = await base44.asServiceRole.entities.Settings.filter({ key: CONFIG_KEY });
    const record = existing?.[0] || null;

    let parsed = {};
    if (record?.value) {
      try {
        parsed = JSON.parse(record.value);
      } catch (_) {
        parsed = {};
      }
    }

    return Response.json({
      key: CONFIG_KEY,
      setting_id: record?.id || null,
      stages: normalizePipelineStages(parsed?.stages || []),
      field_options: PIPELINE_FIELD_OPTIONS,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});