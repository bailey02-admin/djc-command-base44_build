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

  create: (data) =>
    invoke("mutateEvent", { action: "create", data }).then(r => r.event),

  update: (id, data) =>
    invoke("mutateEvent", { action: "update", id, data }).then(r => r.event),

  toggleReadiness: (id, data) =>
    invoke("mutateEvent", { action: "toggle_readiness", id, data }).then(r => r.event),

  delete: (id) =>
    invoke("mutateEvent", { action: "delete", id }),
};

// ─── TASKS ────────────────────────────────────────────────────────────────
export const TaskAPI = {
  list: (filters = {}, sort = "-due_date", limit = 200) =>
    invoke("getTasks", { filters, sort, limit }).then(r => r.tasks || []),

  forRecord: (related_id, sort = "-created_date", limit = 20) =>
    invoke("getTasks", { related_id, sort, limit }).then(r => r.tasks || []),

  create: (data) =>
    invoke("mutateTasks", { action: "create", data }).then(r => r.task),

  complete: (id) =>
    invoke("mutateTasks", { action: "complete", id }).then(r => r.task),

  update: (id, data) =>
    invoke("mutateTasks", { action: "update", id, data }).then(r => r.task),

  delete: (id) =>
    invoke("mutateTasks", { action: "delete", id }),
};

// ─── ACTIVITIES ───────────────────────────────────────────────────────────
export const ActivityAPI = {
  forRecord: (related_id, limit = 50) =>
    invoke("getActivities", { related_id, limit }).then(r => r.activities || []),
};

// ─── PAYMENTS ─────────────────────────────────────────────────────────────
export const PaymentAPI = {
  list: (limit = 100) =>
    invoke("getPayments", { limit }).then(r => r.payments || []),

  forEvent: (event_id) =>
    invoke("getPayments", { event_id }).then(r => r.payments || []),
};