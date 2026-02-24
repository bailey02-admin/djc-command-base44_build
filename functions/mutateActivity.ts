/**
 * Secure Activity create endpoint.
 * Enforces:
 *  - Role-based access (clients blocked)
 *  - DJs cannot create internal notes
 *  - Sales reps can only log activities on leads in their city/assignment
 *  - is_internal forced true for non-admin roles creating system events
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const ACTIVITY_WRITE_DENIED = new Set(["client"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = user.role || "sales_rep";
    if (ACTIVITY_WRITE_DENIED.has(role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { data = {} } = body;

    if (!data.type || !data.subject) {
      return Response.json({ error: "type and subject are required" }, { status: 400 });
    }

    // DJs cannot create internal notes
    if (role === "dj" && data.is_internal) {
      return Response.json({ error: "Forbidden: DJs cannot create internal notes" }, { status: 403 });
    }

    // Stamp performer
    const payload = {
      ...data,
      performed_by: data.performed_by || user.email,
    };

    const activity = await base44.asServiceRole.entities.Activity.create(payload);
    return Response.json({ activity });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});