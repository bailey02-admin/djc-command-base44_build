/**
 * taskEngine — Canonical server-side task creation endpoint.
 *
 * Actions:
 *   create_from_trigger  — create tasks from a named template, idempotent via batch_id
 *   create_single        — create one task with optional idempotency_key
 *   detect_overdue       — scan pending tasks for a related_id, create escalation tasks for overdue
 *
 * Idempotency:
 *   - batch_id: if any task with this batch_id exists for related_id, skip entire batch
 *   - idempotency_key: per-task unique key, skip if already exists
 *
 * Due date rules:
 *   - offset_days from now (lead tasks) OR from event_date (event milestone tasks, event_relative=true)
 *   - event_relative tasks: due_date = event_date - |offset_days| (clamped to today if past)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const TASK_WRITE_DENIED = new Set(["client"]);

// ─── Task Templates ────────────────────────────────────────────────────────
const TASK_TEMPLATES = {
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
    { title: "Collect deposit", category: "payment", priority: "medium", offset_days: 2 },
  ],
  event_90_days: [
    { title: "Send planning form link to client", category: "planning", priority: "medium", offset_days: 0, event_relative: true, event_offset: -90 },
  ],
  event_60_days: [
    { title: "Follow up on planning form completion", category: "planning", priority: "high", offset_days: 0, event_relative: true, event_offset: -60 },
    { title: "Verify venue logistics", category: "planning", priority: "medium", offset_days: 0, event_relative: true, event_offset: -60 },
  ],
  event_30_days: [
    { title: "Timeline review — 30 days out", category: "finalization", priority: "high", offset_days: 0, event_relative: true, event_offset: -30 },
    { title: "Confirm balance payment due date", category: "payment", priority: "high", offset_days: 0, event_relative: true, event_offset: -30 },
    { title: "Request final music selections", category: "planning", priority: "medium", offset_days: 0, event_relative: true, event_offset: -30 },
  ],
  event_14_days: [
    { title: "Schedule final client call", category: "finalization", priority: "urgent", offset_days: 0, event_relative: true, event_offset: -14 },
    { title: "Confirm DJ assignment", category: "dj_prep", priority: "urgent", offset_days: 0, event_relative: true, event_offset: -14 },
  ],
  event_7_days: [
    { title: "Conduct final client call", category: "finalization", priority: "urgent", offset_days: 0, event_relative: true, event_offset: -7 },
    { title: "Brief DJ with event sheet", category: "dj_prep", priority: "urgent", offset_days: 0, event_relative: true, event_offset: -7 },
    { title: "Confirm venue contact day-of", category: "finalization", priority: "high", offset_days: 0, event_relative: true, event_offset: -7 },
    { title: "Verify final balance paid", category: "payment", priority: "high", offset_days: 0, event_relative: true, event_offset: -7 },
  ],
  event_completed: [
    { title: "Send post-event survey (24h)", category: "survey", priority: "medium", offset_days: 1 },
    { title: "Request Google/Knot review (3 days)", category: "review", priority: "medium", offset_days: 3 },
  ],
  survey_low_score: [
    { title: "⚠️ SERVICE RECOVERY — contact client within 24h", category: "follow_up", priority: "urgent", offset_days: 0 },
    { title: "Escalate to city manager", category: "follow_up", priority: "urgent", offset_days: 0 },
  ],
  client_changed_after_review: [
    { title: "⚠️ Client changed details after DJ review — re-brief DJ", category: "dj_prep", priority: "urgent", offset_days: 0 },
    { title: "Finalizer: review client changes before event", category: "finalization", priority: "high", offset_days: 0 },
  ],
};

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function buildDueDate(tmpl, eventDate) {
  const today = new Date().toISOString().split("T")[0];
  if (tmpl.event_relative && eventDate) {
    const computed = addDays(eventDate, tmpl.event_offset || 0);
    // Clamp to today if in the past
    return computed >= today ? computed : today;
  }
  return addDays(new Date(), tmpl.offset_days || 0);
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 50);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = user.role || "sales_rep";
    if (TASK_WRITE_DENIED.has(role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ── CREATE FROM TRIGGER (batch, idempotent) ───────────────────
    if (action === "create_from_trigger") {
      const { trigger, related_id, related_name, related_type = "lead", event_date, assigned_to } = body;
      if (!trigger || !related_id) return Response.json({ error: "trigger and related_id required" }, { status: 400 });

      const templates = TASK_TEMPLATES[trigger];
      if (!templates || templates.length === 0) {
        return Response.json({ skipped: true, reason: `No templates for trigger: ${trigger}` });
      }

      const batch_id = `${trigger}:${related_id}`;

      // Idempotency: if any task with this batch_id exists, skip
      const existing = await base44.asServiceRole.entities.Task.filter({ batch_id }, "-created_date", 1);
      if (existing.length > 0) {
        return Response.json({ skipped: true, reason: "batch_id already exists", batch_id, count: 0 });
      }

      const created = [];
      for (const tmpl of templates) {
        const idempotency_key = `${trigger}:${related_id}:${slugify(tmpl.title)}`;
        const task = await base44.asServiceRole.entities.Task.create({
          title: tmpl.title,
          category: tmpl.category,
          priority: tmpl.priority,
          status: "pending",
          related_id,
          related_name: related_name || "",
          related_type,
          due_date: buildDueDate(tmpl, event_date),
          batch_id,
          idempotency_key,
          assigned_to: assigned_to || user.email,
        });
        created.push(task);
      }

      // Log to AutomationLog
      await base44.asServiceRole.entities.AutomationLog.create({
        trigger,
        related_type,
        related_id,
        related_name: related_name || "",
        tasks_created: created.length,
        notes: `Server-side taskEngine: ${created.length} tasks from trigger "${trigger}"`,
      }).catch(() => {});

      return Response.json({ ok: true, count: created.length, batch_id, tasks: created });
    }

    // ── CREATE SINGLE (with optional idempotency_key) ────────────
    if (action === "create_single") {
      const { data = {} } = body;
      if (!data.title) return Response.json({ error: "title required" }, { status: 400 });

      // Idempotency check
      if (data.idempotency_key) {
        const existing = await base44.asServiceRole.entities.Task.filter({ idempotency_key: data.idempotency_key }, "-created_date", 1);
        if (existing.length > 0) {
          return Response.json({ skipped: true, reason: "idempotency_key already exists", task: existing[0] });
        }
      }

      const task = await base44.asServiceRole.entities.Task.create({
        ...data,
        assigned_to: data.assigned_to || user.email,
        status: data.status || "pending",
        priority: data.priority || "medium",
      });
      return Response.json({ ok: true, task });
    }

    // ── DETECT OVERDUE + ESCALATE ─────────────────────────────────
    if (action === "detect_overdue") {
      const { related_id, related_type = "event" } = body;
      if (!related_id) return Response.json({ error: "related_id required" }, { status: 400 });

      const today = new Date().toISOString().split("T")[0];
      const tasks = await base44.asServiceRole.entities.Task.filter(
        { related_id, status: "pending" }, "-due_date", 50
      );

      const overdue = tasks.filter(t =>
        t.due_date && t.due_date < today && !t.escalated
      );

      const escalated = [];
      for (const t of overdue) {
        const escalation_key = `escalation:${t.id}`;
        const already = await base44.asServiceRole.entities.Task.filter({ idempotency_key: escalation_key }, "-created_date", 1);
        if (already.length > 0) continue;

        const escTask = await base44.asServiceRole.entities.Task.create({
          title: `⚠️ OVERDUE ESCALATION: ${t.title}`,
          description: `Original task (${t.id}) has been overdue since ${t.due_date}`,
          category: t.category || "follow_up",
          priority: "urgent",
          status: "pending",
          related_id: t.related_id,
          related_name: t.related_name,
          related_type: t.related_type,
          due_date: today,
          idempotency_key: escalation_key,
          assigned_to: t.assigned_to || user.email,
        });
        escalated.push(escTask);

        // Mark original as escalated so we don't escalate again
        await base44.asServiceRole.entities.Task.update(t.id, { escalated: true }).catch(() => {});
      }

      return Response.json({ overdue_count: overdue.length, escalated_count: escalated.length, escalated });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});