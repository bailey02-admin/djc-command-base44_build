/**
 * getMusicTimeline — Secure read endpoint for MusicSelection and TimelineItem.
 * DJs can read only their assigned event's music/timeline (enforced via event check).
 * Clients get no access (they go through getEventDetail which returns the safe bundle).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const DENIED = new Set(["client"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = user.role || "sales_rep";
    if (DENIED.has(role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { entity, event_id } = body;

    if (!["MusicSelection", "TimelineItem"].includes(entity)) {
      return Response.json({ error: "entity must be MusicSelection or TimelineItem" }, { status: 400 });
    }
    if (!event_id) return Response.json({ error: "event_id required" }, { status: 400 });

    // For DJs: verify event is assigned to them
    if (role === "dj") {
      const eventRows = await base44.asServiceRole.entities.Event.filter({ id: event_id });
      const event = eventRows[0];
      if (!event || event.assigned_dj !== user.email) {
        return Response.json({ error: "Forbidden: not your event" }, { status: 403 });
      }
    }

    const sort = entity === "TimelineItem" ? "order" : "category";
    const records = await base44.asServiceRole.entities[entity].filter({ event_id }, sort, 200);

    return Response.json({ records });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});