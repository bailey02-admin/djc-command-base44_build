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
  list: (filters = {}, sort = "-created_date", limit = 200) =>
    invoke("getLeads", { filters, sort, limit }).then(r => r.leads || []),

  get: (id) =>
    invoke("getLeadById", { id }).then(r => r.lead),

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
  list: (filters = {}, sort = "-event_date", limit = 100) =>
    invoke("getEvents", { filters, sort, limit }).then(r => r.events || []),

  /** Returns { event, activities, tasks, payments, musicSelections, timeline } */
  getDetailBundle: (id) =>
    invoke("getEventDetail", { id }),

  create: (data) =>
    invoke("mutateEvent", { action: "create", data }).then(r => r.event),

  update: (id, data) =>
    invoke("mutateEvent", { action: "update", id, data }).then(r => r.event),

  toggleReadiness: (id, data) =>
    invoke("mutateEvent", { action: "toggle_readiness", id, data }).then(r => r.event),

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
  list: (filters = {}, sort = "-due_date", limit = 200) =>
    invoke("getTasks", { filters, sort, limit }).then(r => r.tasks || []),

  forRecord: (related_id, sort = "-created_date", limit = 20) =>
    invoke("getTasks", { related_id, sort, limit }).then(r => r.tasks || []),

  create: (data) =>
    invoke("mutateTasks", { action: "create", data }).then(r => r.task),

  bulkCreate: (tasks) =>
    Promise.all(tasks.map(t => invoke("mutateTasks", { action: "create", data: t }).then(r => r.task))),

  complete: (id) =>
    invoke("mutateTasks", { action: "complete", id }).then(r => r.task),

  update: (id, data) =>
    invoke("mutateTasks", { action: "update", id, data }).then(r => r.task),

  delete: (id) =>
    invoke("mutateTasks", { action: "delete", id }),
};

// ─── PAYMENTS ─────────────────────────────────────────────────────────────
export const PaymentAPI = {
  list: (limit = 100) =>
    invoke("getPayments", { limit }).then(r => r.payments || []),

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
  getSummary: (city_filter = "all") =>
    invoke("getReportSummary", { city_filter }),
};

// ─── CONTACTS ─────────────────────────────────────────────────────────────
export const ContactAPI = {
  list: (filters = {}, sort = "-created_date", limit = 200) =>
    invoke("getContacts", { filters, sort, limit }).then(r => r.contacts || []),

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
  list: (filters = {}, sort = "-created_date", limit = 200) =>
    invoke("getContracts", { filters, sort, limit }).then(r => r.contracts || []),

  forLead: (lead_id) =>
    base44.entities.Quote.filter({ lead_id }, "-created_date", 20),

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
  list: (filters = {}, sort = "-created_date", limit = 200) =>
    base44.entities.Contract.filter(filters, sort, limit),

  forEvent: (event_id) =>
    base44.entities.Contract.filter({ event_id }, "-created_date", 10),

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

// ─── FLAG SYNC + PAYMENT SCHEDULE ─────────────────────────────────────────
export const EventOpsAPI = {
  syncFlags: (event_id) =>
    invoke("syncEventFlags", { action: "sync_flags", event_id }),

  createPaymentSchedule: (event_id, opts = {}) =>
    invoke("syncEventFlags", { action: "create_payment_schedule", event_id, ...opts }),
};