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
    const {
      date_from, date_to, city, dj_id, low_score_only,
      template_id, limit = 100, skip = 0, search,
    } = body;

    // Determine city scope
    const cityScope = CITY_SCOPED_ROLES.includes(role)
      ? (profile?.cities?.length > 0 ? profile.cities : (profile?.default_city ? [profile.default_city] : null))
      : null; // admin/sales_manager = all cities

    // Fetch all survey responses
    const filterArgs = {};
    if (low_score_only) filterArgs.low_score_flag = true;
    if (template_id) filterArgs.template_id = template_id;

    const allResponses = await base44.asServiceRole.entities.SurveyResponse.list("-submitted_at", 2000);
    let responses = allResponses.filter(r => {
      if (low_score_only && !r.low_score_flag) return false;
      if (template_id && r.template_id !== template_id) return false;
      if (date_from && r.submitted_at < date_from) return false;
      if (date_to && r.submitted_at > date_to + "T23:59:59Z") return false;
      return true;
    });

    // Bulk fetch events
    const eventIds = [...new Set(responses.map(r => r.event_id).filter(Boolean))];
    const eventsArr = eventIds.length > 0
      ? await base44.asServiceRole.entities.Event.list("-event_date", 5000)
      : [];
    const eventMap = {};
    for (const e of eventsArr) eventMap[e.id] = e;

    // Bulk fetch templates
    const templateIds = [...new Set(responses.map(r => r.template_id).filter(Boolean))];
    const templatesArr = templateIds.length > 0
      ? await base44.asServiceRole.entities.SurveyTemplate.list("name", 500)
      : [];
    const templateMap = {};
    for (const t of templatesArr) templateMap[t.id] = t;

    // Bulk fetch recovery tasks (category=survey, related_type=event)
    const allSurveyTasks = await base44.asServiceRole.entities.Task.filter({ category: "survey" }, "-created_date", 2000).catch(() => []);
    const taskByEventId = {};
    for (const t of allSurveyTasks) {
      if (t.related_id && !taskByEventId[t.related_id]) taskByEventId[t.related_id] = t;
    }

    // Filter + enrich rows
    let rows = [];
    for (const resp of responses) {
      const event = eventMap[resp.event_id] || {};

      // City scope check
      const evCity = event.city || "";
      if (city && evCity !== city) continue;
      if (cityScope && !cityScope.includes(evCity)) continue;

      // DJ filter
      if (dj_id && event.assigned_dj_id !== dj_id) continue;

      const tmpl = templateMap[resp.template_id] || {};
      const task = taskByEventId[resp.event_id] || null;

      const row = {
        survey_response_id: resp.id,
        submitted_at: resp.submitted_at || "",
        average_score: resp.average_score ?? null,
        low_score_flag: resp.low_score_flag ?? false,
        comments_summary: resp.comments_summary || "",

        event_id: event.id || resp.event_id,
        event_name: event.event_name || "",
        event_date: event.event_date || "",
        city: evCity,

        contact_id: event.contact_id || resp.contact_id || "",
        contact_name: event.contact_name || "",

        assigned_dj_id: event.assigned_dj_id || "",
        assigned_dj_name: event.assigned_dj || "",

        template_id: resp.template_id || "",
        template_name: tmpl.name || "",

        recovery_task_id: task?.id || null,
        recovery_task_status: task?.status || null,
        recovery_task_title: task?.title || null,
        recovery_task_assigned_to: task?.assigned_to || null,
      };

      // Search filter
      if (search) {
        const q = search.toLowerCase();
        const haystack = [row.event_name, row.contact_name, row.assigned_dj_name, row.template_name].join(" ").toLowerCase();
        if (!haystack.includes(q)) continue;
      }

      rows.push(row);
    }

    const total = rows.length;
    const page = rows.slice(skip, skip + limit);

    return Response.json({ rows: page, total, page: Math.floor(skip / limit), _timing_ms: Date.now() - t0 });
  } catch (err) {
    console.error("[getSurveyResponsesReport]", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});