/**
 * Bulk task create endpoint.
 * Accepts { tasks: [...], batch_id? } — creates all tasks in a single backend call.
 *
 * Idempotency: if batch_id is provided, checks for existing tasks with that batch_id
 * and skips creation if any already exist (prevents double-submit on retry).
 *
 * Auth: same rules as mutateTasks create.
 * Limit: max 50 tasks per batch to prevent abuse.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const TASK_WRITE_DENIED = new Set(["client"]);
const MAX_BATCH = 50;

// Minimal required fields per task
function validateTask(t) {
  if (!t.title || typeof t.title !== "string" || !t.title.trim()) {
    return "title is required";
  }
  return null;
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
    const { tasks, batch_id } = body;

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return Response.json({ error: "tasks array is required and must not be empty" }, { status: 400 });
    }
    if (tasks.length > MAX_BATCH) {
      return Response.json({ error: `Batch too large: max ${MAX_BATCH} tasks per call` }, { status: 400 });
    }

    // Validate all tasks up-front before writing anything
    for (let i = 0; i < tasks.length; i++) {
      const err = validateTask(tasks[i]);
      if (err) return Response.json({ error: `Task[${i}]: ${err}` }, { status: 400 });
    }

    // Idempotency check: if batch_id provided, check if already created
    if (batch_id) {
      const existing = await base44.asServiceRole.entities.Task.filter({ batch_id }, "-created_date", 1);
      if (existing.length > 0) {
        return Response.json({
          skipped: true,
          reason: "batch_id already exists",
          batch_id,
          count: 0,
          ids: [],
        });
      }
    }

    // Create all tasks sequentially (service role, single function call from client perspective)
    const created = [];
    for (const t of tasks) {
      const task = await base44.asServiceRole.entities.Task.create({
        ...t,
        title: t.title.trim(),
        assigned_to: t.assigned_to || user.email,
        status: t.status || "pending",
        priority: t.priority || "medium",
        ...(batch_id ? { batch_id } : {}),
      });
      created.push(task);
    }

    return Response.json({
      ok: true,
      count: created.length,
      ids: created.map(t => t.id),
      tasks: created,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});