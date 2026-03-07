export const PIPELINE_STAGES = [
  { key: "new_inquiry",            label: "New Inquiry",            color: "bg-gray-100 text-gray-700",    dot: "bg-gray-400",    required_fields: [] },
  { key: "attempted_contact",      label: "Attempted Contact",      color: "bg-orange-50 text-orange-700", dot: "bg-orange-400",  required_fields: ["phone"] },
  { key: "contacted",              label: "Contacted",              color: "bg-yellow-50 text-yellow-700", dot: "bg-yellow-400",  required_fields: ["phone","first_response_date"] },
  { key: "qualified",              label: "Qualified",              color: "bg-blue-50 text-blue-700",     dot: "bg-blue-400",    required_fields: ["event_date", "city", "lead_source"] },
  { key: "consultation_scheduled", label: "Consultation Scheduled", color: "bg-indigo-50 text-indigo-700", dot: "bg-indigo-400",  required_fields: ["event_date", "city", "consultation_date"] },
  { key: "consultation_completed", label: "Consultation Completed", color: "bg-violet-50 text-violet-700", dot: "bg-violet-400",  required_fields: ["event_date", "city"] },
  { key: "quote_sent",             label: "Quote Sent",             color: "bg-purple-50 text-purple-700", dot: "bg-purple-400",  required_fields: ["event_date", "city", "quote_amount", "package_name", "assigned_rep"] },
  { key: "follow_up",              label: "Follow Up",              color: "bg-amber-50 text-amber-700",   dot: "bg-amber-400",   required_fields: ["quote_sent_date"] },
  { key: "deposit_requested",      label: "Deposit Requested",      color: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-400", required_fields: ["deposit_amount", "total_fee"] },
  { key: "booked",                 label: "Booked",                 color: "bg-green-100 text-green-800",  dot: "bg-green-500",   required_fields: ["event_date", "city", "deposit_amount", "total_fee", "booked_date"] },
  { key: "lost",                   label: "Lost",                   color: "bg-red-50 text-red-700",       dot: "bg-red-400",     required_fields: ["lost_reason"] },
  { key: "ghosted",                label: "Ghosted",                color: "bg-gray-100 text-gray-500",    dot: "bg-gray-300",    required_fields: ["no_response_count"] },
  { key: "disqualified",           label: "Disqualified",           color: "bg-zinc-100 text-zinc-500",    dot: "bg-zinc-400",    required_fields: [] },
];

export const STAGE_MAP = Object.fromEntries(PIPELINE_STAGES.map(s => [s.key, s]));

export function getMissingFieldsForStage(lead, targetStage) {
  const stage = STAGE_MAP[targetStage];
  if (!stage) return [];
  return stage.required_fields.filter(field => {
    const val = lead[field];
    return val === null || val === undefined || val === "" || (typeof val === "number" && isNaN(val));
  });
}

export function canAdvanceToStage(lead, targetStage) {
  return getMissingFieldsForStage(lead, targetStage).length === 0;
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