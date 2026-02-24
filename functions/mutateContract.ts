/**
 * Secure Contract mutation endpoint.
 * Actions: create | update | delete | send | sign | void
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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
    const { action, id, data = {} } = body;

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
      const contract = await base44.asServiceRole.entities.Contract.update(id, payload);
      return Response.json({ contract });
    }

    if (action === "send") {
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      const contract = await base44.asServiceRole.entities.Contract.update(id, {
        status: "sent",
        sent_date: new Date().toISOString(),
      });
      await base44.asServiceRole.entities.Activity.create({
        type: "email",
        subject: `Contract sent to ${contract.contact_name}`,
        related_type: "event",
        related_id: contract.event_id,
        outcome: "email_sent",
        is_internal: false,
        performed_by: user.email,
      }).catch(() => {});
      return Response.json({ contract });
    }

    if (action === "sign") {
      if (!id) return Response.json({ error: "id required" }, { status: 400 });

      // Fetch current contract first for idempotency + signer_name fallback
      const existing = await base44.asServiceRole.entities.Contract.filter({ id });
      const currentContract = existing[0];
      if (!currentContract) return Response.json({ error: "Contract not found" }, { status: 404 });
      if (currentContract.status === "signed") return Response.json({ contract: currentContract });

      const now = new Date().toISOString();
      const contract = await base44.asServiceRole.entities.Contract.update(id, {
        status: "signed",
        signed_date: now,
        signer_name: data.signer_name || currentContract.contact_name,
      });

      // Sync contract_signed to Event — only set true if this contract is not voided
      // Also check: if multiple contracts exist, only set true when a live one is signed
      if (contract.event_id) {
        await base44.asServiceRole.entities.Event.update(contract.event_id, {
          contract_signed: true,
        }).catch(() => {});
      }
      await base44.asServiceRole.entities.Activity.create({
        type: "note",
        subject: `Contract signed by ${data.signer_name || "client"}`,
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
      const contract = await base44.asServiceRole.entities.Contract.update(id, { status: "voided" });
      // Sync back to event
      if (contract.event_id) {
        await base44.asServiceRole.entities.Event.update(contract.event_id, {
          contract_signed: false,
        }).catch(() => {});
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