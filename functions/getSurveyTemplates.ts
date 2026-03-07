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
    const { active_only, event_type, city } = body;

    let templates = await base44.asServiceRole.entities.SurveyTemplate.list("-created_date", 200);

    if (active_only) templates = templates.filter(t => t.is_active !== false);
    if (event_type) templates = templates.filter(t =>
      !t.applies_to_event_types?.length || t.applies_to_event_types.includes(event_type)
    );
    if (city) templates = templates.filter(t =>
      !t.applies_to_cities?.length || t.applies_to_cities.includes(city)
    );

    return Response.json({ templates });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});