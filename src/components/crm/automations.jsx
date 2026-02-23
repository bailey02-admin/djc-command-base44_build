import { base44 } from "@/api/base44Client";
import { buildTasksFromTemplate, calculateSLAStatus } from "./pipeline";

export async function onNewLead(lead) {
  const relatedName = `${lead.client_first_name} ${lead.client_last_name}`;
  const tasks = buildTasksFromTemplate("new_lead", lead.id, relatedName, "lead");
  if (tasks.length > 0) await base44.entities.Task.bulkCreate(tasks);
  await base44.entities.AutomationLog.create({
    trigger: "new_lead",
    related_type: "lead",
    related_id: lead.id,
    related_name: relatedName,
    tasks_created: tasks.length,
    notes: "Auto-created call now + follow-up tasks",
  });
}

export async function onStageChange(lead, newStage) {
  const relatedName = `${lead.client_first_name} ${lead.client_last_name}`;
  const templateMap = { quote_sent: "quote_sent", deposit_requested: "deposit_requested" };
  const templateKey = templateMap[newStage];

  if (templateKey) {
    const tasks = buildTasksFromTemplate(templateKey, lead.id, relatedName, "lead");
    if (tasks.length > 0) {
      await base44.entities.Task.bulkCreate(tasks);
      await base44.entities.AutomationLog.create({
        trigger: `stage_${newStage}`,
        related_type: "lead",
        related_id: lead.id,
        related_name: relatedName,
        tasks_created: tasks.length,
      });
    }
  }

  await base44.entities.Activity.create({
    type: "status_change",
    subject: `Stage → ${newStage.replace(/_/g, " ")}`,
    related_type: "lead",
    related_id: lead.id,
    related_name: relatedName,
    is_internal: true,
  });
}

export async function onEventBooked(event) {
  const daysUntil = event.event_date
    ? Math.floor((new Date(event.event_date) - new Date()) / (1000 * 60 * 60 * 24))
    : null;
  if (daysUntil === null) return;

  const tasks = [
    ...(daysUntil > 60 ? buildTasksFromTemplate("event_60_days", event.id, event.event_name, "event") : []),
    ...(daysUntil > 30 ? buildTasksFromTemplate("event_30_days", event.id, event.event_name, "event") : []),
    ...(daysUntil > 14 ? buildTasksFromTemplate("event_14_days", event.id, event.event_name, "event") : []),
  ];

  if (tasks.length > 0) {
    await base44.entities.Task.bulkCreate(tasks);
    await base44.entities.AutomationLog.create({
      trigger: "event_booked",
      related_type: "event",
      related_id: event.id,
      related_name: event.event_name,
      tasks_created: tasks.length,
    });
  }
}

export async function logFirstResponse(lead) {
  const now = new Date().toISOString();
  const slaStatus = calculateSLAStatus(lead.inquiry_date, now);
  const elapsed = lead.inquiry_date
    ? Math.round((new Date(now) - new Date(lead.inquiry_date)) / 60000)
    : null;

  await base44.entities.Lead.update(lead.id, {
    first_response_date: now,
    last_contact_date: now,
    sla_status: slaStatus,
    sla_minutes_elapsed: elapsed,
  });
  return { slaStatus, elapsed };
}