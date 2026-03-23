import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ALLOWED_ROLES = ["admin", "city_manager", "office_finalizer", "sales_manager", "finance"];

Deno.serve(async (req) => {
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
    const { template_id } = body;
    if (!template_id) return Response.json({ error: "template_id required" }, { status: 400 });

    const templateRows = await base44.asServiceRole.entities.SurveyTemplate.filter({ id: template_id });
    const template = templateRows[0];
    if (!template) return Response.json({ error: "Template not found" }, { status: 404 });

    const questions = await base44.asServiceRole.entities.SurveyQuestion.filter(
      { template_id },
      "sort_order",
      200
    );

    return Response.json({ template, questions });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});