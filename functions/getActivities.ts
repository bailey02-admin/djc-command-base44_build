/**
 * Secure Activity feed read endpoint.
 * Strips internal-only activities from DJs and clients.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const ACTIVITY_READ_DENIED = new Set(["client"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = user.role || "sales_rep";
    if (ACTIVITY_READ_DENIED.has(role)) {
      return Response.json({ activities: [] });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const { related_id, limit = 50 } = body;
    if (!related_id) return Response.json({ error: "related_id required" }, { status: 400 });

    let activities = await base44.asServiceRole.entities.Activity.filter(
      { related_id }, "-created_date", limit
    );

    // DJs cannot see internal notes or system audit entries
    if (role === "dj") {
      activities = activities.filter(a => !a.is_internal && a.type !== "system");
    }

    return Response.json({ activities });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});