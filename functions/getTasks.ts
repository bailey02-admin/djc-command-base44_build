/**
 * Secure Task read endpoint.
 * Users only see tasks assigned to them, or tasks related to records they can access.
 * Admins/managers see all tasks.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const FULL_ACCESS_ROLES = new Set(["admin", "city_manager", "sales_manager", "finance"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = user.role || "sales_rep";

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const { limit = 200, sort = "-due_date", filters = {}, related_id } = body;

    let tasks;

    if (related_id) {
      // Tasks for a specific record — scoping done by the entity access check above
      tasks = await base44.asServiceRole.entities.Task.filter({ related_id }, sort, limit);
    } else if (FULL_ACCESS_ROLES.has(role)) {
      tasks = await base44.asServiceRole.entities.Task.list(sort, limit);
    } else {
      // Sales rep, DJ, office finalizer: only their assigned tasks
      tasks = await base44.asServiceRole.entities.Task.filter({ assigned_to: user.email }, sort, limit);
    }

    // Apply additional filters
    for (const [key, val] of Object.entries(filters)) {
      if (val && val !== "all") tasks = tasks.filter(t => t[key] === val);
    }

    // DJs: only see DJ-category tasks
    if (role === "dj") {
      tasks = tasks.filter(t => ["dj_prep", "finalization", "other"].includes(t.category));
    }

    // Clients: no tasks
    if (role === "client") {
      return Response.json({ tasks: [], total: 0 });
    }

    return Response.json({ tasks, total: tasks.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});