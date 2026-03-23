import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const STAFF_ROLES = new Set(["admin","city_manager","sales_manager","sales_rep","office_finalizer","dj"]);

const ALL_TYPES = [
  "processional","bridal_entrance","recessional",
  "first_dance","parent_dances","cake_cutting",
  "bouquet_toss","garter_toss","last_dance","other"
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !STAFF_ROLES.has(user.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { event_id, include_all_types = false } = await req.json();
    if (!event_id) return Response.json({ error: "event_id required" }, { status: 400 });

    const songs = await base44.asServiceRole.entities.SpecialSong.filter({ event_id }, "sort_order", 100);

    if (include_all_types) {
      const songMap = Object.fromEntries(songs.map(s => [s.special_song_type, s]));
      const rows = ALL_TYPES.map((type, i) => songMap[type] ?? {
        id: null, event_id, special_song_type: type,
        song: "", artist: "", location: "", comments: "",
        acquisition_status: "UNKNOWN", sort_order: i
      });
      return Response.json({ rows });
    }

    return Response.json({ rows: songs });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});