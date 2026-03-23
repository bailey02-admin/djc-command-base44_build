import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const STAFF_ROLES = new Set(["admin","city_manager","sales_manager","sales_rep","office_finalizer","dj"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !STAFF_ROLES.has(user.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { event_id, rows } = await req.json();
    if (!event_id || !Array.isArray(rows)) {
      return Response.json({ error: "event_id and rows required" }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const results = [];

    for (let i = 0; i < rows.length; i++) {
      const { id, ...data } = rows[i];
      const payload = { ...data, event_id, sort_order: i };
      let record;
      if (id) {
        record = await svc.entities.SpecialSong.update(id, payload);
      } else if (payload.song?.trim()) {
        record = await svc.entities.SpecialSong.create(payload);
      } else {
        continue;
      }
      results.push(record);
    }

    return Response.json({ saved: results.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});