import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const STAFF_ROLES = new Set(["admin","city_manager","sales_manager","sales_rep","office_finalizer","dj"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !STAFF_ROLES.has(user.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { event_id, template_id, apply_header = false, replace_existing = false } = await req.json();
    if (!event_id || !template_id) return Response.json({ error: "event_id and template_id required" }, { status: 400 });

    const svc = base44.asServiceRole;

    // Load template + items
    const templates = await svc.entities.TimelineTemplate.filter({ id: template_id, is_active: true });
    if (!templates[0]) return Response.json({ error: "Template not found or inactive" }, { status: 404 });
    const template = templates[0];

    const templateItems = await svc.entities.TimelineTemplateItem.filter({ template_id }, "sort_order", 200);

    // Upsert StaffTimeline header
    const existing = await svc.entities.StaffTimeline.filter({ event_id, timeline_type: template.timeline_type });
    let timeline;
    if (existing[0]) {
      const updateData = apply_header
        ? { header_title: template.header_title || existing[0].header_title, header_subtitle: template.header_subtitle || existing[0].header_subtitle }
        : {};
      if (Object.keys(updateData).length > 0) {
        timeline = await svc.entities.StaffTimeline.update(existing[0].id, updateData);
      } else {
        timeline = existing[0];
      }
    } else {
      timeline = await svc.entities.StaffTimeline.create({
        event_id,
        timeline_type: template.timeline_type,
        header_title: apply_header ? (template.header_title || "") : "",
        header_subtitle: apply_header ? (template.header_subtitle || "") : "",
      });
    }

    // Replace existing activities if requested
    if (replace_existing) {
      const oldActivities = await svc.entities.StaffTimelineActivity.filter({ timeline_id: timeline.id }, "sort_order", 500);
      for (const a of oldActivities) {
        await svc.entities.StaffTimelineActivity.delete(a.id);
      }
    }

    // Create activities from template items
    const savedActivities = [];
    for (let i = 0; i < templateItems.length; i++) {
      const item = templateItems[i];
      const record = await svc.entities.StaffTimelineActivity.create({
        timeline_id: timeline.id,
        event_id,
        time_display: item.time_display || "",
        activity_name: item.activity_name,
        comments: item.comments || "",
        sort_order: i,
        locked: false,
      });
      savedActivities.push(record);
    }

    return Response.json({ timeline, activities: savedActivities, applied: savedActivities.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});