/**
 * Secure Event read endpoint.
 * DJs: only events where assigned_dj === user.email, with field redaction.
 * Clients: blocked entirely (portal uses separate endpoint).
 * Sales reps: city-scoped.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const EVENT_READ_DENIED = new Set(["client"]);

// Fields stripped for DJs — no financial or internal data
const EVENT_HIDDEN_FIELDS = {
  dj:               ["package_price", "contact_email", "contact_phone", "lead_id", "internal_notes"],
  sales_rep:        ["package_price", "internal_notes"],
  office_finalizer: ["package_price"],
  finance:          ["internal_notes"],
};

function redactFields(record, role) {
  const hidden = EVENT_HIDDEN_FIELDS[role] || [];
  if (hidden.length === 0) return record;
  const out = { ...record };
  for (const f of hidden) delete out[f];
  return out;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = user.role || "sales_rep";
    if (EVENT_READ_DENIED.has(role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const { limit = 100, sort = "-event_date", filters = {} } = body;

    let events = await base44.asServiceRole.entities.Event.list(sort, limit);
    events = events.filter(e => !e.is_deleted);

    // Apply caller filters (status, city, etc.)
    for (const [key, val] of Object.entries(filters)) {
      if (val && val !== "all") events = events.filter(e => e[key] === val);
    }

    // DJ: only events they are assigned to
    if (role === "dj") {
      events = events.filter(e => e.assigned_dj === user.email);
    }
    // Sales rep: city-scoped
    else if (role === "sales_rep" && user.city) {
      events = events.filter(e => e.city === user.city);
    }
    // City manager: city-scoped
    else if (role === "city_manager" && user.city) {
      events = events.filter(e => e.city === user.city);
    }

    const result = events.map(e => redactFields(e, role));
    return Response.json({ events: result, total: result.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});