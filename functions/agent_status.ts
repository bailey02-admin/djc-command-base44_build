import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function authCheck(req) {
  const token = req.headers.get("x-agent-token");
  const expected = Deno.env.get("AGENT_TOKEN");
  if (!token || token !== expected) return false;
  return true;
}

Deno.serve(async (req) => {
  if (!authCheck(req)) {
    return Response.json({ ok: false, errors: ["Unauthorized: invalid or missing x-agent-token"] }, { status: 401 });
  }

  try {
    const base44 = createClientFromRequest(req);

    // Gather system state
    const [events, leads, tasks, statuses] = await Promise.all([
      base44.asServiceRole.entities.Event.list("-created_date", 5),
      base44.asServiceRole.entities.Lead.list("-created_date", 5),
      base44.asServiceRole.entities.Task.filter({ status: "pending" }, "-due_date", 10),
      base44.asServiceRole.entities.EventStatus.list("sort_order", 50),
    ]);

    const completedSteps = [];
    const blockers = [];

    if (statuses.length > 0) completedSteps.push("event_statuses_configured");
    if (events.length > 0) completedSteps.push("events_exist");
    if (leads.length > 0) completedSteps.push("leads_exist");

    const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date());
    if (overdueTasks.length > 0) blockers.push(`${overdueTasks.length} overdue task(s)`);

    const phaseId = "operations";
    const stepId = blockers.length > 0 ? "resolve_blockers" : "review_dashboard";

    return Response.json({
      ok: true,
      phaseId,
      stepId,
      completedSteps,
      blockers,
      summary: {
        recentEvents: events.length,
        recentLeads: leads.length,
        pendingTasks: tasks.length,
        overdueTasks: overdueTasks.length,
        statusCount: statuses.length,
      },
      next: {
        phaseId,
        stepId: blockers.length > 0 ? "resolve_blockers" : "agent_run_step",
        inputsNeeded: blockers.length > 0 ? ["resolve overdue tasks or blockers"] : [],
      },
    });
  } catch (error) {
    return Response.json({ ok: false, errors: [error.message] }, { status: 500 });
  }
});