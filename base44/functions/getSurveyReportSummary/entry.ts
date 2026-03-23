import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ALLOWED_ROLES = ["admin", "city_manager", "office_finalizer", "sales_manager", "finance", "production_manager"];
const CITY_SCOPED_ROLES = ["city_manager", "office_finalizer"];
const OPEN_TASK_STATUSES = new Set(["pending", "in_progress"]);
const PAGE_SIZE = 200;

async function fetchAllEntities(base44, entityName, sort = "-created_date", filter = null) {
  const rows = [];
  const seenIds = new Set();
  let skip = 0;

  while (true) {
    const batch = filter
      ? await base44.asServiceRole.entities[entityName].filter(filter, sort, PAGE_SIZE, skip)
      : await base44.asServiceRole.entities[entityName].list(sort, PAGE_SIZE, skip);

    if (!Array.isArray(batch) || batch.length === 0) break;

    let added = 0;
    for (const item of batch) {
      if (!item?.id || seenIds.has(item.id)) continue;
      seenIds.add(item.id);
      rows.push(item);
      added += 1;
    }

    if (batch.length < PAGE_SIZE || added === 0) break;
    skip += PAGE_SIZE;
  }

  return rows;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email });
    const profile = profiles?.[0];
    const role = profile?.custom_role || user.role || 'sales_rep';

    if (profile?.is_active === false) {
      return Response.json({ error: 'Account deactivated' }, { status: 403 });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const {
      date_from,
      date_to,
      city,
      dj_id,
      template_id,
      low_score_only,
      search,
    } = body;

    const cityScope = CITY_SCOPED_ROLES.includes(role)
      ? (profile?.cities?.length > 0 ? profile.cities : (profile?.default_city ? [profile.default_city] : []))
      : [];

    if (city && cityScope.length > 0 && !cityScope.includes(city)) {
      return Response.json({ error: 'Forbidden: city out of scope' }, { status: 403 });
    }

    const responseFilter = {};
    if (low_score_only) responseFilter.low_score_flag = true;
    if (template_id) responseFilter.template_id = template_id;

    const [responses, events, surveyTasks, templates] = await Promise.all([
      fetchAllEntities(base44, 'SurveyResponse', '-submitted_at', Object.keys(responseFilter).length ? responseFilter : null),
      fetchAllEntities(base44, 'Event', '-event_date'),
      fetchAllEntities(base44, 'Task', '-created_date', { category: 'survey' }),
      search ? fetchAllEntities(base44, 'SurveyTemplate', 'name') : Promise.resolve([]),
    ]);

    const eventMap = {};
    for (const event of events) eventMap[event.id] = event;

    const templateMap = {};
    for (const template of templates) templateMap[template.id] = template;

    let totalResponses = 0;
    let scoreSum = 0;
    let scoredResponseCount = 0;
    let lowScoreCount = 0;
    const matchedEventIds = new Set();

    for (const response of responses) {
      if (date_from && response.submitted_at < date_from) continue;
      if (date_to && response.submitted_at > `${date_to}T23:59:59Z`) continue;

      const event = eventMap[response.event_id] || {};
      const eventCity = event.city || '';

      if (city && eventCity !== city) continue;
      if (cityScope.length > 0 && !cityScope.includes(eventCity)) continue;
      if (dj_id && event.assigned_dj_id !== dj_id) continue;

      if (search) {
        const q = search.toLowerCase();
        const haystack = [
          event.event_name || '',
          event.contact_name || '',
          event.assigned_dj || '',
          templateMap[response.template_id]?.name || '',
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) continue;
      }

      totalResponses += 1;
      if (response.low_score_flag) lowScoreCount += 1;

      if (response.average_score != null && response.average_score !== '') {
        scoreSum += Number(response.average_score) || 0;
        scoredResponseCount += 1;
      }

      if (response.event_id) matchedEventIds.add(response.event_id);
    }

    const openRecoveryTaskCount = surveyTasks.filter(task => (
      task.related_id &&
      matchedEventIds.has(task.related_id) &&
      OPEN_TASK_STATUSES.has(task.status)
    )).length;

    return Response.json({
      total_responses: totalResponses,
      average_score: scoredResponseCount > 0 ? (scoreSum / scoredResponseCount) : null,
      low_score_count: lowScoreCount,
      open_recovery_task_count: openRecoveryTaskCount,
      scored_response_count: scoredResponseCount,
      filters_applied: {
        date_from: date_from || null,
        date_to: date_to || null,
        city: city || null,
        dj_id: dj_id || null,
        template_id: template_id || null,
        low_score_only: !!low_score_only,
        search: search || null,
      },
    });
  } catch (error) {
    console.error('[getSurveyReportSummary]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});