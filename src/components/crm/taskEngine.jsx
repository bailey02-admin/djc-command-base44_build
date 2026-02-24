/**
 * Task Automation Engine — Phase 2B
 * 
 * Handles: template-based task creation, overdue detection,
 * recurring tasks, "next best action" logic, completion logging.
 */

import { base44 } from "@/api/base44Client";
import { differenceInDays, addDays, isPast, isToday, format } from "date-fns";

// ─── Enhanced Task Templates ───────────────────────────────────────────────
// offset_days: relative to "now" for lead tasks, relative to event_date for event tasks
// event_relative: if true, offset is from event_date (negative = before event)

export const TASK_TEMPLATES = {
  // Lead pipeline triggers
  new_inquiry: [
    { title: "Call/text new lead NOW", category: "call", priority: "urgent", offset_days: 0 },
    { title: "Send initial outreach email", category: "email", priority: "urgent", offset_days: 0 },
    { title: "Follow up if no response (24h)", category: "follow_up", priority: "high", offset_days: 1 },
  ],
  attempted_contact: [
    { title: "Second contact attempt", category: "call", priority: "high", offset_days: 1 },
    { title: "Third attempt + SMS", category: "call", priority: "medium", offset_days: 3 },
  ],
  qualified: [
    { title: "Schedule consultation call", category: "call", priority: "high", offset_days: 1 },
  ],
  consultation_completed: [
    { title: "Send quote within 24h", category: "email", priority: "high", offset_days: 1 },
  ],
  quote_sent: [
    { title: "Quote follow-up (24h)", category: "follow_up", priority: "high", offset_days: 1 },
    { title: "Quote follow-up (72h)", category: "follow_up", priority: "medium", offset_days: 3 },
    { title: "Final quote follow-up (7 days)", category: "follow_up", priority: "medium", offset_days: 7 },
  ],
  deposit_requested: [
    { title: "Deposit reminder (48h)", category: "payment", priority: "high", offset_days: 2 },
    { title: "Deposit reminder — final notice (5 days)", category: "payment", priority: "urgent", offset_days: 5 },
  ],
  booked: [
    { title: "Send booking confirmation email", category: "email", priority: "high", offset_days: 0 },
    { title: "Send contract for signature", category: "contract", priority: "high", offset_days: 1 },
    { title: "Collect remaining deposit if needed", category: "payment", priority: "medium", offset_days: 2 },
  ],

  // Event milestone triggers (event_relative: true = days from event_date)
  event_90_days: [
    { title: "Send planning form link to client", category: "planning", priority: "medium", offset_days: 0 },
  ],
  event_60_days: [
    { title: "Follow up on planning form completion", category: "planning", priority: "high", offset_days: 0 },
    { title: "Verify venue logistics", category: "planning", priority: "medium", offset_days: 0 },
  ],
  event_30_days: [
    { title: "Timeline review — 30 days out", category: "finalization", priority: "high", offset_days: 0 },
    { title: "Confirm balance payment due date", category: "payment", priority: "high", offset_days: 0 },
    { title: "Request final music selections", category: "planning", priority: "medium", offset_days: 0 },
  ],
  event_14_days: [
    { title: "Schedule final client call", category: "finalization", priority: "urgent", offset_days: 0 },
    { title: "Confirm DJ assignment", category: "dj_prep", priority: "urgent", offset_days: 0 },
  ],
  event_7_days: [
    { title: "Conduct final client call", category: "finalization", priority: "urgent", offset_days: 0 },
    { title: "Brief DJ with event sheet", category: "dj_prep", priority: "urgent", offset_days: 0 },
    { title: "Confirm venue contact day-of", category: "finalization", priority: "high", offset_days: 0 },
    { title: "Verify final balance paid", category: "payment", priority: "high", offset_days: 0 },
  ],
  event_completed: [
    { title: "Send post-event survey (24h)", category: "survey", priority: "medium", offset_days: 1 },
    { title: "Request Google/Knot review (3 days)", category: "review", priority: "medium", offset_days: 3 },
  ],
  survey_low_score: [
    { title: "⚠️ SERVICE RECOVERY — contact client within 24h", category: "follow_up", priority: "urgent", offset_days: 0 },
    { title: "Escalate to city manager", category: "follow_up", priority: "urgent", offset_days: 0 },
  ],
};

// ─── Build tasks from template key ────────────────────────────────────────
export function buildTasks(templateKey, relatedId, relatedName, relatedType = "lead", eventDate = null, assignedTo = null) {
  const templates = TASK_TEMPLATES[templateKey] || [];
  const now = new Date();

  return templates.map(t => {
    let dueDate;
    if (eventDate && t.event_relative) {
      dueDate = addDays(new Date(eventDate), t.offset_days).toISOString().split("T")[0];
    } else {
      dueDate = addDays(now, t.offset_days).toISOString().split("T")[0];
    }

    return {
      title: t.title,
      category: t.category,
      priority: t.priority,
      status: "pending",
      related_id: relatedId,
      related_name: relatedName,
      related_type: relatedType,
      due_date: dueDate,
      ...(assignedTo ? { assigned_to: assignedTo } : {}),
    };
  });
}

// ─── Complete a task + log to Activity ────────────────────────────────────
export async function completeTask(task, notes = "", completedBy = "") {
  const now = new Date().toISOString();
  await base44.entities.Task.update(task.id, {
    status: "completed",
    completed_date: now,
    notes: notes || task.notes,
  });

  await base44.entities.Activity.create({
    type: "note",
    subject: `✓ Task completed: ${task.title}`,
    description: notes || "",
    related_type: task.related_type,
    related_id: task.related_id,
    related_name: task.related_name,
    outcome: "completed",
    performed_by: completedBy,
    is_internal: true,
  });
}

// ─── Overdue / escalation check ───────────────────────────────────────────
export function getOverdueFlag(task) {
  if (!task.due_date || task.status === "completed" || task.status === "cancelled") return null;
  const due = new Date(task.due_date);
  const days = differenceInDays(new Date(), due);
  if (days > 3 && task.priority === "urgent") return "critical";
  if (days > 0) return "overdue";
  if (isToday(due)) return "due_today";
  return null;
}

// ─── Next Best Action logic ────────────────────────────────────────────────
/**
 * Returns the most urgent suggested next action for a lead.
 * Priority order: SLA breach → urgent tasks → overdue tasks → stage-based suggestion
 */
export function getNextBestAction(lead, tasks = []) {
  // SLA breach
  if (!lead.first_response_date && lead.inquiry_date) {
    const elapsed = (Date.now() - new Date(lead.inquiry_date).getTime()) / 60000;
    if (elapsed > 15) {
      return {
        type: "urgent",
        icon: "phone",
        label: "Call/text immediately — SLA at risk",
        detail: `${Math.round(elapsed)}m since inquiry`,
      };
    }
  }

  // Overdue urgent tasks
  const overdueUrgent = tasks.find(t => t.status === "pending" && t.priority === "urgent" && t.due_date && isPast(new Date(t.due_date)));
  if (overdueUrgent) return { type: "overdue", icon: "alert", label: overdueUrgent.title, detail: `Overdue since ${overdueUrgent.due_date}` };

  // Pending urgent tasks
  const urgentTask = tasks.find(t => t.status === "pending" && t.priority === "urgent");
  if (urgentTask) return { type: "task", icon: "task", label: urgentTask.title, detail: `Due ${urgentTask.due_date}` };

  // Stage-based suggestions
  const stageSuggestions = {
    new_inquiry:             { type: "action", icon: "phone", label: "Make first contact", detail: "Respond to inquiry" },
    attempted_contact:       { type: "action", icon: "phone", label: "Retry contact", detail: "No response yet" },
    contacted:               { type: "action", icon: "calendar", label: "Schedule consultation", detail: "Move to qualified" },
    qualified:               { type: "action", icon: "calendar", label: "Book consultation call", detail: "" },
    consultation_completed:  { type: "action", icon: "mail", label: "Send quote", detail: "Within 24h of consultation" },
    quote_sent:              { type: "action", icon: "mail", label: "Follow up on quote", detail: "Has it been 24h?" },
    follow_up:               { type: "action", icon: "phone", label: "Call to close", detail: "Ask for the deposit" },
    deposit_requested:       { type: "action", icon: "dollar", label: "Confirm deposit received", detail: "" },
  };

  return stageSuggestions[lead.pipeline_stage] || null;
}

// ─── Next Best Action for Events ──────────────────────────────────────────
export function getEventNextBestAction(event, tasks = []) {
  if (!event.event_date) return null;
  const daysUntil = differenceInDays(new Date(event.event_date), new Date());

  if (!event.assigned_dj && daysUntil <= 30) return { type: "urgent", icon: "alert", label: "Assign DJ immediately", detail: `Event in ${daysUntil} days` };
  if (!event.contract_signed) return { type: "action", icon: "file", label: "Collect signed contract", detail: "" };
  if (!event.deposit_paid) return { type: "action", icon: "dollar", label: "Confirm deposit received", detail: "" };
  if (!event.planning_complete && daysUntil <= 60) return { type: "action", icon: "task", label: "Send/follow up planning form", detail: "" };
  if (!event.final_call_completed && daysUntil <= 14) return { type: "urgent", icon: "phone", label: "Schedule final call NOW", detail: `${daysUntil} days out` };
  if (!event.balance_paid && daysUntil <= 7) return { type: "urgent", icon: "dollar", label: "Confirm final balance", detail: `${daysUntil} days out` };
  if (!event.dj_briefed && daysUntil <= 7) return { type: "urgent", icon: "alert", label: "Brief the DJ", detail: `${daysUntil} days out` };

  // Overdue task
  const overdueTask = tasks.find(t => t.status === "pending" && t.due_date && isPast(new Date(t.due_date)));
  if (overdueTask) return { type: "task", icon: "task", label: overdueTask.title, detail: `Overdue` };

  return { type: "ok", icon: "check", label: "Event on track", detail: "" };
}

// ─── Recurring task support ────────────────────────────────────────────────
// Basic: re-create the same task N days after completion.
// Call this on task completion to schedule next occurrence.
export async function scheduleRecurringTask(task, intervalDays) {
  if (!intervalDays || intervalDays <= 0) return;
  const nextDue = addDays(new Date(), intervalDays).toISOString().split("T")[0];
  await base44.entities.Task.create({
    title: task.title,
    category: task.category,
    priority: task.priority,
    status: "pending",
    related_id: task.related_id,
    related_name: task.related_name,
    related_type: task.related_type,
    due_date: nextDue,
    assigned_to: task.assigned_to,
    notes: `Recurring — created from task completed on ${format(new Date(), "MMM d, yyyy")}`,
  });
}