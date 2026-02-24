/**
 * Secure Contact read endpoint.
 * DJs and clients are blocked.
 * All other staff roles can read contacts.
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
    const { limit = 200, sort = "-created_date", filters = {}, id } = body;

    // Single record lookup
    if (id) {
      const results = await base44.asServiceRole.entities.Contact.filter({ id }, "-created_date", 1);
      return Response.json({ contact: results[0] || null });
    }

    let contacts = await base44.asServiceRole.entities.Contact.list(sort, limit);

    // Apply filters
    for (const [key, val] of Object.entries(filters)) {
      if (val && val !== "all") contacts = contacts.filter(c => c[key] === val);
    }

    return Response.json({ contacts, total: contacts.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});