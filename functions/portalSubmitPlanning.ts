/**
 * portalSubmitPlanning — Client portal planning submission endpoint.
 *
 * Validates:
 *   1. Authenticated client session
 *   2. event.contact_id === user's resolved contact_id (strict ownership)
 *   3. Event is NOT past planning_lock_at (server-side lock enforcement)
 *   4. Required planning sections are present
 *
 * On success:
 *   - Sets planning_submitted_at on Event
 *   - Fires syncEventFlags to update readiness
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { event_id } = body;
    if (!event_id) return Response.json({ error: "event_id required" }, { status: 400 });

    // ── Resolve contact_id: PRIMARY = user.contact_id, FALLBACK = email ──────
    let resolvedContactId = user.contact_id || null;
    if (!resolvedContactId) {
      const contactRows = await base44.asServiceRole.entities.Contact.filter({ email: user.email }).catch(() => []);
      resolvedContactId = contactRows[0]?.id || null;
    }

    if (!resolvedContactId) {
      return Response.json({ error: "Forbidden: no contact record linked to your account" }, { status: 403 });
    }

    // ── Fetch event ──────────────────────────────────────────────────────────
    const eventRows = await base44.asServiceRole.entities.Event.filter({ id: event_id });
    const event = eventRows[0];
    if (!event || event.is_deleted) {
      return Response.json({ error: "Event not found" }, { status: 404 });
    }

    // ── Ownership: strict contact_id match ───────────────────────────────────
    if (!event.contact_id || event.contact_id !== resolvedContactId) {
      return Response.json({ error: "Forbidden: not your event" }, { status: 403 });
    }

    // ── Lock enforcement ─────────────────────────────────────────────────────
    if (event.planning_lock_at) {
      const lockTime = new Date(event.planning_lock_at).getTime();
      if (Date.now() >= lockTime) {
        return Response.json({
          error: "Planning is locked",
          locked: true,
          locked_at: event.planning_lock_at,
        }, { status: 422 });
      }
    }

    // ── Completeness check ───────────────────────────────────────────────────
    const [planningRows, timelineRows, musicRows] = await Promise.all([
      base44.asServiceRole.entities.EventPlanning.filter({ event_id }),
      base44.asServiceRole.entities.TimelineItem.filter({ event_id }),
      base44.asServiceRole.entities.MusicSelection.filter({ event_id }),
    ]);
    const planning = planningRows[0] || null;

    const SPECIAL_SONG_CATEGORIES = [
      "first_dance", "father_daughter", "mother_son",
      "grand_entrance", "cake_cutting", "last_dance",
    ];
    const OPTIONAL_SKIP_FLAG_PREFIX = "skip_special_";

    const missing = [];

    // Planning form
    if (!planning) {
      missing.push("planning");
    } else {
      if (!planning.vibe_description) missing.push("planning:vibe_description");
    }

    // Timeline: at least 5 items
    if (timelineRows.length < 5) {
      missing.push("timeline");
    }

    // Music: at least 1 must_play and 1 do_not_play
    const mustPlay = musicRows.filter(s => s.category === "must_play");
    const doNotPlay = musicRows.filter(s => s.category === "do_not_play");
    if (mustPlay.length === 0) missing.push("music:must_play");
    if (doNotPlay.length === 0) missing.push("music:do_not_play");

    // Special songs: each required formality must have a selection OR be marked skip
    for (const cat of SPECIAL_SONG_CATEGORIES) {
      const hasSong = musicRows.some(s => s.category === cat);
      const isSkipped = planning && planning[OPTIONAL_SKIP_FLAG_PREFIX + cat] === true;
      if (!hasSong && !isSkipped) {
        missing.push(`special_songs:${cat}`);
      }
    }

    if (missing.length > 0) {
      return Response.json({
        error: "INCOMPLETE_PLANNING",
        missing,
      }, { status: 422 });
    }

    // ── Stamp submission ─────────────────────────────────────────────────────
    const now = new Date().toISOString();
    await base44.asServiceRole.entities.Event.update(event_id, {
      planning_submitted_at: now,
    });

    // Fire syncEventFlags asynchronously
    base44.asServiceRole.functions.invoke("syncEventFlags", { action: "sync_flags", event_id }).catch(() => {});

    return Response.json({ success: true, planning_submitted_at: now });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});