import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ALLOWED = new Set(["admin","city_manager","office_finalizer"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !ALLOWED.has(user.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { event_id, action } = await req.json();
    if (!event_id || !action) {
      return Response.json({ error: "event_id and action required" }, { status: 400 });
    }

    const svc = base44.asServiceRole;

    const deleteAll = async (entity, filter) => {
      const records = await svc.entities[entity].filter(filter, "created_date", 1000);
      for (const r of records) await svc.entities[entity].delete(r.id);
      return records.length;
    };

    switch (action) {
      case "delete_song_requests": {
        const n = await deleteAll("SongRequest", { event_id });
        return Response.json({ ok: true, deleted: n });
      }
      case "delete_special_songs": {
        const n = await deleteAll("SpecialSong", { event_id });
        return Response.json({ ok: true, deleted: n });
      }
      case "delete_timeline": {
        const timelines = await svc.entities.StaffTimeline.filter({ event_id });
        let deleted = 0;
        for (const tl of timelines) {
          deleted += await deleteAll("StaffTimelineActivity", { timeline_id: tl.id });
          await svc.entities.StaffTimeline.delete(tl.id);
          deleted++;
        }
        return Response.json({ ok: true, deleted });
      }
      case "reset_all": {
        await deleteAll("SongRequest", { event_id });
        await deleteAll("SpecialSong", { event_id });
        const timelines = await svc.entities.StaffTimeline.filter({ event_id });
        for (const tl of timelines) {
          await deleteAll("StaffTimelineActivity", { timeline_id: tl.id });
          await svc.entities.StaffTimeline.delete(tl.id);
        }
        await svc.entities.Event.update(event_id, {
          planning_complete: false, timeline_complete: false, music_complete: false
        });
        return Response.json({ ok: true });
      }
      case "update_lock_status": {
        const { planning_lock_at } = await req.json().catch(() => ({}));
        return Response.json({ error: "Use event update directly" }, { status: 400 });
      }
      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});