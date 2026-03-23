import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ALLOWED_ROLES = ["admin", "city_manager", "office_finalizer", "sales_manager"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email });
    const profile = profiles?.[0];
    const role = profile?.custom_role || user.role || "sales_rep";

    if (!ALLOWED_ROLES.includes(role)) {
      return Response.json({ error: "Forbidden: insufficient role" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, template, questions = [] } = body;
    if (!action || !template) return Response.json({ error: "action and template required" }, { status: 400 });
    if (!template.name) return Response.json({ error: "Template name required" }, { status: 400 });

    let savedTemplate;

    if (action === "create") {
      savedTemplate = await base44.asServiceRole.entities.SurveyTemplate.create({
        ...template,
        created_by_staff_profile_id: profile?.id || user.id,
        is_active: template.is_active !== false,
      });
    } else if (action === "update") {
      if (!template.id) return Response.json({ error: "template.id required for update" }, { status: 400 });
      savedTemplate = await base44.asServiceRole.entities.SurveyTemplate.update(template.id, {
        name: template.name,
        description: template.description,
        is_active: template.is_active,
        applies_to_event_types: template.applies_to_event_types || [],
        applies_to_cities: template.applies_to_cities || [],
        low_score_threshold: template.low_score_threshold ?? 7.0,
        send_automatically: template.send_automatically || false,
      });
    } else {
      return Response.json({ error: "action must be create or update" }, { status: 400 });
    }

    const templateId = savedTemplate.id;

    // Full-replace questions: delete existing, recreate
    if (action === "update") {
      const existingQs = await base44.asServiceRole.entities.SurveyQuestion.filter({ template_id: templateId });
      await Promise.all(existingQs.map(q =>
        base44.asServiceRole.entities.SurveyQuestion.delete(q.id).catch(() => {})
      ));
    }

    const savedQuestions = await Promise.all(
      questions.map((q, idx) =>
        base44.asServiceRole.entities.SurveyQuestion.create({
          template_id: templateId,
          sort_order: q.sort_order ?? idx,
          question_text: q.question_text,
          question_type: q.question_type || "rating_1_10",
          is_required: q.is_required !== false,
          category: q.category || "",
          weight: q.weight ?? 1,
        })
      )
    );

    return Response.json({ template: savedTemplate, questions: savedQuestions });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});