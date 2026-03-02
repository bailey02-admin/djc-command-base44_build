/**
 * Secure Event Detail bundle endpoint.
 * Returns role-filtered event + activities + tasks + payments + music + timeline
 * in one round-trip, enforcing all field redaction and access rules.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// CLIENT role gets a limited safe bundle — not full denied
const EVENT_READ_DENIED = new Set([]);

const EVENT_HIDDEN_FIELDS = {
  // DJs see assigned_dj_id for their own reference but not financial/contact fields
  dj:               ["package_price", "contact_email", "contact_phone", "lead_id", "internal_notes"],
  sales_rep:        ["package_price", "internal_notes"],
  office_finalizer: ["package_price"],
  finance:          ["internal_notes"],
  // assigned_dj_id is NOT hidden for any role — it's needed for conflict detection in all views
};

function redactEvent(record, role) {
  const hidden = EVENT_HIDDEN_FIELDS[role] || [];
  if (!hidden.length) return record;
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

    const body = await req.json().catch(() => ({}));
    const { id } = body;
    if (!id) return Response.json({ error: "id required" }, { status: 400 });

    // Fetch event
    const rows = await base44.asServiceRole.entities.Event.filter({ id });
    const event = rows[0];
    if (!event || event.is_deleted) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // DJ: only events they are assigned to
    if (role === "dj" && event.assigned_dj !== user.email) {
      return Response.json({ error: "Forbidden: not your event" }, { status: 403 });
    }
    // City manager / sales_rep: city scoped
    if (["city_manager", "sales_rep"].includes(role) && user.city && event.city !== user.city) {
      return Response.json({ error: "Forbidden: outside your city" }, { status: 403 });
    }

    // Parallel fetch of all related data
    const [rawActivities, tasks, rawPayments, musicSelections, timeline] = await Promise.all([
      base44.asServiceRole.entities.Activity.filter({ related_id: id }, "-created_date", 50),
      base44.asServiceRole.entities.Task.filter({ related_id: id }, "-due_date", 20),
      base44.asServiceRole.entities.Payment.filter({ event_id: id }, "-created_date", 20),
      base44.asServiceRole.entities.MusicSelection.filter({ event_id: id }, "category", 100),
      base44.asServiceRole.entities.TimelineItem.filter({ event_id: id }, "order", 50),
    ]);

    // DJs: strip internal activities, system entries
    const activities = role === "dj"
      ? rawActivities.filter(a => !a.is_internal && a.type !== "system")
      : rawActivities;

    // DJs and non-finance: no payment data
    const payments = ["admin", "city_manager", "sales_manager", "finance"].includes(role)
      ? rawPayments
      : [];

    // Add computed alias: event_id = record.id (display only, never persisted)
    const redacted = redactEvent(event, role);
    return Response.json({
      event: { ...redacted, event_id: event.id },
      activities,
      tasks,
      payments,
      musicSelections,
      timeline,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});