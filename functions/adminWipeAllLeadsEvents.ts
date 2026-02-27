/**
 * Admin-only: Wipe ALL Lead and Event records (not just demo-tagged),
 * plus all Activities, Tasks, Payments, AutomationLogs.
 * This is the nuclear option — use with extreme caution.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function deleteAllRows(svc, entityName) {
  let deleted = 0;
  const pageSize = 200;
  while (true) {
    const rows = await svc.entities[entityName].list("-created_date", pageSize, 0);
    if (!rows || rows.length === 0) break;
    for (let i = 0; i < rows.length; i += 50) {
      await Promise.all(rows.slice(i, i + 50).map(r => svc.entities[entityName].delete(r.id)));
    }
    deleted += rows.length;
    if (rows.length < pageSize) break;
  }
  return deleted;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden: admin only" }, { status: 403 });

    const svc = base44.asServiceRole;

    const [leads, events, activities, tasks, payments, automationLogs] = await Promise.all([
      deleteAllRows(svc, "Lead"),
      deleteAllRows(svc, "Event"),
      deleteAllRows(svc, "Activity"),
      deleteAllRows(svc, "Task"),
      deleteAllRows(svc, "Payment"),
      deleteAllRows(svc, "AutomationLog"),
    ]);

    return Response.json({
      ok: true,
      deleted: { leads, events, activities, tasks, payments, automationLogs },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});