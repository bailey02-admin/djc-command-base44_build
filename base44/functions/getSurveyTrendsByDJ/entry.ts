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
    const { date_from, date_to, city, dj_id } = body;

    const cityScope = CITY_SCOPED_ROLES.includes(role)
      ? (profile?.cities?.length > 0 ? profile.cities : (profile?.default_city ? [profile.default_city] : null))
      : null;

    // Fetch all survey responses
    const allResponses = await base44.asServiceRole.entities.SurveyResponse.list("-submitted_at", 2000);
    const responses = allResponses.filter(r => {
      if (date_from && r.submitted_at < date_from) return false;
      if (date_to && r.submitted_at > date_to + "T23:59:59Z") return false;
      return true;
    });

    // Bulk fetch events
    const eventsArr = await base44.asServiceRole.entities.Event.list("-event_date", 5000);
    const eventMap = {};
    for (const e of eventsArr) eventMap[e.id] = e;

    // Aggregate by DJ
    const djAgg = {}; // key: assigned_dj_id || "unknown"

    for (const resp of responses) {
      const event = eventMap[resp.event_id] || {};
      const evCity = event.city || "";

      if (city && evCity !== city) continue;
      if (cityScope && !cityScope.includes(evCity)) continue;
      if (dj_id && event.assigned_dj_id !== dj_id) continue;

      const djKey = event.assigned_dj_id || `no_dj_${evCity}`;
      const djName = event.assigned_dj || "(Unassigned)";

      if (!djAgg[djKey]) {
        djAgg[djKey] = {
          assigned_dj_id: event.assigned_dj_id || null,
          assigned_dj_name: djName,
          city: evCity,
          survey_count: 0,
          score_sum: 0,
          score_count: 0,
          low_score_count: 0,
          most_recent_submitted_at: null,
          most_recent_event_id: null,
          most_recent_event_name: null,
        };
      }

      const agg = djAgg[djKey];
      agg.survey_count++;
      if (resp.average_score != null) {
        agg.score_sum += resp.average_score;
        agg.score_count++;
      }
      if (resp.low_score_flag) agg.low_score_count++;

      if (!agg.most_recent_submitted_at || resp.submitted_at > agg.most_recent_submitted_at) {
        agg.most_recent_submitted_at = resp.submitted_at;
        agg.most_recent_event_id = event.id || resp.event_id;
        agg.most_recent_event_name = event.event_name || "";
      }
    }

    const rows = Object.values(djAgg).map(a => ({
      ...a,
      average_score: a.score_count > 0 ? Math.round((a.score_sum / a.score_count) * 10) / 10 : null,
      score_sum: undefined,
      score_count: undefined,
    })).sort((a, b) => (b.average_score ?? 0) - (a.average_score ?? 0));

    return Response.json({ rows, _timing_ms: Date.now() - t0 });
  } catch (err) {
    console.error("[getSurveyTrendsByDJ]", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});