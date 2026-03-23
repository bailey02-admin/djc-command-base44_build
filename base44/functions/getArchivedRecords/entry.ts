/**
 * Secure archived records read endpoint.
 * Admin-only: returns soft-deleted Leads and Events.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden: admin only" }, { status: 403 });

    const [leads, events] = await Promise.all([
      base44.asServiceRole.entities.Lead.filter({ is_deleted: true }, "-updated_date", 200),
      base44.asServiceRole.entities.Event.filter({ is_deleted: true }, "-updated_date", 200),
    ]);

    return Response.json({ leads, events });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});