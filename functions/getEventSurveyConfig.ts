import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ALLOWED_ROLES = ["admin", "city_manager", "office_finalizer", "sales_manager", "finance"];
const ELIGIBLE_STATUSES = ["completed"];

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
    const { event_id } = body;
    if (!event_id) return Response.json({ error: "event_id required" }, { status: 400 });

    const eventRows = await base44.asServiceRole.entities.Event.filter({ id: event_id });
    const event = eventRows[0];
    if (!event) return Response.json({ error: "Event not found" }, { status: 404 });

    const isEligible = ELIGIBLE_STATUSES.includes(event.status);

    // Check for existing response
    const responses = await base44.asServiceRole.entities.SurveyResponse.filter({ event_id });
    const existingResponse = responses[0] || null;

    // Find best matching active template
    const templates = await base44.asServiceRole.entities.SurveyTemplate.filter({ is_active: true });

    let selectedTemplate = null;

    // Priority: exact event_type + city match > event_type match > city match > generic (no filters)
    const rank = (t) => {
      const hasType = t.applies_to_event_types?.length > 0;
      const hasCity = t.applies_to_cities?.length > 0;
      const typeMatch = hasType && t.applies_to_event_types.includes(event.event_type);
      const cityMatch = hasCity && t.applies_to_cities.includes(event.city);
      if (typeMatch && cityMatch) return 4;
      if (typeMatch && !hasCity) return 3;
      if (!hasType && cityMatch) return 2;
      if (!hasType && !hasCity) return 1;
      return 0;
    };

    const ranked = templates
      .map(t => ({ t, r: rank(t) }))
      .filter(x => x.r > 0)
      .sort((a, b) => b.r - a.r);

    selectedTemplate = ranked[0]?.t || null;

    return Response.json({
      event: { id: event.id, event_name: event.event_name, status: event.status, event_type: event.event_type, city: event.city, contact_id: event.contact_id },
      selected_template: selectedTemplate,
      has_response: !!existingResponse,
      existing_response: existingResponse,
      is_eligible: isEligible,
      ineligible_reason: isEligible ? null : `Event status "${event.status}" is not eligible for survey submission. Status must be: completed.`,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});