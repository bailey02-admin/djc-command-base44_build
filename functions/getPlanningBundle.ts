import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const STAFF_ROLES = new Set(["admin","city_manager","sales_manager","sales_rep","office_finalizer","dj"]);

const DEFAULT_PERMISSIONS = {
  song_request_system_visible: true,
  song_request_system_editable: true,
  timeline_permissions_view: true,
  timeline_permissions_edit: true,
  fees_and_payments_visible: false,
  addon_fees_visible: false,
  guest_requests_enabled: false,
};

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

    // Fetch everything in parallel; never throw if optional entities missing
    const [eventList, permissionsList, specialSongs, songRequests] = await Promise.all([
      svc.entities.Event.filter({ id: event_id }, "created_date", 2).catch(() => []),
      svc.entities.PlanningPermissions.filter({ event_id }, "created_date", 5).catch(() => []),
      svc.entities.SpecialSong.filter({ event_id }, "sort_order", 200).catch(() => []),
      svc.entities.SongRequest.filter({ event_id }, "sort_order", 500).catch(() => []),
    ]);

    // Also try direct get if filter returned nothing (handles id lookup edge cases)
    let event = eventList[0] ?? null;
    if (!event) {
      try { event = await svc.entities.Event.get(event_id); } catch (_) {}
    }
    if (!event) return Response.json({ error: "Event not found" }, { status: 404 });

    // Permissions: merge defaults so all keys always present
    const permRecord = permissionsList[0] ?? null;
    const permissions = { ...DEFAULT_PERMISSIONS, ...(permRecord || {}) };

    return Response.json({
      event,
      permissions,
      permissions_record_exists: !!permRecord,
      stats: {
        special_song_count: specialSongs.length,
        song_request_count: songRequests.filter(r => r.song?.trim()).length,
        timeline_activity_count: 0,
      },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});