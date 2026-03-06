import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ALLOWED_ROLES = new Set(["admin","city_manager","sales_manager","sales_rep","office_finalizer","dj"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !ALLOWED_ROLES.has(user.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { event_type, timeline_type, active_only = true, include_items = false } = await req.json();

    const svc = base44.asServiceRole;
    const filterObj = {};
    if (event_type) filterObj.event_type = event_type;
    if (timeline_type) filterObj.timeline_type = timeline_type;
    if (active_only) filterObj.is_active = true;

    const templates = await svc.entities.TimelineTemplate.filter(filterObj, "name", 200);

    let items_by_template_id = null;
    if (include_items && templates.length > 0) {
      items_by_template_id = {};
      for (const t of templates) {
        const items = await svc.entities.TimelineTemplateItem.filter({ template_id: t.id }, "sort_order", 200);
        items_by_template_id[t.id] = items;
      }
    }

    return Response.json({ templates, items_by_template_id });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});