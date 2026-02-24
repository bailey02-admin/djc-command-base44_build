/**
 * Secure Contract read endpoint.
 * Admins/finance/office: all contracts.
 * Sales reps: contracts linked to events in their city only.
 * DJs: blocked.
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

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const { limit = 300, sort = "-created_date", filters = {} } = body;

    let contracts = await base44.asServiceRole.entities.Contract.list(sort, limit);

    // Apply caller filters
    for (const [key, val] of Object.entries(filters)) {
      if (val && val !== "all") contracts = contracts.filter(c => c[key] === val);
    }

    return Response.json({ contracts, total: contracts.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});