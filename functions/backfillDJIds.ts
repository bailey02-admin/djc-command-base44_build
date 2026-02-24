/**
 * One-time backfill: match events.assigned_dj (free-text name or email)
 * against DJProfile records and populate assigned_dj_id where a match is found.
 * Admin-only. Safe to run multiple times (skips already-linked events).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Forbidden: admin only" }, { status: 403 });

  const [allEvents, allDJs] = await Promise.all([
    base44.asServiceRole.entities.Event.list("-event_date", 1000),
    base44.asServiceRole.entities.DJProfile.list("name", 200),
  ]);

  // Build lookup maps: name (lower) → dj, email (lower) → dj
  const byName  = new Map(allDJs.map(dj => [dj.name?.toLowerCase(), dj]));
  const byEmail = new Map(allDJs.filter(dj => dj.email).map(dj => [dj.email.toLowerCase(), dj]));

  const toUpdate = allEvents.filter(e => e.assigned_dj && !e.assigned_dj_id && !e.is_deleted);

  const results = { matched: 0, unmatched: 0, skipped: 0, errors: 0 };
  const unmatched = [];

  for (const event of toUpdate) {
    const needle = (event.assigned_dj || "").toLowerCase().trim();
    const match = byName.get(needle) || byEmail.get(needle);

    if (match) {
      const ok = await base44.asServiceRole.entities.Event.update(event.id, {
        assigned_dj: match.name,       // normalize to canonical name
        assigned_dj_id: match.id,
      }).then(() => true).catch(() => false);

      if (ok) results.matched++;
      else results.errors++;
    } else {
      results.unmatched++;
      unmatched.push({ event_id: event.id, event_name: event.event_name, assigned_dj: event.assigned_dj });
    }
  }

  results.skipped = allEvents.length - toUpdate.length;

  return Response.json({ results, unmatched_events: unmatched });
});