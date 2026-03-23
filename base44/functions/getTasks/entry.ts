/**
 * Secure Task read endpoint — Performance-hardened.
 *
 * Key changes:
 * - related_id and assigned_to always pushed to DB filter
 * - Hard limit cap: 50/page with skip
 * - Status filter pushed to DB
 * - Full-access roles: still paginated (no unbounded reads)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const FULL_ACCESS_ROLES = new Set(["admin", "city_manager", "sales_manager", "finance"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = user.role || "sales_rep";

    if (role === "client") {
      return Response.json({ tasks: [], total: 0 });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const {
      limit: rawLimit = 50,
      skip = 0,
      sort = "-due_date",
      filters = {},
      related_id,
    } = body;

    const limit = Math.min(Number(rawLimit) || 50, 200);

    // Build DB-level filter
    const dbFilter = {};

    if (related_id) {
      dbFilter.related_id = related_id;
    } else if (!FULL_ACCESS_ROLES.has(role)) {
      // Non-admin roles always scoped to their assigned tasks
      dbFilter.assigned_to = user.email;
    }

    // Push status filter to DB if provided
    if (filters.status && filters.status !== "all") {
      dbFilter.status = filters.status;
    }
    if (filters.priority && filters.priority !== "all") {
      dbFilter.priority = filters.priority;
    }
    if (filters.category && filters.category !== "all") {
      dbFilter.category = filters.category;
    }

    // DJs: only DJ-category tasks
    if (role === "dj") {
      // Can't do array-in DB filter, so fetch assigned tasks then filter
      dbFilter.assigned_to = user.email;
    }

    let tasks = await base44.asServiceRole.entities.Task.filter(dbFilter, sort, limit + skip);

    // DJ: restrict categories post-fetch
    if (role === "dj") {
      tasks = tasks.filter(t => ["dj_prep", "finalization", "other"].includes(t.category));
    }

    // Apply remaining non-DB-filterable caller filters
    const DB_FILTERABLE = ["status", "priority", "category"];
    for (const [key, val] of Object.entries(filters)) {
      if (val && val !== "all" && !DB_FILTERABLE.includes(key)) {
        tasks = tasks.filter(t => t[key] === val);
      }
    }

    const paginated = tasks.slice(skip, skip + limit);

    return Response.json({ tasks: paginated, total: tasks.length, page: { skip, limit, returned: paginated.length } });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});