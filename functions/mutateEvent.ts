/**
 * Secure Event mutation endpoint.
 * Actions: create | update | toggle_readiness | delete
 * Enforces role-based access, city scoping, field-level write protection.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const EVENT_WRITE_RULES = {
  admin:            { create: true, update: true, delete: true },
  city_manager:     { create: true, update: true, delete: false },
  sales_manager:    { create: true, update: true, delete: false },
  sales_rep:        { create: false, update: false, delete: false },
  dj:               { create: false, update: false, delete: false },
  office_finalizer: { create: false, update: true, delete: false },
  finance:          { create: false, update: false, delete: false },
  client:           { create: false, update: false, delete: false },
};

// Fields DJs/finalizers cannot write
const WRITE_PROTECTED_FIELDS = {
  // DJs cannot touch financials, contacts, or reassign themselves/others
  dj:               ["package_price", "contact_email", "contact_phone", "lead_id", "assigned_dj", "assigned_dj_id", "assigned_mc", "assigned_mc_id"],
  office_finalizer: ["package_price", "lead_id"],
};

function stripProtectedFields(data, role) {
  const blocked = WRITE_PROTECTED_FIELDS[role] || [];
  const out = { ...data };
  for (const f of blocked) delete out[f];
  return out;
}

async function logDenial(base44, user, action, eventId, reason) {
  await base44.asServiceRole.entities.Activity.create({
    type: "system",
    subject: `🚫 DENIED: ${user.email} attempted ${action} on event ${eventId} — ${reason}`,
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

      // City scoping for city_manager
      let preUpdateEvent = null;
      if (role === "city_manager" && user.city) {
        const rows = await base44.asServiceRole.entities.Event.filter({ id });
        preUpdateEvent = rows[0];
        if (preUpdateEvent && preUpdateEvent.city !== user.city) {
          await logDenial(base44, user, action, id, "outside city");
          return Response.json({ error: "Forbidden: outside your city" }, { status: 403 });
        }
      }

      const cleaned = stripProtectedFields(data, role);
      const updated = await base44.asServiceRole.entities.Event.update(id, cleaned);

      // ── Post-event automation triggers (server-side, idempotent) ─────
      if (cleaned.status === "event_completed") {
        base44.asServiceRole.functions.invoke("postEventAutomation", {
          action: "event_completed",
          event_id: id,
        }).catch(() => {});
      }

      // survey_received: only fire when score transitions from null/absent → a value.
      // Fetch pre-update event if we haven't already (city_manager path may have it).
      if (cleaned.survey_score !== undefined && cleaned.survey_score !== null) {
        const preEvent = preUpdateEvent ||
          (await base44.asServiceRole.entities.Event.filter({ id }).catch(() => []))[0];
        const hadScoreBefore = preEvent && preEvent.survey_score !== undefined && preEvent.survey_score !== null;
        if (!hadScoreBefore) {
          // First-time score write — fire trigger
          base44.asServiceRole.functions.invoke("postEventAutomation", {
            action: "survey_received",
            event_id: id,
            survey_score: cleaned.survey_score,
          }).catch(() => {});
        }
        // If score already existed, postEventAutomation idempotency (AutomationLog) is the secondary guard,
        // but we avoid the call entirely here for score edits/corrections.
      }

      return Response.json({ event: updated });
    }

    if (action === "delete") {
      if (!rules.delete) {
        await logDenial(base44, user, "delete_event", id, "role denied");
        return Response.json({ error: "Forbidden: your role cannot delete events" }, { status: 403 });
      }
      await base44.asServiceRole.entities.Event.update(id, { is_deleted: true });
      return Response.json({ ok: true });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});