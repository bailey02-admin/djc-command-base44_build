/**
 * Scoped client portal write endpoint.
 * Validates that the event_id being written to belongs to the authenticated user
 * (matched by contact_email on the event).
 * Supports saving EventPlanning and adding/deleting MusicSelections.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

    // Allow if user is staff (admin, sales_rep, etc.) OR is the contact
    const isStaff = !["client"].includes(user.role);
    const isOwner = event.contact_email && event.contact_email.toLowerCase() === user.email.toLowerCase();
    if (!isStaff && !isOwner) {
      return Response.json({ error: "Forbidden: not your event" }, { status: 403 });
    }

    if (action === "save_planning") {
      const planData = { ...data, event_id };
      const existing = await base44.asServiceRole.entities.EventPlanning.filter({ event_id }, "-created_date", 1);
      let result;
      if (existing[0]) {
        result = await base44.asServiceRole.entities.EventPlanning.update(existing[0].id, planData);
      } else {
        result = await base44.asServiceRole.entities.EventPlanning.create(planData);
      }
      // Fire-and-forget flag sync
      base44.asServiceRole.functions.invoke("syncEventFlags", { action: "sync_flags", event_id }).catch(() => {});
      return Response.json({ planning: result });
    }

    if (action === "add_song") {
      const song = await base44.asServiceRole.entities.MusicSelection.create({ ...data, event_id, added_by: "client" });
      return Response.json({ song });
    }

    if (action === "delete_song") {
      if (!music_id) return Response.json({ error: "music_id required" }, { status: 400 });
      // Verify the song belongs to this event
      const songs = await base44.asServiceRole.entities.MusicSelection.filter({ id: music_id, event_id }, "-created_date", 1);
      if (!songs[0]) return Response.json({ error: "Song not found on this event" }, { status: 404 });
      await base44.asServiceRole.entities.MusicSelection.delete(music_id);
      return Response.json({ success: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});