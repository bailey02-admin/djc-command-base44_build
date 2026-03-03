/**
 * Scoped client portal write endpoint.
 * Validates that the event_id being written to belongs to the authenticated user
 * (matched by contact_email on the event).
 * Supports saving EventPlanning and adding/deleting MusicSelections.
 *
 * Calls trackClientChanges on ALL mutation paths when dj_reviewed_at is set.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Planning fields that are tracked for change description
const PLANNING_TRACKED_FIELDS = [
  "bride_full_name","groom_full_name","formality_level","vibe_description",
  "genre_preferences","genre_dislikes","dj_freedom_level",
  "special_requests","notes_to_dj","ceremony_details",
  "cocktail_vibe","dinner_vibe","dance_vibe","special_announcements",
];

function describePlanningChanges(oldData, newData) {
  if (!oldData) return "Planning form submitted";
  const changed = PLANNING_TRACKED_FIELDS.filter(f => {
    const o = JSON.stringify(oldData[f] ?? "");
    const n = JSON.stringify(newData[f] ?? "");
    return o !== n;
  });
  return changed.length > 0 ? `Planning fields updated: ${changed.join(", ")}` : "Planning form saved";
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action, event_id, data, music_id } = body;

    if (!event_id) return Response.json({ error: "event_id required" }, { status: 400 });

    // Validate event ownership: the authenticated user's email must match contact_email on the event
    const events = await base44.asServiceRole.entities.Event.filter({ id: event_id }, "-created_date", 1);
    const event = events[0];
    if (!event) return Response.json({ error: "Event not found" }, { status: 404 });

    // Staff roles bypass ownership check
    const isStaff = user.role !== "client";
    if (!isStaff) {
      // PRIMARY: user.contact_id (stamped at provisioning); FALLBACK: email lookup
      let resolvedContactId = user.contact_id || null;
      if (!resolvedContactId) {
        const rows = await base44.asServiceRole.entities.Contact.filter({ email: user.email }).catch(() => []);
        resolvedContactId = rows[0]?.id || null;
      }

      if (!resolvedContactId || !event.contact_id || event.contact_id !== resolvedContactId) {
        return Response.json({ error: "Forbidden: not your event" }, { status: 403 });
      }

      // Lock enforcement for any client write
      if (event.planning_lock_at && Date.now() >= new Date(event.planning_lock_at).getTime()) {
        return Response.json({ error: "Planning is locked", locked: true }, { status: 422 });
      }
    }

    // Helper: fire trackClientChanges if dj_reviewed_at is set
    const maybeTrackChange = (entityType, description) => {
      if (!event.dj_reviewed_at) return;
      base44.asServiceRole.functions.invoke("trackClientChanges", {
        event_id,
        entity_type: entityType,
        change_description: description,
        changed_by: user.email,
      }).catch(() => {});
    };

    if (action === "save_planning") {
      const planData = { ...data, event_id };
      const existing = await base44.asServiceRole.entities.EventPlanning.filter({ event_id }, "-created_date", 1);
      let result;
      let description = "Planning form submitted";
      if (existing[0]) {
        description = describePlanningChanges(existing[0], planData);
        result = await base44.asServiceRole.entities.EventPlanning.update(existing[0].id, planData);
      } else {
        result = await base44.asServiceRole.entities.EventPlanning.create(planData);
      }
      maybeTrackChange("EventPlanning", description);
      // Fire-and-forget flag sync
      base44.asServiceRole.functions.invoke("syncEventFlags", { action: "sync_flags", event_id }).catch(() => {});
      return Response.json({ planning: result });
    }

    // ── Music selection limits ────────────────────────────────────────────────
    const MUSIC_LIMITS = {
      must_play: 20, do_not_play: 20, dedication: 10, dinner: 30,
      cocktail_hour: 30, open_dance: 50,
      first_dance: 1, father_daughter: 1, mother_son: 1,
      grand_entrance: 1, cake_cutting: 1, last_dance: 1,
      wedding_party_entrance: 1, ceremony_processional: 5, ceremony_recessional: 5,
    };
    const TOTAL_MUSIC_LIMIT = 80;

    if (action === "add_song") {
      const { category, song_title, artist } = data;
      if (!song_title) return Response.json({ error: "song_title required" }, { status: 400 });

      // Check for duplicate
      const allSongs = await base44.asServiceRole.entities.MusicSelection.filter({ event_id });
      const duplicate = allSongs.find(s =>
        s.song_title?.toLowerCase() === song_title?.toLowerCase() &&
        (artist ? s.artist?.toLowerCase() === artist?.toLowerCase() : true) &&
        s.category === category
      );
      if (duplicate) return Response.json({ error: "Song already added in this category" }, { status: 422 });

      // Check limits
      if (allSongs.length >= TOTAL_MUSIC_LIMIT) {
        return Response.json({ error: `Total music limit of ${TOTAL_MUSIC_LIMIT} songs reached` }, { status: 422 });
      }
      const catLimit = MUSIC_LIMITS[category];
      if (catLimit !== undefined) {
        const catCount = allSongs.filter(s => s.category === category).length;
        if (catCount >= catLimit) {
          return Response.json({ error: `Limit of ${catLimit} songs reached for category: ${category}` }, { status: 422 });
        }
      }

      const song = await base44.asServiceRole.entities.MusicSelection.create({ ...data, event_id, added_by: "client" });
      maybeTrackChange("music", `Client added song: ${song_title} – ${artist || ""} (${category || ""})`);
      return Response.json({ song });
    }

    if (action === "delete_song") {
      if (!music_id) return Response.json({ error: "music_id required" }, { status: 400 });
      const songs = await base44.asServiceRole.entities.MusicSelection.filter({ id: music_id, event_id }, "-created_date", 1);
      if (!songs[0]) return Response.json({ error: "Song not found on this event" }, { status: 404 });
      const songTitle = songs[0].song_title || music_id;
      await base44.asServiceRole.entities.MusicSelection.delete(music_id);
      maybeTrackChange("music", `Client removed song: ${songTitle}`);
      return Response.json({ success: true });
    }

    // ── Timeline actions ──────────────────────────────────────────────────────
    if (action === "timeline_create") {
      const { segment_name, time, notes, order } = data;
      if (!segment_name) return Response.json({ error: "segment_name required" }, { status: 400 });
      const item = await base44.asServiceRole.entities.TimelineItem.create({
        event_id, segment_name, time: time || "", notes: notes || "", order: order ?? 0,
      });
      maybeTrackChange("timeline", `Client added timeline item: ${segment_name}${time ? " at " + time : ""}`);
      return Response.json({ item });
    }

    if (action === "timeline_update") {
      const { item_id, ...updateData } = data;
      if (!item_id) return Response.json({ error: "item_id required" }, { status: 400 });
      const rows = await base44.asServiceRole.entities.TimelineItem.filter({ id: item_id, event_id }, "-created_date", 1);
      if (!rows[0]) return Response.json({ error: "Timeline item not found" }, { status: 404 });
      const old = rows[0];
      const updated = await base44.asServiceRole.entities.TimelineItem.update(item_id, updateData);
      const desc = `Client updated timeline item: ${old.segment_name}${old.time ? " " + old.time : ""}${updateData.time && updateData.time !== old.time ? " → " + updateData.time : ""}`;
      maybeTrackChange("timeline", desc);
      return Response.json({ item: updated });
    }

    if (action === "timeline_delete") {
      const { item_id } = data;
      if (!item_id) return Response.json({ error: "item_id required" }, { status: 400 });
      const rows = await base44.asServiceRole.entities.TimelineItem.filter({ id: item_id, event_id }, "-created_date", 1);
      if (!rows[0]) return Response.json({ error: "Timeline item not found" }, { status: 404 });
      await base44.asServiceRole.entities.TimelineItem.delete(item_id);
      maybeTrackChange("timeline", `Client removed timeline item: ${rows[0].segment_name}`);
      return Response.json({ success: true });
    }

    if (action === "timeline_reorder") {
      // data.items = [{ id, order }]
      const { items: reorderItems = [] } = data;
      if (!reorderItems.length) return Response.json({ error: "items required" }, { status: 400 });
      for (const { id: iid, order: iorder } of reorderItems) {
        await base44.asServiceRole.entities.TimelineItem.update(iid, { order: iorder });
      }
      maybeTrackChange("timeline", "Client reordered timeline");
      return Response.json({ success: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});