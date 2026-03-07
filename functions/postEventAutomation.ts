/**
 * Post-event automation backend function.
 * Actions:
 *   event_completed  — fires when status moves to event_completed
 *   survey_received  — fires when survey_score is added/updated
 *
 * Idempotency: checks AutomationLog for existing trigger+event_id before acting.
 * Logs to AutomationLog + Activity feed.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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

async function isAlreadyFired(base44, trigger, event_id, idempotency_key = null) {
  const logs = await base44.asServiceRole.entities.AutomationLog.filter({ trigger, related_id: event_id }, "-created_date", 5);
  if (!idempotency_key) return logs.length > 0;
  // Key-scoped: check if this specific key has already fired (e.g. survey response_id)
  return logs.some(l => l.idempotency_key === idempotency_key);
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
    // Supports both legacy survey_score field and new SurveyResponse system.
    // Callers should pass: { action, event_id, survey_score, response_id? }
    // survey_score is on 1-10 scale (SurveyResponse.average_score).
    // low_score_threshold defaults to 7.0 (Truth Doc canonical).
    if (action === "survey_received") {
      const { survey_score, response_id } = body;
      if (survey_score === undefined || survey_score === null) {
        return Response.json({ error: "survey_score required" }, { status: 400 });
      }

      // Idempotency: scoped by response_id when provided (supports multiple surveys per event)
      // Falls back to event-level idempotency when no response_id (legacy path)
      const idempotencyKey = response_id || null;
      const alreadyFired = await isAlreadyFired(base44, "survey_received", event_id, idempotencyKey);
      if (alreadyFired) {
        return Response.json({ skipped: true, reason: "Survey already processed", idempotency_key: idempotencyKey });
      }

      // Low score threshold: 7.0 on 1-10 scale (Truth Doc canonical)
      const LOW_SCORE_THRESHOLD = 7.0;
      const isLowScore = survey_score < LOW_SCORE_THRESHOLD;

      const tasks = isLowScore
        ? LOW_SCORE_TASKS.map(t => ({
            title: t.title,
            category: "survey",
            priority: t.priority,
            due_date: addDays(t.due_days),
            related_type: "event",
            related_id: event_id,
            related_name: event.event_name,
            related_id_secondary: response_id || null,
            status: "pending",
          }))
        : [];

      if (tasks.length > 0) {
        await Promise.all(tasks.map(t => base44.asServiceRole.entities.Task.create(t)));
      }

      // Update event survey summary fields (non-blocking — best effort)
      await base44.asServiceRole.entities.Event.update(event_id, {
        survey_avg: survey_score,
        ...(isLowScore ? { survey_flag: "low_score" } : {}),
      }).catch(() => {});

      await base44.asServiceRole.entities.AutomationLog.create({
        trigger: "survey_received",
        related_type: "event",
        related_id: event_id,
        related_name: event.event_name,
        tasks_created: tasks.length,
        idempotency_key: idempotencyKey,
        notes: `Survey score: ${survey_score}/10 (threshold ${LOW_SCORE_THRESHOLD})${isLowScore ? " — LOW SCORE, service recovery tasks created" : ""}`,
      });

      await base44.asServiceRole.entities.Activity.create({
        type: "system",
        subject: isLowScore
          ? `⚠️ Low survey score (${survey_score}/10) — service recovery initiated`
          : `Survey received — score ${survey_score}/10`,
        description: isLowScore ? `${tasks.length} service recovery tasks created` : undefined,
        related_type: "event",
        related_id: event_id,
        related_name: event.event_name,
        is_internal: true,
        performed_by: "system:survey",
      });

      return Response.json({ ok: true, low_score: isLowScore, tasks_created: tasks.length, threshold: LOW_SCORE_THRESHOLD });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});