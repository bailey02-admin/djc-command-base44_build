export const PIPELINE_FIELD_OPTIONS = [
  { key: "phone", label: "Phone Number" },
  { key: "first_response_date", label: "First Response Date" },
  { key: "event_date", label: "Event Date" },
  { key: "city", label: "Event City" },
  { key: "lead_source", label: "Lead Source" },
  { key: "consultation_date", label: "Consultation Date" },
  { key: "quote_amount", label: "Quote Amount" },
  { key: "package_name", label: "Package Name" },
  { key: "assigned_rep", label: "Assigned Rep" },
  { key: "quote_sent_date", label: "Quote Sent Date" },
  { key: "deposit_amount", label: "Deposit Amount" },
  { key: "total_fee", label: "Total Fee" },
  { key: "booked_date", label: "Booked Date" },
  { key: "lost_reason", label: "Lost Reason" },
  { key: "no_response_count", label: "No Response Count" },
];

export const PIPELINE_FIELD_LABELS = Object.fromEntries(PIPELINE_FIELD_OPTIONS.map(field => [field.key, field.label]));

export const DEFAULT_STAGE_TO_STATUS = {
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

export const DEFAULT_PIPELINE_STAGES = [
  {
    key: "new_inquiry",
    label: "New Inquiry",
    sort_order: 10,
    is_active: true,
    is_terminal: false,
    description: "Fresh inbound lead that still needs first-touch qualification.",
    required_fields: [],
    allowed_next_stages: ["attempted_contact", "contacted", "qualified", "lost", "ghosted", "disqualified"],
    color: "bg-gray-100 text-gray-700",
    dot: "bg-gray-400",
  },
  {
    key: "attempted_contact",
    label: "Attempted Contact",
    sort_order: 20,
    is_active: true,
    is_terminal: false,
    description: "Outreach started but a real conversation has not happened yet.",
    required_fields: ["phone"],
    allowed_next_stages: ["contacted", "qualified", "lost", "ghosted", "disqualified"],
    color: "bg-orange-50 text-orange-700",
    dot: "bg-orange-400",
  },
  {
    key: "contacted",
    label: "Contacted",
    sort_order: 30,
    is_active: true,
    is_terminal: false,
    description: "Lead has responded and initial contact has been made.",
    required_fields: ["phone", "first_response_date"],
    allowed_next_stages: ["qualified", "consultation_scheduled", "quote_sent", "lost", "ghosted", "disqualified"],
    color: "bg-yellow-50 text-yellow-700",
    dot: "bg-yellow-400",
  },
  {
    key: "qualified",
    label: "Qualified",
    sort_order: 40,
    is_active: true,
    is_terminal: false,
    description: "Lead meets basic fit and event qualification requirements.",
    required_fields: ["event_date", "city", "lead_source"],
    allowed_next_stages: ["consultation_scheduled", "consultation_completed", "quote_sent", "follow_up", "lost", "ghosted", "disqualified"],
    color: "bg-blue-50 text-blue-700",
    dot: "bg-blue-400",
  },
  {
    key: "consultation_scheduled",
    label: "Consultation Scheduled",
    sort_order: 50,
    is_active: true,
    is_terminal: false,
    description: "Consultation is booked and awaiting completion.",
    required_fields: ["event_date", "city", "consultation_date"],
    allowed_next_stages: ["consultation_completed", "quote_sent", "follow_up", "lost", "ghosted", "disqualified"],
    color: "bg-indigo-50 text-indigo-700",
    dot: "bg-indigo-400",
  },
  {
    key: "consultation_completed",
    label: "Consultation Completed",
    sort_order: 60,
    is_active: true,
    is_terminal: false,
    description: "Consultation finished and the lead is ready for quoting or follow-up.",
    required_fields: ["event_date", "city"],
    allowed_next_stages: ["quote_sent", "follow_up", "deposit_requested", "lost", "ghosted", "disqualified"],
    color: "bg-violet-50 text-violet-700",
    dot: "bg-violet-400",
  },
  {
    key: "quote_sent",
    label: "Quote Sent",
    sort_order: 70,
    is_active: true,
    is_terminal: false,
    description: "Pricing has been sent and the deal is now in follow-up / closing mode.",
    required_fields: ["event_date", "city", "quote_amount", "package_name", "assigned_rep"],
    allowed_next_stages: ["follow_up", "deposit_requested", "booked", "lost", "ghosted", "disqualified"],
    color: "bg-purple-50 text-purple-700",
    dot: "bg-purple-400",
  },
  {
    key: "follow_up",
    label: "Follow Up",
    sort_order: 80,
    is_active: true,
    is_terminal: false,
    description: "Active follow-up after quote or consultation.",
    required_fields: ["quote_sent_date"],
    allowed_next_stages: ["quote_sent", "deposit_requested", "booked", "lost", "ghosted", "disqualified"],
    color: "bg-amber-50 text-amber-700",
    dot: "bg-amber-400",
  },
  {
    key: "deposit_requested",
    label: "Deposit Requested",
    sort_order: 90,
    is_active: true,
    is_terminal: false,
    description: "Deposit has been requested and booking is pending payment.",
    required_fields: ["deposit_amount", "total_fee"],
    allowed_next_stages: ["booked", "lost", "ghosted", "disqualified"],
    color: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-400",
  },
  {
    key: "booked",
    label: "Booked",
    sort_order: 100,
    is_active: true,
    is_terminal: false,
    description: "Lead is won and converted to a booked customer.",
    required_fields: ["event_date", "city", "deposit_amount", "total_fee", "booked_date"],
    allowed_next_stages: ["lost", "ghosted", "disqualified"],
    color: "bg-green-100 text-green-800",
    dot: "bg-green-500",
  },
  {
    key: "lost",
    label: "Lost",
    sort_order: 110,
    is_active: true,
    is_terminal: true,
    description: "Opportunity closed-lost.",
    required_fields: ["lost_reason"],
    allowed_next_stages: ["new_inquiry"],
    color: "bg-red-50 text-red-700",
    dot: "bg-red-400",
  },
  {
    key: "ghosted",
    label: "Ghosted / No Response",
    sort_order: 120,
    is_active: true,
    is_terminal: true,
    description: "Lead stopped responding after repeated outreach attempts.",
    required_fields: ["no_response_count"],
    allowed_next_stages: ["new_inquiry", "attempted_contact"],
    color: "bg-gray-100 text-gray-500",
    dot: "bg-gray-300",
  },
  {
    key: "disqualified",
    label: "Disqualified",
    sort_order: 130,
    is_active: true,
    is_terminal: true,
    description: "Lead is not a fit and should be closed out.",
    required_fields: [],
    allowed_next_stages: ["new_inquiry"],
    color: "bg-zinc-100 text-zinc-500",
    dot: "bg-zinc-400",
  },
];

export function normalizePipelineStages(stages = []) {
  const rawMap = Object.fromEntries((stages || []).map(stage => [stage.key, stage]));
  return DEFAULT_PIPELINE_STAGES.map(stage => {
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
    };
  }).sort((a, b) => a.sort_order - b.sort_order);
}

export function buildStageMap(stages = DEFAULT_PIPELINE_STAGES) {
  return Object.fromEntries(stages.map(stage => [stage.key, stage]));
}

export const PIPELINE_STAGES = normalizePipelineStages(DEFAULT_PIPELINE_STAGES).filter(stage => stage.is_active);
export const STAGE_MAP = buildStageMap(normalizePipelineStages(DEFAULT_PIPELINE_STAGES));

export function getMissingFieldsForStage(lead, targetStage, stageMap = STAGE_MAP) {
  const stage = stageMap[targetStage];
  if (!stage) return [];
  return (stage.required_fields || []).filter(field => {
    const val = lead[field];
    return val === null || val === undefined || val === "" || (typeof val === "number" && isNaN(val));
  });
}

export function canAdvanceToStage(lead, targetStage, stageMap = STAGE_MAP) {
  return getMissingFieldsForStage(lead, targetStage, stageMap).length === 0;
}

export const DEFAULT_SLA = { warning_minutes: 15, missed_minutes: 60 };

export function calculateSLAStatus(inquiryDate, firstResponseDate, config = DEFAULT_SLA) {
  if (!inquiryDate) return "not_applicable";
  const inquiryMs = new Date(inquiryDate).getTime();
  const now = Date.now();
  const responseMs = firstResponseDate ? new Date(firstResponseDate).getTime() : now;
  const elapsed = (responseMs - inquiryMs) / 60000;

  if (elapsed <= config.warning_minutes) return "on_time";
  if (elapsed <= config.missed_minutes) return "warning";
  return "missed";
}

export const SLA_BADGE = {
  on_time:        "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning:        "bg-amber-50 text-amber-700 border-amber-200",
  missed:         "bg-red-50 text-red-700 border-red-200",
  not_applicable: "bg-gray-50 text-gray-400 border-gray-200",
};

export const AUTOMATION_TEMPLATES = {
  new_lead:           [
    { title: "Call/text new lead NOW", category: "call", priority: "urgent", offset_hours: 0 },
    { title: "Follow up if no contact (24h)", category: "follow_up", priority: "high", offset_hours: 24 },
  ],
  quote_sent:         [
    { title: "Quote follow-up (24h)", category: "follow_up", priority: "high", offset_hours: 24 },
    { title: "Quote follow-up (72h)", category: "follow_up", priority: "medium", offset_hours: 72 },
  ],
  deposit_requested:  [
    { title: "Deposit reminder (48h)", category: "payment", priority: "high", offset_hours: 48 },
  ],
  event_60_days:      [
    { title: "Send client planning form", category: "planning", priority: "medium", offset_hours: 0 },
  ],
  event_30_days:      [
    { title: "Timeline review — 30 days out", category: "finalization", priority: "high", offset_hours: 0 },
  ],
  event_14_days:      [
    { title: "Schedule final client call — 14 days out", category: "finalization", priority: "urgent", offset_hours: 0 },
  ],
  event_completed:    [
    { title: "Send post-event survey (24h)", category: "survey", priority: "medium", offset_hours: 24 },
  ],
  survey_low_score:   [
    { title: "SERVICE RECOVERY — escalate to city manager", category: "follow_up", priority: "urgent", offset_hours: 0 },
  ],
};

export function buildTasksFromTemplate(templateKey, relatedId, relatedName, relatedType = "lead") {
  const templates = AUTOMATION_TEMPLATES[templateKey] || [];
  const now = new Date();
  return templates.map(t => ({
    title: t.title,
    category: t.category,
    priority: t.priority,
    status: "pending",
    related_id: relatedId,
    related_name: relatedName,
    related_type: relatedType,
    due_date: new Date(now.getTime() + t.offset_hours * 3600 * 1000).toISOString().split("T")[0],
  }));
}

export const READINESS_ITEMS = [
  { key: "assigned_dj",           label: "DJ Assigned",            weight: 15 },
  { key: "contract_signed",       label: "Contract Signed",        weight: 15 },
  { key: "deposit_paid",          label: "Deposit Paid",           weight: 10 },
  { key: "planning_complete",     label: "Planning Form Done",     weight: 15 },
  { key: "timeline_complete",     label: "Timeline Complete",      weight: 15 },
  { key: "music_complete",        label: "Music Selections Done",  weight: 10 },
  { key: "final_call_completed",  label: "Final Call Done",        weight: 10 },
  { key: "balance_paid",          label: "Balance Paid",           weight: 5  },
  { key: "pronunciation_complete",label: "Pronunciation List Done",weight: 5  },
];

export function calculateReadinessScore(event) {
  return READINESS_ITEMS.reduce((score, item) => score + (event[item.key] ? item.weight : 0), 0);
}

export function getReadinessMissingItems(event) {
  return READINESS_ITEMS.filter(item => !event[item.key]);
}