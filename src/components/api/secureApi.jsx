/**
 * secureApi.js — Frontend client that routes all sensitive entity reads/writes
 * through backend functions instead of direct entity SDK calls.
 *
 * Drop-in replacement for direct base44.entities.* calls on secured entities.
 */
import { base44 } from "@/api/base44Client";

const invoke = (fn, payload) => base44.functions.invoke(fn, payload).then(r => r.data);

// ─── LEADS ────────────────────────────────────────────────────────────────
export const LeadAPI = {
  list: (filters = {}, sort = "-created_date", limit = 50, skip = 0) =>
    invoke("getLeads", { filters, sort, limit, skip }).then(r => r.leads || []),

  // Returns { lead, contact } — contact is safe summary or null
  get: (id) =>
    invoke("getLeadById", { id }),

  create: (data) =>
    invoke("mutateLead", { action: "create", data }).then(r => r.lead),

  update: (id, data) =>
    invoke("mutateLead", { action: "update", id, data }).then(r => r.lead),

  save: (id, data) =>
    id
      ? invoke("mutateLead", { action: "update", id, data }).then(r => r.lead)
      : invoke("mutateLead", { action: "create", data }).then(r => r.lead),

  advanceStage: (id, data) =>
    invoke("mutateLead", { action: "advance_stage", id, data }).then(r => r.lead),

  markLost: (id, data) =>
    invoke("mutateLead", { action: "mark_lost", id, data }).then(r => r.lead),

  delete: (id) =>
    invoke("mutateLead", { action: "delete", id }),
};

// ─── EVENTS ───────────────────────────────────────────────────────────────
export const EventAPI = {
  // Returns the full { events, total, page, _timing_ms } response — callers must normalize
  list: (filters = {}, sort = "event_date", limit = 50, skip = 0, date_from, date_to) =>
    invoke("getEvents", { filters, sort, limit, skip, date_from, date_to }),

  /** Returns { event, activities, tasks, payments, musicSelections, timeline } */
  getDetailBundle: (id) =>
    invoke("getEventDetail", { id }),

  create: (data) =>
    invoke("mutateEvent", { action: "create", data }).then(r => r.event),

  update: (id, data) =>
    invoke("mutateEvent", { action: "update", id, data }).then(r => r.event),

  toggleReadiness: (id, data) =>
    invoke("mutateEvent", { action: "toggle_readiness", id, data }).then(r => r.event),

  assignDJ: (id, data) =>
    invoke("mutateEvent", { action: "assign_dj", id, data }).then(r => r.event),

  markDJReviewed: (id) =>
    invoke("mutateEvent", { action: "mark_dj_reviewed", id }).then(r => r.event),

  delete: (id) =>
    invoke("mutateEvent", { action: "delete", id }),
};

// ─── ACTIVITIES ───────────────────────────────────────────────────────────
export const ActivityAPI = {
  forRecord: (related_id, limit = 50) =>
    invoke("getActivities", { related_id, limit }).then(r => r.activities || []),

  create: (data) =>
    invoke("mutateActivity", { data }).then(r => r.activity),
};

// ─── TASKS ────────────────────────────────────────────────────────────────
export const TaskAPI = {
  list: (filters = {}, sort = "-due_date", limit = 50, skip = 0) =>
    invoke("getTasks", { filters, sort, limit, skip }).then(r => r.tasks || []),

  forRecord: (related_id, sort = "-created_date", limit = 20) =>
    invoke("getTasks", { related_id, sort, limit }).then(r => r.tasks || []),

  create: (data) =>
    invoke("mutateTasks", { action: "create", data }).then(r => r.task),

  bulkCreate: (tasks, batch_id) =>
    invoke("bulkCreateTasks", { tasks, ...(batch_id ? { batch_id } : {}) }).then(r => r.tasks || []),

  complete: (id) =>
    invoke("mutateTasks", { action: "complete", id }).then(r => r.task),

  update: (id, data) =>
    invoke("mutateTasks", { action: "update", id, data }).then(r => r.task),

  delete: (id) =>
    invoke("mutateTasks", { action: "delete", id }),
};

// ─── PAYMENTS ─────────────────────────────────────────────────────────────
export const PaymentAPI = {
  list: (limit = 50, skip = 0, filters = {}) =>
    invoke("getPayments", { limit, skip, filters }).then(r => r.payments || []),

  forEvent: (event_id) =>
    invoke("getPayments", { event_id }).then(r => r.payments || []),

  create: (data) =>
    invoke("mutatePayment", { action: "create", data }).then(r => r.payment),

  update: (id, data) =>
    invoke("mutatePayment", { action: "update", id, data }).then(r => r.payment),

  delete: (id) =>
    invoke("mutatePayment", { action: "delete", id }),
};

// ─── REPORTS ──────────────────────────────────────────────────────────────
export const ReportAPI = {
  getSummary: (city_filter = "all", date_from, date_to) =>
    invoke("getReportSummary", { city_filter, date_from, date_to }),
};

// ─── CONTACTS ─────────────────────────────────────────────────────────────
export const ContactAPI = {
  list: (filters = {}, sort = "-created_date", limit = 50, skip = 0) =>
    invoke("getContacts", { filters, sort, limit, skip }).then(r => r.contacts || []),

  get: (id) =>
    invoke("getContacts", { id }).then(r => r.contact),

  create: (data) =>
    invoke("mutateContact", { action: "create", data }).then(r => r.contact),

  update: (id, data) =>
    invoke("mutateContact", { action: "update", id, data }).then(r => r.contact),

  delete: (id) =>
    invoke("mutateContact", { action: "delete", id }),
};

// ─── QUOTES ───────────────────────────────────────────────────────────────
export const QuoteAPI = {
  list: (filters = {}, sort = "-created_date", limit = 50, skip = 0) =>
    invoke("getQuotes", { filters, sort, limit, skip }).then(r => r.quotes || []),

  forLead: (lead_id) =>
    invoke("getQuotes", { lead_id, sort: "-created_date", limit: 20 }).then(r => r.quotes || []),

  create: (data) =>
    invoke("mutateQuote", { action: "create", data }).then(r => r.quote),

  update: (id, data) =>
    invoke("mutateQuote", { action: "update", id, data }).then(r => r.quote),

  send: (id) =>
    invoke("mutateQuote", { action: "send", id }).then(r => r.quote),

  accept: (id) =>
    invoke("mutateQuote", { action: "accept", id }).then(r => r.quote),

  decline: (id) =>
    invoke("mutateQuote", { action: "decline", id }).then(r => r.quote),

  delete: (id) =>
    invoke("mutateQuote", { action: "delete", id }),
};

// ─── CONTRACTS ────────────────────────────────────────────────────────────
export const ContractAPI = {
  list: (filters = {}, sort = "-created_date", limit = 50, skip = 0) =>
    invoke("getContracts", { filters, sort, limit, skip }).then(r => r.contracts || []),

  forEvent: (event_id) =>
    invoke("getContracts", { filters: { event_id }, sort: "-created_date", limit: 10 }).then(r => r.contracts || []),

  create: (data) =>
    invoke("mutateContract", { action: "create", data }).then(r => r.contract),

  update: (id, data) =>
    invoke("mutateContract", { action: "update", id, data }).then(r => r.contract),

  send: (id) =>
    invoke("mutateContract", { action: "send", id }).then(r => r.contract),

  sign: (id, signer_name) =>
    invoke("mutateContract", { action: "sign", id, data: { signer_name } }).then(r => r.contract),

  void: (id) =>
    invoke("mutateContract", { action: "void", id }).then(r => r.contract),

  delete: (id) =>
    invoke("mutateContract", { action: "delete", id }),
};

// ─── TASK ENGINE (server-side canonical entrypoint) ───────────────────────
export const TaskEngineAPI = {
  createFromTrigger: (trigger, related_id, related_name, related_type = "lead", event_date = null, assigned_to = null) =>
    invoke("taskEngine", { action: "create_from_trigger", trigger, related_id, related_name, related_type, event_date, assigned_to }),

  createSingle: (data) =>
    invoke("taskEngine", { action: "create_single", data }),

  detectOverdue: (related_id, related_type = "event") =>
    invoke("taskEngine", { action: "detect_overdue", related_id, related_type }),
};

// ─── MESSAGING (backend-resolved merge tags + send) ───────────────────────
export const MessageAPI = {
  preview: (template_id, template_body, template_subject, lead_id, event_id, contact_id) =>
    invoke("sendMessage", { action: "preview", template_id, template_body, template_subject, lead_id, event_id, contact_id }),

  send: (opts) =>
    invoke("sendMessage", { action: "send", ...opts }),
};

// ─── CLIENT CHANGE TRACKING ───────────────────────────────────────────────
export const ChangeTrackAPI = {
  trackClientEdit: (event_id, entity_type, change_description, changed_by) =>
    invoke("trackClientChanges", { event_id, entity_type, change_description, changed_by }),
};

// ─── GLOBAL SEARCH ────────────────────────────────────────────────────────
export const SearchAPI = {
  search: (q, limit = 5) =>
    invoke("globalSearch", { q, limit }).then(r => r.results || {}),
};

// ─── ARCHIVE / RESTORE ────────────────────────────────────────────────────
export const ArchiveAPI = {
  restore: (entity_type, id) =>
    invoke("restoreRecord", { entity_type, id }),
};

// ─── LEAD CONVERSION ──────────────────────────────────────────────────────────
export const ConversionAPI = {
  convertLeadToEvent: (lead_id) =>
    invoke("convertLeadToEvent", { lead_id }),
};

// ─── ADMIN OPS ────────────────────────────────────────────────────────────
export const AdminAPI = {
  resetDemoData: () =>
    invoke("adminResetTestData", {}),

  seedDemoData: () =>
    invoke("adminSeedDemoData", {}),

  wipeAllLeadsEvents: () =>
    invoke("adminWipeAllLeadsEvents", {}),
};

// ─── MUSIC + TIMELINE ─────────────────────────────────────────────────────────
export const MusicAPI = {
  list: (event_id) =>
    invoke("getMusicTimeline", { entity: "MusicSelection", event_id }).then(r => r.records || []),

  create: (event_id, data) =>
    invoke("mutateMusicTimeline", { entity: "MusicSelection", action: "create", event_id, data: { ...data, event_id } }).then(r => r.record),

  delete: (id) =>
    invoke("mutateMusicTimeline", { entity: "MusicSelection", action: "delete", id }),
};

export const TimelineAPI = {
  list: (event_id) =>
    invoke("getMusicTimeline", { entity: "TimelineItem", event_id }).then(r => r.records || []),

  create: (event_id, data) =>
    invoke("mutateMusicTimeline", { entity: "TimelineItem", action: "create", event_id, data: { ...data, event_id } }).then(r => r.record),

  bulkCreate: (event_id, items) =>
    invoke("mutateMusicTimeline", { entity: "TimelineItem", action: "bulkCreate", event_id, items: items.map(i => ({ ...i, event_id })) }),

  delete: (id) =>
    invoke("mutateMusicTimeline", { entity: "TimelineItem", action: "delete", id }),
};

// ─── FLAG SYNC + PAYMENT SCHEDULE ─────────────────────────────────────────
export const EventOpsAPI = {
  syncFlags: (event_id) =>
    invoke("syncEventFlags", { action: "sync_flags", event_id }),

  createPaymentSchedule: (event_id, opts = {}) =>
    invoke("syncEventFlags", { action: "create_payment_schedule", event_id, ...opts }),
};