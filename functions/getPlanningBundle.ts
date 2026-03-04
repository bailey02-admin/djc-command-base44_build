import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const STAFF_ROLES = new Set(["admin","city_manager","sales_manager","sales_rep","office_finalizer","dj"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !STAFF_ROLES.has(user.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { event_id } = await req.json();
    if (!event_id) return Response.json({ error: "event_id required" }, { status: 400 });

    const svc = base44.asServiceRole;

    const [events, permissions, specialSongs, songRequests] = await Promise.all([
      svc.entities.Event.filter({ id: event_id }),
      svc.entities.PlanningPermissions.filter({ event_id }),
      svc.entities.SpecialSong.filter({ event_id }),
      svc.entities.SongRequest.filter({ event_id }),
    ]);

    const event = events[0] ?? null;
    if (!event) return Response.json({ error: "Event not found" }, { status: 404 });

    const perms = permissions[0] ?? null;

    return Response.json({
      event,
      permissions: perms,
      stats: {
        special_song_count: specialSongs.length,
        song_request_count: songRequests.length,
      }
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});