/**
 * Post-event automation backend function.
 * Actions:
 *   event_completed  — fires when status moves to event_completed
 *   survey_received  — fires when survey_score is added/updated
 *
 * Idempotency: checks AutomationLog for existing trigger+event_id before acting.
 * Logs to AutomationLog + Activity feed.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const POST_EVENT_TASKS = [
  {
    title: "Send post-event survey to client",
    category: "survey",
    priority: "high",
    due_days: 1,
  },
  {
    title: "Request Google/Yelp/Knot review",
    category: "review",
    priority: "medium",
    due_days: 3,
  },
  {
    title: "Debrief with DJ — any issues?",
    category: "follow_up",
    priority: "medium",
    due_days: 2,
  },
  {
    title: "Update event status to closed_won",
    category: "other",
    priority: "low",
    due_days: 7,
  },
];

const LOW_SCORE_TASKS = [
  {
    title: "Service recovery call — review low survey score",
    category: "call",
    priority: "urgent",
    due_days: 0,
  },
  {
    title: "Internal debrief on event issues",
    category: "other",
    priority: "high",
    due_days: 1,
  },
];

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

async function isAlreadyFired(base44, trigger, event_id) {
  const logs = await base44.asServiceRole.entities.AutomationLog.filter({ trigger, related_id: event_id }, "-created_date", 1);
  return logs.length > 0;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action, event_id } = body;

    if (!event_id) return Response.json({ error: "event_id required" }, { status: 400 });

    // Fetch event
    const eventArr = await base44.asServiceRole.entities.Event.filter({ id: event_id });
    const event = eventArr[0];
    if (!event) return Response.json({ error: "Event not found" }, { status: 404 });

    // ── EVENT COMPLETED ────────────────────────────────────────────
    if (action === "event_completed") {
      // Idempotency check
      const alreadyFired = await isAlreadyFired(base44, "event_completed", event_id);
      if (alreadyFired) {
        return Response.json({ skipped: true, reason: "Already fired for this event" });
      }

      const tasks = POST_EVENT_TASKS.map(t => ({
        title: t.title,
        category: t.category,
        priority: t.priority,
        due_date: addDays(t.due_days),
        related_type: "event",
        related_id: event_id,
        related_name: event.event_name,
        status: "pending",
      }));

      await Promise.all(tasks.map(t => base44.asServiceRole.entities.Task.create(t)));

      await base44.asServiceRole.entities.AutomationLog.create({
        trigger: "event_completed",
        related_type: "event",
        related_id: event_id,
        related_name: event.event_name,
        tasks_created: tasks.length,
        notes: `Post-event: survey + review + debrief tasks created`,
      });

      await base44.asServiceRole.entities.Activity.create({
        type: "status_change",
        subject: "Event completed — post-event tasks generated",
        description: `${tasks.length} tasks: survey, review request, DJ debrief`,
        related_type: "event",
        related_id: event_id,
        related_name: event.event_name,
        is_internal: true,
        performed_by: "system:post_event",
      });

      return Response.json({ ok: true, tasks_created: tasks.length });
    }

    // ── SURVEY RECEIVED ────────────────────────────────────────────
    if (action === "survey_received") {
      const { survey_score } = body;
      if (survey_score === undefined || survey_score === null) {
        return Response.json({ error: "survey_score required" }, { status: 400 });
      }

      // Idempotency: only one survey_received log per event
      const alreadyFired = await isAlreadyFired(base44, "survey_received", event_id);
      if (alreadyFired) {
        return Response.json({ skipped: true, reason: "Survey already processed for this event" });
      }

      const isLowScore = survey_score < 4;
      const tasks = isLowScore
        ? LOW_SCORE_TASKS.map(t => ({
            title: t.title,
            category: t.category,
            priority: t.priority,
            due_date: addDays(t.due_days),
            related_type: "event",
            related_id: event_id,
            related_name: event.event_name,
            status: "pending",
          }))
        : [];

      await Promise.all(tasks.map(t => base44.asServiceRole.entities.Task.create(t)));

      // Update event with survey data
      await base44.asServiceRole.entities.Event.update(event_id, {
        survey_score,
        status: survey_score >= 4 ? "survey_sent" : event.status,
      });

      await base44.asServiceRole.entities.AutomationLog.create({
        trigger: "survey_received",
        related_type: "event",
        related_id: event_id,
        related_name: event.event_name,
        tasks_created: tasks.length,
        notes: `Survey score: ${survey_score}/5${isLowScore ? " — LOW SCORE, service recovery tasks created" : ""}`,
      });

      await base44.asServiceRole.entities.Activity.create({
        type: "system",
        subject: isLowScore
          ? `⚠️ Low survey score (${survey_score}/5) — service recovery initiated`
          : `Survey received — score ${survey_score}/5`,
        description: isLowScore ? `${tasks.length} service recovery tasks created` : undefined,
        related_type: "event",
        related_id: event_id,
        related_name: event.event_name,
        is_internal: true,
        performed_by: "system:survey",
      });

      return Response.json({ ok: true, low_score: isLowScore, tasks_created: tasks.length });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});