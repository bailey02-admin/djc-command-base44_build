import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const STAFF_ROLES = new Set(["admin","city_manager","sales_manager","sales_rep","office_finalizer","dj"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !STAFF_ROLES.has(user.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { event_id, target_rows = 99 } = await req.json();
    if (!event_id) return Response.json({ error: "event_id required" }, { status: 400 });

    const rows = await base44.asServiceRole.entities.SongRequest.filter(
      { event_id },
      "sort_order",
      500
    );

    // Pad with blank rows up to target_rows
    const blanks = Array.from({ length: Math.max(0, target_rows - rows.length) }, (_, i) => ({
      id: null,
      event_id,
      sort_order: rows.length + i,
      classification: "PLAY_IF_POSSIBLE",
      song: "", artist: "", location: "", comments: "",
    }));

    return Response.json({ rows: [...rows, ...blanks], total: rows.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});