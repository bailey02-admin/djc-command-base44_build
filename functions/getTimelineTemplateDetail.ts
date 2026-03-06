import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ALLOWED_ROLES = new Set(["admin","city_manager","sales_manager","sales_rep","office_finalizer","dj"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !ALLOWED_ROLES.has(user.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { template_id } = await req.json();
    if (!template_id) return Response.json({ error: "template_id required" }, { status: 400 });

    const svc = base44.asServiceRole;
    const templates = await svc.entities.TimelineTemplate.filter({ id: template_id });
    if (!templates[0]) return Response.json({ error: "Not found" }, { status: 404 });

    const items = await svc.entities.TimelineTemplateItem.filter({ template_id }, "sort_order", 200);

    return Response.json({ template: templates[0], items });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});