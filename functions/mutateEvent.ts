/**
 * Secure Event mutation endpoint.
 * Actions: create | update | toggle_readiness | assign_dj | mark_dj_reviewed | delete
 *
 * Enforces:
 *  - Role-based access + city scoping + field-level write protection
 *  - Finalization gating: status cannot advance to "finalized" unless readiness checklist passes
 *  - dj_reviewed_at stamp via mark_dj_reviewed action
 *  - Post-event automation triggers (server-side)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { canAccessEvent } from './crm/accessControl.js';

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

const WRITE_PROTECTED_FIELDS = {
  dj:               ["package_price","contact_email","contact_phone","lead_id","assigned_dj","assigned_dj_id","assigned_mc","assigned_mc_id"],
  office_finalizer: ["package_price","lead_id"],
};

/**
 * Canonical finalization checklist — SINGLE source of truth.
 * Also used by FinalizationChecklist.jsx (UI) for display.
 * Only `blocking: true` items gate the status→finalized transition.
 * isString=true items are truthy-checked (string presence), others boolean.
 */
const FINALIZATION_REQUIRED = [
  { key: "contract_signed",        label: "Contract signed",           blocking: true  },
  { key: "deposit_paid",           label: "Deposit received",          blocking: true  },
  { key: "planning_complete",      label: "Planning form completed",   blocking: true  },
  { key: "timeline_complete",      label: "Event timeline built",      blocking: true  },
  { key: "music_complete",         label: "Music selections done",     blocking: true  },
  { key: "balance_paid",           label: "Final balance collected",   blocking: true  },
  { key: "final_call_completed",   label: "Final call completed",      blocking: true  },
  { key: "assigned_dj",           label: "DJ assigned",               blocking: true,  isString: true },
  { key: "dj_briefed",            label: "DJ briefed",                blocking: true  },
  { key: "pronunciation_complete", label: "Pronunciation list done",   blocking: false },
  { key: "special_songs_complete", label: "Special songs confirmed",   blocking: false },
  { key: "internal_notes_reviewed",label: "Internal notes reviewed",  blocking: false },
];

function stripProtectedFields(data, role) {
  const blocked = WRITE_PROTECTED_FIELDS[role] || [];
  const out = { ...data };
  for (const f of blocked) delete out[f];
  return out;
}

function checkFinalizationGate(event) {
  // Only blocking items prevent finalization
  return FINALIZATION_REQUIRED.filter(item => {
    if (!item.blocking) return false;
    const val = event[item.key];
    return item.isString ? !val || val === "" : !val;
  });
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

    // ── CREATE ────────────────────────────────────────────────────
    if (action === "create") {
      if (!rules.create) {
        await logDenial(base44, user, "create_event", null, "role denied");
        return Response.json({ error: "Forbidden: your role cannot create events" }, { status: 403 });
      }
      // PHASE C: lead_id is REQUIRED
      if (!data.lead_id) {
        return Response.json({ error: "LEAD_ID_REQUIRED", details: "All new events must be linked to a lead" }, { status: 422 });
      }
      const event = await base44.asServiceRole.entities.Event.create(data);
      return Response.json({ event });
    }

    // ── ASSIGN DJ ─────────────────────────────────────────────────
    if (action === "assign_dj") {
      if (!["admin","city_manager","sales_manager"].includes(role)) {
        await logDenial(base44, user, "assign_dj", id, "role denied");
        return Response.json({ error: "Forbidden: your role cannot assign DJs" }, { status: 403 });
      }
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      const updated = await base44.asServiceRole.entities.Event.update(id, {
        assigned_dj:    data.assigned_dj,
        assigned_dj_id: data.assigned_dj_id,
        assigned_mc:    data.assigned_mc,
        assigned_mc_id: data.assigned_mc_id,
      });
      await base44.asServiceRole.entities.Activity.create({
        type: "assignment",
        subject: `DJ assigned: ${data.assigned_dj || "unassigned"}`,
        related_type: "event",
        related_id: id,
        is_internal: true,
        performed_by: user.email,
      }).catch(() => {});
      return Response.json({ event: updated });
    }

    // ── MARK DJ REVIEWED ─────────────────────────────────────────
    if (action === "mark_dj_reviewed") {
      if (!["admin","city_manager","sales_manager","office_finalizer","dj"].includes(role)) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      const now = new Date().toISOString();
      const updated = await base44.asServiceRole.entities.Event.update(id, {
        dj_reviewed_at: now,
        client_changed_after_review: false, // reset flag on re-review
      });
      await base44.asServiceRole.entities.Activity.create({
        type: "system",
        subject: `✅ DJ reviewed event details`,
        description: `Reviewed by ${user.email} at ${now}`,
        related_type: "event",
        related_id: id,
        is_internal: true,
        performed_by: user.email,
      }).catch(() => {});
      return Response.json({ event: updated });
    }

    // ── UPDATE / TOGGLE_READINESS ─────────────────────────────────
    if (action === "update" || action === "toggle_readiness") {
      if (!rules.update) {
        await logDenial(base44, user, action, id, "role denied");
        return Response.json({ error: "Forbidden: your role cannot update events" }, { status: 403 });
      }
      if (!id) return Response.json({ error: "id required" }, { status: 400 });

      // Fetch pre-update event for scoping + finalization gate
      const rows = await base44.asServiceRole.entities.Event.filter({ id });
      const preUpdateEvent = rows[0];
      if (!preUpdateEvent || preUpdateEvent.is_deleted) {
        return Response.json({ error: "Event not found" }, { status: 404 });
      }

      // Access check via centralized rule
      if (!canAccessEvent(user, preUpdateEvent)) {
        await logDenial(base44, user, action, id, "outside city or not assigned");
        return Response.json({ error: "Forbidden: access denied" }, { status: 403 });
      }

      const cleaned = stripProtectedFields(data, role);

      // ── Finalization gate ─────────────────────────────────────
      // If status is being set to "finalized", check all readiness items
      if (cleaned.status === "finalized") {
        const mergedEvent = { ...preUpdateEvent, ...cleaned };
        const failing = checkFinalizationGate(mergedEvent);
        if (failing.length > 0) {
          return Response.json({
            error: "Event cannot be finalized — checklist incomplete",
            failing_items: failing.map(f => f.label),
            failing_keys: failing.map(f => f.key),
          }, { status: 422 });
        }
      }

      const updated = await base44.asServiceRole.entities.Event.update(id, cleaned);

      // ── Track client-visible field changes post-DJ-review ─────────
      // Fields that are planning-relevant and should trigger re-brief warning
      const TRACKED_EVENT_FIELDS = [
        "venue_name","venue_id","ceremony_venue","guest_count","start_time","end_time",
        "setup_time","load_in_notes","client_notes","internal_notes",
      ];
      const changedTrackedFields = TRACKED_EVENT_FIELDS.filter(
        f => cleaned[f] !== undefined && cleaned[f] !== preUpdateEvent[f]
      );
      if (changedTrackedFields.length > 0 && preUpdateEvent.dj_reviewed_at) {
        base44.asServiceRole.functions.invoke("trackClientChanges", {
          event_id: id,
          entity_type: "EventPlanning",
          change_description: `Event fields updated: ${changedTrackedFields.join(", ")}`,
          changed_by: user.email,
        }).catch(() => {});
      }

      // ── PHASE D: Snapshot quote on Booked (fallback if not yet snapshotted) ─
      if (cleaned.status === "booked" && preUpdateEvent.lead_id) {
       const needsSnapshot = !preUpdateEvent.package_name || !preUpdateEvent.total_fee;
       if (needsSnapshot) {
         base44.asServiceRole.functions.invoke("snapshotQuoteToEvent", {
           event_id: id,
           lead_id: preUpdateEvent.lead_id,
         }).catch(() => {});
       }
      }

      // ── Post-event automation triggers (server-side, idempotent) ─
      if (cleaned.status === "completed") {
       base44.asServiceRole.functions.invoke("postEventAutomation", {
         action: "event_completed",
         event_id: id,
       }).catch(() => {});
      }

      if (cleaned.survey_score !== undefined && cleaned.survey_score !== null) {
       const hadScoreBefore = preUpdateEvent.survey_score !== undefined && preUpdateEvent.survey_score !== null;
       if (!hadScoreBefore) {
         base44.asServiceRole.functions.invoke("postEventAutomation", {
           action: "survey_received",
           event_id: id,
           survey_score: cleaned.survey_score,
         }).catch(() => {});
       }
      }

      return Response.json({ event: updated });
    }

    // ── DELETE ────────────────────────────────────────────────────
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