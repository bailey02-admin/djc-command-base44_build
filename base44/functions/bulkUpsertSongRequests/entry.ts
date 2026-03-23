import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const STAFF_ROLES = new Set(["admin","city_manager","sales_manager","sales_rep","office_finalizer","dj"]);

function normalize(s) {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

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

    // Only save rows with at least a song title
    const toSave = rows.filter(r => r.song?.trim());

    // Duplicate check for MUST_PLAY / DO_NOT_PLAY
    const dupeWarnings = [];
    const seen = {};
    for (const row of toSave) {
      if (row.classification === "MUST_PLAY" || row.classification === "DO_NOT_PLAY") {
        const key = `${row.classification}::${normalize(row.song)}::${normalize(row.artist)}`;
        if (seen[key]) {
          dupeWarnings.push(`Duplicate: ${row.classification} - ${row.song} by ${row.artist}`);
        }
        seen[key] = true;
      }
    }

    // Delete existing and re-insert
    const existing = await svc.entities.SongRequest.filter({ event_id }, "sort_order", 1000);
    for (const r of existing) {
      await svc.entities.SongRequest.delete(r.id);
    }

    const created = [];
    for (let i = 0; i < toSave.length; i++) {
      const { id: _id, ...data } = toSave[i];
      const record = await svc.entities.SongRequest.create({ ...data, event_id, sort_order: i, source: "staff" });
      created.push(record);
    }

    return Response.json({ saved: created.length, warnings: dupeWarnings });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});