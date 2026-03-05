/**
 * Secure Payment mutation endpoint.
 * Only admin, city_manager, sales_manager, finance can create/update payments.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const PAYMENT_WRITE_ALLOWED = new Set(["admin", "city_manager", "sales_manager", "finance"]);

async function resolveRole(base44, user) {
  try {
    const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email });
    const profile = profiles?.[0];
    if (profile) {
      if (profile.is_active === false) return { role: null, deactivated: true };
      return { role: profile.custom_role || user.role || "sales_rep", deactivated: false };
    }
  } catch (_) {}
  return { role: user.role || "sales_rep", deactivated: false };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { role, deactivated } = await resolveRole(base44, user);
    if (deactivated) return Response.json({ error: "Account deactivated" }, { status: 403 });
    if (!PAYMENT_WRITE_ALLOWED.has(role)) {
      return Response.json({ error: "Forbidden: your role cannot create or modify payments" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, id, data = {} } = body;

    if (action === "create") {
      if (!data.amount || !data.payment_type) {
        return Response.json({ error: "amount and payment_type are required" }, { status: 400 });
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