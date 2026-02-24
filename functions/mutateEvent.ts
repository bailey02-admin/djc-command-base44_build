/**
 * Secure Event mutation endpoint.
 * DJs: read-only (all mutations blocked).
 * Sales reps: cannot create/update events directly.
 * Office finalizer: can update (for planning/finalization fields) but not create.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const EVENT_WRITE_RULES = {
  admin:            { create: true, update: true, delete: true },
  city_manager:     { create: true, update: true, delete: false },
  sales_manager:    { create: true, update: true, delete: false },
  sales_rep:        { create: false, update: false, delete: false },
  dj:               { create: false, update: false, delete: false },
  office_finalizer: { create: false, update: true,  delete: false },
  finance:          { create: false, update: false, delete: false },
  client:           { create: false, update: false, delete: false },
};

// Fields sales reps and office finalizers cannot touch
const WRITE_PROTECTED_FIELDS = {
  office_finalizer: ["package_price", "package_name", "lead_id", "assigned_dj", "assigned_city_manager"],
};

async function logDenial(base44, user, action, eventId, reason) {
  await base44.asServiceRole.entities.Activity.create({
    type: "system",
    subject: `🚫 DENIED: ${user.email} attempted ${action} on event ${eventId || "new"} — ${reason}`,
    related_type: "event",
    related_id: eventId || "unknown",
    is_internal: true,
    performed_by: user.email,
  }).catch(() => {});
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = user.role || "sales_rep";
    const rules = EVENT_WRITE_RULES[role] || { create: false, update: false, delete: false };

    const body = await req.json().catch(() => ({}));
    const { action, id, data = {} } = body;

    if (action === "create") {
      if (!rules.create) {
        await logDenial(base44, user, "create_event", null, "role denied");
        return Response.json({ error: "Forbidden: your role cannot create events" }, { status: 403 });
      }
      const event = await base44.asServiceRole.entities.Event.create(data);
      return Response.json({ event });
    }

    if (action === "update" || action === "toggle_readiness") {
      if (!rules.update) {
        await logDenial(base44, user, action, id, "role denied");
        return Response.json({ error: "Forbidden: your role cannot update events" }, { status: 403 });
      }
      if (!id) return Response.json({ error: "id required" }, { status: 400 });

      // DJ cannot update anything
      if (role === "dj") {
        await logDenial(base44, user, action, id, "DJ is read-only on events");
        return Response.json({ error: "Forbidden: DJs cannot update events" }, { status: 403 });
      }

      // City manager: city-scoped
      if (role === "city_manager" && user.city) {
        const rows = await base44.asServiceRole.entities.Event.filter({ id });
        const ev = rows[0];
        if (ev && ev.city !== user.city) {
          await logDenial(base44, user, action, id, "outside city");
          return Response.json({ error: "Forbidden: outside your city" }, { status: 403 });
        }
      }

      // Strip protected fields for role
      const blocked = WRITE_PROTECTED_FIELDS[role] || [];
      const cleaned = { ...data };
      for (const f of blocked) delete cleaned[f];

      const updated = await base44.asServiceRole.entities.Event.update(id, cleaned);
      return Response.json({ event: updated });
    }

    if (action === "delete") {
      if (!rules.delete) {
        await logDenial(base44, user, "delete_event", id, "role denied");
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      await base44.asServiceRole.entities.Event.update(id, { is_deleted: true });
      return Response.json({ ok: true });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});