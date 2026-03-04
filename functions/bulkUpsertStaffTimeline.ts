import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const STAFF_ROLES = new Set(["admin","city_manager","sales_manager","sales_rep","office_finalizer","dj"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !STAFF_ROLES.has(user.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { event_id, timeline_type = "PRIMARY", header, rows } = await req.json();
    if (!event_id || !Array.isArray(rows)) {
      return Response.json({ error: "event_id and rows required" }, { status: 400 });
    }

    const svc = base44.asServiceRole;

    // Upsert timeline header
    const existing = await svc.entities.StaffTimeline.filter({ event_id, timeline_type });
    let timeline;
    const headerData = { event_id, timeline_type, header_title: header?.title || "", header_subtitle: header?.subtitle || "" };
    if (existing[0]) {
      timeline = await svc.entities.StaffTimeline.update(existing[0].id, headerData);
    } else {
      timeline = await svc.entities.StaffTimeline.create(headerData);
    }

    // Delete existing activities
    const oldActivities = await svc.entities.StaffTimelineActivity.filter({ timeline_id: timeline.id }, "sort_order", 500);
    for (const a of oldActivities) {
      await svc.entities.StaffTimelineActivity.delete(a.id);
    }

    // Create new activities
    const saved = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.activity_name?.trim()) continue;
      const record = await svc.entities.StaffTimelineActivity.create({
        timeline_id: timeline.id,
        event_id,
        time_display: row.time_display || "",
        activity_name: row.activity_name,
        comments: row.comments || "",
        sort_order: i,
        linked_special_song_type: row.linked_special_song_type || null,
        locked: row.locked || false,
      });
      saved.push(record);
    }

    return Response.json({ timeline, activities: saved, saved: saved.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});