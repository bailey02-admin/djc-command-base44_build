/**
 * CRM Automation Orchestrator
 * Fires real DB writes on trigger events.
 * Uses taskEngine for task generation, logs to AutomationLog + Activity.
 */
import { base44 } from "@/api/base44Client";
import { TaskAPI, ActivityAPI, LeadAPI } from "../api/secureApi";
import { buildTasks, completeTask } from "./taskEngine";
import { calculateSLAStatus } from "./pipeline";

// ─── New Lead ─────────────────────────────────────────────────────────────
export async function onNewLead(lead) {
  const relatedName = `${lead.client_first_name} ${lead.client_last_name}`;
  const tasks = buildTasks("new_inquiry", lead.id, relatedName, "lead");

  if (tasks.length > 0) await TaskAPI.bulkCreate(tasks);

  await base44.entities.AutomationLog.create({
    trigger: "new_lead",
    related_type: "lead",
    related_id: lead.id,
    related_name: relatedName,
    tasks_created: tasks.length,
    notes: `Auto-created ${tasks.length} tasks for new inquiry`,
  });

  await ActivityAPI.create({
    type: "system",
    subject: "New lead created — tasks auto-generated",
    related_type: "lead",
    related_id: lead.id,
    related_name: relatedName,
    is_internal: true,
  });
}

// ─── Stage Change ─────────────────────────────────────────────────────────
export async function onStageChange(lead, newStage) {
  const relatedName = `${lead.client_first_name} ${lead.client_last_name}`;
  const templateKeys = {
    attempted_contact:      "attempted_contact",
    qualified:              "qualified",
    consultation_completed: "consultation_completed",
    quote_sent:             "quote_sent",
    deposit_requested:      "deposit_requested",
    booked:                 "booked",
  };
  const templateKey = templateKeys[newStage];

  if (templateKey) {
    const tasks = buildTasks(templateKey, lead.id, relatedName, "lead");
    if (tasks.length > 0) {
      await TaskAPI.bulkCreate(tasks);
      await base44.entities.AutomationLog.create({
        trigger: `stage_${newStage}`,
        related_type: "lead",
        related_id: lead.id,
        related_name: relatedName,
        tasks_created: tasks.length,
        notes: `Stage → ${newStage}: created ${tasks.length} tasks`,
      });
    }
  }

  await ActivityAPI.create({
    type: "status_change",
    subject: `Stage → ${newStage.replace(/_/g, " ")}`,
    related_type: "lead",
    related_id: lead.id,
    related_name: relatedName,
    is_internal: true,
  });
}

// ─── Event Booked ─────────────────────────────────────────────────────────
export async function onEventBooked(event) {
  const eventDate = event.event_date ? new Date(event.event_date) : null;
  const daysUntil = eventDate ? Math.floor((eventDate - new Date()) / (1000 * 60 * 60 * 24)) : null;
  if (daysUntil === null) return;

  const templateKeys = [];
  if (daysUntil > 90) templateKeys.push("event_90_days");
  if (daysUntil > 60) templateKeys.push("event_60_days");
  if (daysUntil > 30) templateKeys.push("event_30_days");
  if (daysUntil > 14) templateKeys.push("event_14_days");
  if (daysUntil <= 14) templateKeys.push("event_7_days");

  const allTasks = templateKeys.flatMap(key =>
    buildTasks(key, event.id, event.event_name, "event", event.event_date)
  );

  if (allTasks.length > 0) {
    await TaskAPI.bulkCreate(allTasks);
    await base44.entities.AutomationLog.create({
      trigger: "event_booked",
      related_type: "event",
      related_id: event.id,
      related_name: event.event_name,
      tasks_created: allTasks.length,
      notes: `${daysUntil} days out — created tasks from: ${templateKeys.join(", ")}`,
    });
  }

  await ActivityAPI.create({
    type: "status_change",
    subject: "Event booked — planning tasks generated",
    related_type: "event",
    related_id: event.id,
    related_name: event.event_name,
    is_internal: true,
  });
}

// ─── Event Completed ──────────────────────────────────────────────────────
export async function onEventCompleted(event) {
  const tasks = buildTasks("event_completed", event.id, event.event_name, "event");
  if (tasks.length > 0) {
    await TaskAPI.bulkCreate(tasks);
    await base44.entities.AutomationLog.create({
      trigger: "event_completed",
      related_type: "event",
      related_id: event.id,
      related_name: event.event_name,
      tasks_created: tasks.length,
      notes: "Post-event survey + review tasks",
    });
  }
}

// ─── Survey Low Score ─────────────────────────────────────────────────────
export async function onSurveyLowScore(event) {
  const tasks = buildTasks("survey_low_score", event.id, event.event_name, "event");
  if (tasks.length > 0) {
    await TaskAPI.bulkCreate(tasks);
    await ActivityAPI.create({
      type: "system",
      subject: `⚠️ Low survey score — service recovery initiated`,
      description: `Survey score: ${event.survey_score}`,
      related_type: "event",
      related_id: event.id,
      related_name: event.event_name,
      is_internal: true,
    });
  }
}

// ─── First Response Logger ────────────────────────────────────────────────
export async function logFirstResponse(lead) {
  const now = new Date().toISOString();
  const slaStatus = calculateSLAStatus(lead.inquiry_date, now);
  const elapsed = lead.inquiry_date
    ? Math.round((new Date(now) - new Date(lead.inquiry_date)) / 60000)
    : null;

  await LeadAPI.update(lead.id, {
    first_response_date: now,
    last_contact_date: now,
    sla_status: slaStatus,
    sla_minutes_elapsed: elapsed,
  });

  await ActivityAPI.create({
    type: "system",
    subject: `First response logged — ${slaStatus.replace(/_/g, " ")} (${elapsed}m)`,
    related_type: "lead",
    related_id: lead.id,
    related_name: `${lead.client_first_name} ${lead.client_last_name}`,
    is_internal: true,
  });

  return { slaStatus, elapsed };
}

// ─── Re-export completeTask for use in UI ─────────────────────────────────
export { completeTask };