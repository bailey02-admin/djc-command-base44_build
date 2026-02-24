/**
 * Secure Contact write endpoint.
 * DJs and clients are blocked from writing.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const BLOCKED_ROLES = new Set(["dj", "client"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = user.role || "sales_rep";
    if (BLOCKED_ROLES.has(role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, id, data } = body;

    if (action === "create") {
      const contact = await base44.asServiceRole.entities.Contact.create(data);
      return Response.json({ contact });
    }

    if (action === "update") {
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      const contact = await base44.asServiceRole.entities.Contact.update(id, data);
      return Response.json({ contact });
    }

    if (action === "delete") {
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      // Only admins can delete contacts
      if (role !== "admin") return Response.json({ error: "Forbidden: admin only" }, { status: 403 });
      await base44.asServiceRole.entities.Contact.delete(id);
      return Response.json({ success: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});