import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const STAFF_ROLES = ["admin", "city_manager", "office_finalizer", "sales_manager", "finance"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email });
    const profile = profiles?.[0];
    const role = profile?.custom_role || user.role || "sales_rep";
    const isStaff = STAFF_ROLES.includes(role);

    if (!isStaff) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { event_id } = body;
    if (!event_id) return Response.json({ error: "event_id required" }, { status: 400 });

    const responses = await base44.asServiceRole.entities.SurveyResponse.filter({ event_id });
    const response = responses[0] || null;

    if (!response) return Response.json({ template: null, response: null, answers: [] });

    const [templateRows, answers, questions] = await Promise.all([
      base44.asServiceRole.entities.SurveyTemplate.filter({ id: response.template_id }),
      base44.asServiceRole.entities.SurveyAnswer.filter({ response_id: response.id }),
      base44.asServiceRole.entities.SurveyQuestion.filter({ template_id: response.template_id }, "sort_order", 200),
    ]);

    return Response.json({
      template: templateRows[0] || null,
      response,
      answers,
      questions,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});