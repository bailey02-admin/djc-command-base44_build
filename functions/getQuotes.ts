/**
 * Secure Quote read endpoint.
 * DJs and clients are blocked entirely.
 * Sales reps: scoped to leads in their city (via lead_id join).
 * Admins / managers / finance: all quotes.
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
    const { limit = 300, sort = "-created_date", filters = {}, lead_id } = body;

    let quotes = await base44.asServiceRole.entities.Quote.list(sort, limit);

    // lead_id shortcut (forLead use case)
    if (lead_id) {
      quotes = quotes.filter(q => q.lead_id === lead_id);
    }

    // Apply any additional caller filters
    for (const [key, val] of Object.entries(filters)) {
      if (val && val !== "all") quotes = quotes.filter(q => q[key] === val);
    }

    // City-scoped roles: only quotes whose linked lead is in user's city
    if (["sales_rep", "city_manager"].includes(role) && user.city) {
      const leads = await base44.asServiceRole.entities.Lead.list("-created_date", 500);
      const cityLeadIds = new Set(
        leads.filter(l => l.city === user.city).map(l => l.id)
      );
      quotes = quotes.filter(q => !q.lead_id || cityLeadIds.has(q.lead_id));
    }

    return Response.json({ quotes, total: quotes.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});