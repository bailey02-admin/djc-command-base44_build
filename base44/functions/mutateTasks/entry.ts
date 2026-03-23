/**
 * Secure Task mutation endpoint.
 * Actions: create | complete | update | delete
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const TASK_WRITE_DENIED = new Set(["client"]);

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
    const { action, id, data = {} } = body;

    if (action === "create") {
      const task = await base44.asServiceRole.entities.Task.create({
        ...data,
        // If no explicit assignee, assign to the caller
        assigned_to: data.assigned_to || user.email,
      });
      return Response.json({ task });
    }

    if (action === "complete") {
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      // Only admin/manager or the assigned person can complete a task
      const rows = await base44.asServiceRole.entities.Task.filter({ id });
      const task = rows[0];
      if (!task) return Response.json({ error: "Not found" }, { status: 404 });
      if (role !== "admin" && task.assigned_to !== user.email && !["city_manager", "sales_manager"].includes(role)) {
        return Response.json({ error: "Forbidden: can only complete tasks assigned to you" }, { status: 403 });
      }
      const updated = await base44.asServiceRole.entities.Task.update(id, {
        status: "completed",
        completed_date: new Date().toISOString(),
      });
      // Log activity
      await base44.asServiceRole.entities.Activity.create({
        type: "system",
        subject: `Task completed: ${task.title}`,
        related_type: task.related_type || "general",
        related_id: task.related_id || id,
        related_name: task.related_name || task.title,
        performed_by: user.email,
        is_internal: true,
      }).catch(() => {});
      return Response.json({ task: updated });
    }

    if (action === "update") {
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      const updated = await base44.asServiceRole.entities.Task.update(id, data);
      return Response.json({ task: updated });
    }

    if (action === "delete") {
      if (!["admin", "city_manager", "sales_manager"].includes(role)) {
        return Response.json({ error: "Forbidden: insufficient role to delete tasks" }, { status: 403 });
      }
      await base44.asServiceRole.entities.Task.delete(id);
      return Response.json({ ok: true });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});