/**
 * Secure Payment mutation endpoint.
 * Only admin, city_manager, sales_manager, finance can create/update payments.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const PAYMENT_WRITE_ALLOWED = new Set(["admin", "city_manager", "sales_manager", "finance"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = user.role || "sales_rep";
    if (!PAYMENT_WRITE_ALLOWED.has(role)) {
      return Response.json({ error: "Forbidden: your role cannot create or modify payments" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, id, data = {} } = body;

    if (action === "create") {
      if (!data.event_id || !data.amount || !data.payment_type) {
        return Response.json({ error: "event_id, amount, and payment_type are required" }, { status: 400 });
      }
      const payment = await base44.asServiceRole.entities.Payment.create({
        ...data,
        amount: Number(data.amount),
      });
      return Response.json({ payment });
    }

    if (action === "update") {
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      const updated = await base44.asServiceRole.entities.Payment.update(id, data);
      return Response.json({ payment: updated });
    }

    if (action === "delete") {
      if (role !== "admin") {
        return Response.json({ error: "Forbidden: only admin can delete payments" }, { status: 403 });
      }
      await base44.asServiceRole.entities.Payment.delete(id);
      return Response.json({ ok: true });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});