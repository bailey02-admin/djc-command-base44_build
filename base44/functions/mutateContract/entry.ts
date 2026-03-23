/**
 * Secure Contract mutation endpoint.
 * Actions: create | update | delete | send | sign | void
 *
 * SERVER-SIDE STATUS TRANSITION MAP:
 *   draft   → sent
 *   sent    → signed | voided
 *   signed  → TERMINAL (admin override only)
 *   voided  → TERMINAL (admin override only)
 *
 * Admin override: pass { admin_override: true } in body — logged to Activity.
 *
 * Idempotency guarantees:
 *   send: only logs activity on first send (draft→sent); preserves sent_date on re-send
 *   sign: no-op if already signed; event.contract_signed = true
 *   void: only flips event.contract_signed = false if no OTHER signed contract exists for the event
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Transition map: current_status → Set of allowed next statuses
const CONTRACT_TRANSITIONS = {
  draft:  new Set(["sent"]),
  sent:   new Set(["signed", "voided"]),
  signed: new Set([]),   // terminal
  voided: new Set([]),   // terminal
};

async function enforceContractTransition(base44, contractId, toStatus, role, adminOverride, performedBy) {
  const rows = await base44.asServiceRole.entities.Contract.filter({ id: contractId });
  const current = rows[0];
  if (!current) return { error: "Contract not found", status: 404, current: null };

  const fromStatus = current.status;
  const allowed = CONTRACT_TRANSITIONS[fromStatus] || new Set();

  if (allowed.has(toStatus)) return { error: null, current };

  if (role === "admin" && adminOverride) {
    await base44.asServiceRole.entities.Activity.create({
      type: "system",
      subject: `⚠️ Admin override: Contract status ${fromStatus} → ${toStatus}`,
      related_type: "event",
      related_id: current.event_id,
      is_internal: true,
      performed_by: performedBy,
    }).catch(() => {});
    return { error: null, current };
  }

  return {
    error: `Invalid transition: contract is ${fromStatus} — cannot move to ${toStatus}. Allowed: [${[...allowed].join(", ") || "none (terminal)"}]`,
    status: 409,
    current: null,
  };
}

const ALLOWED = new Set(["admin", "city_manager", "sales_manager"]);
const ANY_ROLE = new Set(["admin", "city_manager", "sales_manager", "sales_rep", "finalizer"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = user.role || "sales_rep";
    if (!ANY_ROLE.has(role)) return Response.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { action, id, data = {}, admin_override = false } = body;

    if (action === "create") {
      if (!ALLOWED.has(role)) return Response.json({ error: "Forbidden: need manager+" }, { status: 403 });
      if (!data.event_id || !data.contact_name) {
        return Response.json({ error: "event_id and contact_name are required" }, { status: 400 });
      }
      const contract = await base44.asServiceRole.entities.Contract.create({
        ...data,
        status: "draft",
        contract_amount: Number(data.contract_amount || 0),
        version: 1,
      });
      await base44.asServiceRole.entities.Activity.create({
        type: "note",
        subject: `Contract created (draft)`,
        related_type: "event",
        related_id: data.event_id,
        is_internal: true,
        performed_by: user.email,
      }).catch(() => {});
      return Response.json({ contract });
    }

    if (action === "update") {
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      const payload = { ...data };
      if (payload.contract_amount !== undefined) payload.contract_amount = Number(payload.contract_amount);

      // Enforce status transition if status is being changed
      if (payload.status !== undefined) {
        const { error, status: errStatus } = await enforceContractTransition(base44, id, payload.status, role, admin_override, user.email);
        if (error) return Response.json({ error }, { status: errStatus || 409 });
      }

      const contract = await base44.asServiceRole.entities.Contract.update(id, payload);
      return Response.json({ contract });
    }

    if (action === "send") {
      if (!id) return Response.json({ error: "id required" }, { status: 400 });

      // Enforce transition: draft → sent
      const { error: txErr, status: txStatus, current } = await enforceContractTransition(base44, id, "sent", role, admin_override, user.email);
      if (txErr) return Response.json({ error: txErr }, { status: txStatus || 409 });

      const wasDraft = current.status === "draft";
      const contract = await base44.asServiceRole.entities.Contract.update(id, {
        status: "sent",
        // Preserve original sent_date on re-sends
        sent_date: current.sent_date || new Date().toISOString(),
      });
      // Only log activity on first send
      if (wasDraft) {
        await base44.asServiceRole.entities.Activity.create({
          type: "email",
          subject: `Contract sent to ${contract.contact_name}`,
          related_type: "event",
          related_id: contract.event_id,
          outcome: "email_sent",
          is_internal: false,
          performed_by: user.email,
        }).catch(() => {});
      }
      return Response.json({ contract });
    }

    if (action === "sign") {
      if (!id) return Response.json({ error: "id required" }, { status: 400 });

      // Enforce transition: sent → signed
      const { error: txErr, status: txStatus, current } = await enforceContractTransition(base44, id, "signed", role, admin_override, user.email);
      if (txErr) return Response.json({ error: txErr }, { status: txStatus || 409 });
      // Idempotent: already signed, return as-is
      if (current.status === "signed") return Response.json({ contract: current });

      const now = new Date().toISOString();
      const contract = await base44.asServiceRole.entities.Contract.update(id, {
        status: "signed",
        signed_date: now,
        signer_name: data.signer_name || current.contact_name,
      });
      if (contract.event_id) {
        await base44.asServiceRole.entities.Event.update(contract.event_id, {
          contract_signed: true,
        }).catch(() => {});
      }
      await base44.asServiceRole.entities.Activity.create({
        type: "note",
        subject: `Contract signed by ${data.signer_name || current.contact_name || "client"}`,
        related_type: "event",
        related_id: contract.event_id,
        outcome: "completed",
        is_internal: false,
        performed_by: user.email,
      }).catch(() => {});
      return Response.json({ contract });
    }

    if (action === "void") {
      if (!ALLOWED.has(role)) return Response.json({ error: "Forbidden" }, { status: 403 });
      if (!id) return Response.json({ error: "id required" }, { status: 400 });

      // Enforce transition: sent → voided
      const { error: txErr, status: txStatus } = await enforceContractTransition(base44, id, "voided", role, admin_override, user.email);
      if (txErr) return Response.json({ error: txErr }, { status: txStatus || 409 });

      const contract = await base44.asServiceRole.entities.Contract.update(id, { status: "voided" });

      // Only flip event.contract_signed to false if no OTHER non-voided signed contract exists
      if (contract.event_id) {
        const siblings = await base44.asServiceRole.entities.Contract.filter({ event_id: contract.event_id });
        const hasOtherSigned = siblings.some(c => c.id !== contract.id && c.status === "signed");
        if (!hasOtherSigned) {
          await base44.asServiceRole.entities.Event.update(contract.event_id, {
            contract_signed: false,
          }).catch(() => {});
        }
      }
      return Response.json({ contract });
    }

    if (action === "delete") {
      if (!ALLOWED.has(role)) return Response.json({ error: "Forbidden" }, { status: 403 });
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      await base44.asServiceRole.entities.Contract.delete(id);
      return Response.json({ ok: true });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});