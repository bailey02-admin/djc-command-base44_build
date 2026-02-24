/**
 * Change Tracker — Phase 2C
 * 
 * Logs field-level changes on events (music, timeline, planning, status).
 * Flags critical changes (within 14 days of event) and creates DJ notification tasks.
 */

import { base44 } from "@/api/base44Client";
import { differenceInDays } from "date-fns";

const CRITICAL_FIELDS = new Set([
  "assigned_dj", "start_time", "end_time", "setup_time",
  "venue_name", "venue_id", "load_in_notes", "equipment_notes",
  "timeline_complete", "music_complete", "final_call_completed",
]);

function categorizeField(fieldName) {
  if (["timeline_complete"].includes(fieldName)) return "timeline";
  if (["music_complete", "special_songs_complete"].includes(fieldName)) return "music";
  if (["planning_complete", "pronunciation_complete"].includes(fieldName)) return "planning";
  if (["status"].includes(fieldName)) return "status";
  if (["assigned_dj", "assigned_mc", "assigned_finalizer"].includes(fieldName)) return "assignment";
  if (["balance_paid", "deposit_paid", "package_price"].includes(fieldName)) return "financial";
  return "general";
}

/**
 * Call this whenever an event is updated.
 * @param {object} prevEvent  The event object BEFORE the update
 * @param {object} nextValues The object being written (partial)
 * @param {string} changedBy  User email
 */
export async function trackEventChanges(prevEvent, nextValues, changedBy = "") {
  if (!prevEvent?.id) return;

  const daysUntilEvent = prevEvent.event_date
    ? differenceInDays(new Date(prevEvent.event_date), new Date())
    : null;

  const logs = [];
  const criticalChanges = [];

  for (const [field, newVal] of Object.entries(nextValues)) {
    const oldVal = prevEvent[field];
    const oldStr = oldVal === null || oldVal === undefined ? "" : String(oldVal);
    const newStr = newVal === null || newVal === undefined ? "" : String(newVal);

    if (oldStr === newStr) continue; // No change

    const isCritical =
      CRITICAL_FIELDS.has(field) &&
      daysUntilEvent !== null &&
      daysUntilEvent <= 14 &&
      daysUntilEvent >= 0;

    logs.push({
      related_type: "event",
      related_id: prevEvent.id,
      related_name: prevEvent.event_name || "",
      field_name: field,
      old_value: oldStr,
      new_value: newStr,
      changed_by: changedBy,
      change_category: categorizeField(field),
      is_critical: isCritical,
      dj_notified: false,
    });

    if (isCritical) criticalChanges.push({ field, oldStr, newStr });
  }

  if (logs.length === 0) return;

  // Bulk log all changes
  await base44.entities.ChangeLog.bulkCreate(logs);

  // If critical changes, create DJ notification task
  if (criticalChanges.length > 0 && prevEvent.assigned_dj) {
    const fieldSummary = criticalChanges.map(c => `${c.field}: "${c.oldStr}" → "${c.newStr}"`).join(", ");
    await base44.entities.Task.create({
      title: `⚠️ Client changed details — notify ${prevEvent.assigned_dj}`,
      description: `Critical change within 14 days of event.\nChanged: ${fieldSummary}`,
      category: "dj_prep",
      priority: "urgent",
      status: "pending",
      related_type: "event",
      related_id: prevEvent.id,
      related_name: prevEvent.event_name || "",
      assigned_to: prevEvent.assigned_dj,
      due_date: new Date().toISOString().split("T")[0],
    });

    await base44.entities.Activity.create({
      type: "system",
      subject: `⚠️ Critical change detected — ${daysUntilEvent} days before event`,
      description: `Field(s) changed: ${fieldSummary}. DJ notification task created.`,
      related_type: "event",
      related_id: prevEvent.id,
      related_name: prevEvent.event_name || "",
      is_internal: true,
    });
  }
}

/**
 * Returns recent changes for an event, most recent first.
 */
export async function getEventChangeHistory(eventId, limit = 30) {
  return base44.entities.ChangeLog.filter(
    { related_id: eventId, related_type: "event" },
    "-created_date",
    limit
  );
}