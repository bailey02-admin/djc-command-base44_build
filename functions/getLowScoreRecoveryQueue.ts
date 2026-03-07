import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ALLOWED_ROLES = ["admin", "city_manager", "office_finalizer", "sales_manager", "finance", "production_manager"];
const CITY_SCOPED_ROLES = ["city_manager", "office_finalizer"];

Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email });
    const profile = profiles?.[0];
    const role = profile?.custom_role || user.role || "sales_rep";

    if (!ALLOWED_ROLES.includes(role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { date_from, date_to, city, dj_id, task_status, limit = 100, skip = 0 } = body;

    const cityScope = CITY_SCOPED_ROLES.includes(role)
      ? (profile?.cities?.length > 0 ? profile.cities : (profile?.default_city ? [profile.default_city] : null))
      : null;

    // Only low-score responses
    const allResponses = await base44.asServiceRole.entities.SurveyResponse.filter({ low_score_flag: true }, "-submitted_at", 2000);
    const responses = allResponses.filter(r => {
      if (date_from && r.submitted_at < date_from) return false;
      if (date_to && r.submitted_at > date_to + "T23:59:59Z") return false;
      return true;
    });

    // Bulk fetch events
    const eventsArr = await base44.asServiceRole.entities.Event.list("-event_date", 5000);
    const eventMap = {};
    for (const e of eventsArr) eventMap[e.id] = e;

    // Bulk fetch survey recovery tasks
    const allSurveyTasks = await base44.asServiceRole.entities.Task.filter({ category: "survey" }, "-created_date", 2000).catch(() => []);
    const taskByEventId = {};
    for (const t of allSurveyTasks) {
      if (t.related_id && !taskByEventId[t.related_id]) taskByEventId[t.related_id] = t;
    }

    let rows = [];
    for (const resp of responses) {
      const event = eventMap[resp.event_id] || {};
      const evCity = event.city || "";

      if (city && evCity !== city) continue;
      if (cityScope && !cityScope.includes(evCity)) continue;
      if (dj_id && event.assigned_dj_id !== dj_id) continue;

      const task = taskByEventId[resp.event_id] || null;

      if (task_status && task?.status !== task_status) continue;
      // If task_status filter is set and no task exists, skip unless filter = "none"
      if (task_status === "none" && task) continue;

      rows.push({
        survey_response_id: resp.id,
        submitted_at: resp.submitted_at || "",
        average_score: resp.average_score ?? null,
        comments_summary: resp.comments_summary || "",

        event_id: event.id || resp.event_id,
        event_name: event.event_name || "",
        event_date: event.event_date || "",
        city: evCity,

        assigned_dj_id: event.assigned_dj_id || "",
        assigned_dj_name: event.assigned_dj || "",

        recovery_task_id: task?.id || null,
        recovery_task_title: task?.title || null,
        recovery_task_status: task?.status || null,
        recovery_task_assigned_to: task?.assigned_to || null,
        recovery_task_due_date: task?.due_date || null,
      });
    }

    const total = rows.length;
    const page = rows.slice(skip, skip + limit);

    return Response.json({ rows: page, total, page: Math.floor(skip / limit), _timing_ms: Date.now() - t0 });
  } catch (err) {
    console.error("[getLowScoreRecoveryQueue]", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});