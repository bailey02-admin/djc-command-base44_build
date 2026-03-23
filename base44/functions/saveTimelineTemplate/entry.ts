import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const MANAGER_ROLES = new Set(["admin","city_manager","office_finalizer","sales_manager"]);
const VALID_EVENT_TYPES = new Set(["wedding","corporate","school_dance","private_party","birthday","anniversary","mitzvah","quinceañera","holiday_party","other"]);
const VALID_TIMELINE_TYPES = new Set(["PRIMARY","SECONDARY"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !MANAGER_ROLES.has(user.role)) {
      return Response.json({ error: "Forbidden: manager role required" }, { status: 403 });
    }

    const { action, template, items = [] } = await req.json();
    if (!action || !template) return Response.json({ error: "action and template required" }, { status: 400 });
    if (!VALID_EVENT_TYPES.has(template.event_type)) return Response.json({ error: "Invalid event_type" }, { status: 400 });
    if (!VALID_TIMELINE_TYPES.has(template.timeline_type)) return Response.json({ error: "Invalid timeline_type" }, { status: 400 });
    if (!template.name?.trim()) return Response.json({ error: "name required" }, { status: 400 });

    const svc = base44.asServiceRole;
    let savedTemplate;

    if (action === "create") {
      savedTemplate = await svc.entities.TimelineTemplate.create({
        name: template.name.trim(),
        event_type: template.event_type,
        timeline_type: template.timeline_type,
        header_title: template.header_title || null,
        header_subtitle: template.header_subtitle || null,
        notes: template.notes || null,
        is_active: template.is_active !== false,
        created_by_staff_profile_id: template.created_by_staff_profile_id || null,
      });
    } else if (action === "update") {
      if (!template.id) return Response.json({ error: "template.id required for update" }, { status: 400 });
      savedTemplate = await svc.entities.TimelineTemplate.update(template.id, {
        name: template.name.trim(),
        event_type: template.event_type,
        timeline_type: template.timeline_type,
        header_title: template.header_title || null,
        header_subtitle: template.header_subtitle || null,
        notes: template.notes || null,
        is_active: template.is_active !== false,
      });
    } else {
      return Response.json({ error: "action must be create or update" }, { status: 400 });
    }

    // Full replace of items
    const existingItems = await svc.entities.TimelineTemplateItem.filter({ template_id: savedTemplate.id }, "sort_order", 500);
    for (const item of existingItems) {
      await svc.entities.TimelineTemplateItem.delete(item.id);
    }

    const savedItems = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.activity_name?.trim()) continue;
      const saved = await svc.entities.TimelineTemplateItem.create({
        template_id: savedTemplate.id,
        sort_order: i,
        time_display: item.time_display || null,
        activity_name: item.activity_name.trim(),
        comments: item.comments || null,
      });
      savedItems.push(saved);
    }

    return Response.json({ template: savedTemplate, items: savedItems, saved: savedItems.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});