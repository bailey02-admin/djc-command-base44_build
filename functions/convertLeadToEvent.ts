/**
 * Canonical lead-to-event conversion function.
 * Single server-side path for all conversion flows.
 *
 * Flow:
 *  1. Validate lead access + scoping
 *  2. Match or create Contact (email first, phone second)
 *  3. Create Event with contact_id
 *  4. Update Lead (status, pipeline_stage, event_id, contact_id, booked_date)
 *  5. Write Activity + AutomationLog
 *  6. Trigger postEventAutomation onEventBooked tasks
 *  7. Preserve duplicate_of linkage
 *
 * Idempotent: if lead.event_id already exists, returns existing event.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const CONVERT_ALLOWED = new Set(["admin", "city_manager", "sales_manager", "sales_rep"]);

// Resolve StaffProfile custom_role — same pattern as mutateEvent
async function resolveRole(base44, user) {
  try {
    const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email });
    const profile = profiles?.[0];
    if (profile) {
      if (profile.is_active === false) return { role: null, deactivated: true, profile };
      return { role: profile.custom_role || user.role || "sales_rep", deactivated: false, profile };
    }
  } catch (_) { /* fall through */ }
  return { role: user.role || "sales_rep", deactivated: false, profile: null };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { role, deactivated, profile } = await resolveRole(base44, user);
    if (deactivated) return Response.json({ error: "Account deactivated" }, { status: 403 });
    if (!CONVERT_ALLOWED.has(role)) return Response.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { lead_id } = body;
    if (!lead_id) return Response.json({ error: "lead_id required" }, { status: 400 });

    // ── 1. Fetch + validate lead ──────────────────────────────────
    const leadRows = await base44.asServiceRole.entities.Lead.filter({ id: lead_id });
    const lead = leadRows[0];
    if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
    if (lead.is_deleted) return Response.json({ error: "Lead is deleted" }, { status: 410 });

    // City scoping for city_manager — use StaffProfile.cities array (canonical)
    if (role === "city_manager") {
      const allowedCities = profile?.cities?.length > 0
        ? profile.cities
        : (profile?.default_city ? [profile.default_city] : null);
      if (allowedCities && lead.city && !allowedCities.includes(lead.city)) {
        return Response.json({ error: "Forbidden: lead is outside your city scope" }, { status: 403 });
      }
    }

    // ── Idempotency: already converted ───────────────────────────
    if (lead.event_id) {
      const eventRows = await base44.asServiceRole.entities.Event.filter({ id: lead.event_id });
      const existingEvent = eventRows[0];
      if (existingEvent) {
        return Response.json({ event: existingEvent, contact_id: lead.contact_id, skipped: true, reason: "Already converted" });
      }
      // event_id set but event was deleted — fall through and create fresh
    }

    // ── 2. Match or create Contact ────────────────────────────────
    let contact_id = lead.contact_id || null;
    let contactMatchType = "existing_id";

    if (!contact_id) {
      // Search by email first (case-insensitive)
      let matched = null;
      if (lead.email) {
        const byEmail = await base44.asServiceRole.entities.Contact.filter({ email: lead.email });
        matched = byEmail[0] || null;
        if (matched) contactMatchType = "email_match";
      }
      // Phone fallback — normalized digit comparison with paginated scan
      if (!matched && lead.phone) {
        const norm = (p) => (p || "").replace(/\D/g, "");
        const leadPhone = norm(lead.phone);
        if (leadPhone.length >= 7) {
          // Paginate in batches of 500 to avoid 1000-row hard cap
          const BATCH = 500;
          let offset = 0;
          let found = null;
          let scanCount = 0;
          while (!found) {
            const batch = await base44.asServiceRole.entities.Contact.list("-created_date", BATCH, offset);
            scanCount += batch.length;
            found = batch.find(c =>
              norm(c.phone) === leadPhone || norm(c.secondary_phone) === leadPhone
            ) || null;
            if (found || batch.length < BATCH) break; // exhausted
            offset += BATCH;
          }
          if (found) {
            matched = found;
            contactMatchType = "phone_match";
          } else {
            // Log that we completed a full scan and found nothing — explicit audit trail
            await base44.asServiceRole.entities.Activity.create({
              type: "system",
              subject: `convertLeadToEvent: phone scan exhausted (${scanCount} contacts checked) — no match for ${leadPhone.slice(-4).padStart(leadPhone.length, "*")}`,
              related_type: "lead",
              related_id: lead.id,
              is_internal: true,
              performed_by: user.email,
            }).catch(() => {});
          }
        }
      }

      if (matched) {
        contact_id = matched.id;
      } else {
        // Create new contact from lead data
        const newContact = await base44.asServiceRole.entities.Contact.create({
          first_name: lead.client_first_name,
          last_name: lead.client_last_name || "",
          email: lead.email || "",
          phone: lead.phone || "",
          preferred_contact_method: lead.preferred_contact_method || "any",
          city: lead.city || "",
          notes: lead.notes || "",
        });
        contact_id = newContact?.id || null;
        contactMatchType = "created";
      }
    }

    // ── 3. Snapshot Quote financials ──────────────────────────────
    // PHASE D: snapshot quote data onto event fields
    let quoteSnapshot = {
      add_ons: [],
      discount_amount: 0,
      discount_reason: "",
      tax_amount: 0,
      total_fee: 0,
    };
    try {
      // Load quote via forLead
      const quoteRes = await base44.asServiceRole.functions.invoke("getQuotes", { lead_id: lead.id });
      const quotes = quoteRes.quotes || [];
      if (quotes.length > 0) {
        const quote = quotes[0];
        quoteSnapshot = {
          add_ons: quote.add_ons || [],
          discount_amount: quote.discount_amount || 0,
          discount_reason: quote.discount_reason || "",
          tax_amount: quote.tax_amount || 0,
          total_fee: quote.total_amount || 0,
        };
      }
    } catch (e) {
      // Quote fetch failed — log but don't block conversion
      console.warn(`[convertLeadToEvent] quote snapshot failed for lead ${lead.id}:`, e.message);
    }

    // ── 3. Create Event ───────────────────────────────────────────
    const bookedDate = lead.booked_date
      ? (typeof lead.booked_date === "string" ? lead.booked_date.split("T")[0] : lead.booked_date)
      : new Date().toISOString().split("T")[0];

    const eventName = [
      lead.client_first_name,
      lead.client_last_name,
      lead.partner_first_name ? `& ${lead.partner_first_name}` : null,
      "-",
      (lead.event_type || "event").replace(/_/g, " "),
    ].filter(Boolean).join(" ");

    const event = await base44.asServiceRole.entities.Event.create({
      event_name: eventName,
      event_type: lead.event_type,
      event_date: lead.event_date,
      city: lead.city,
      venue_name: lead.venue_name,
      contact_id,
      contact_name: `${lead.client_first_name} ${lead.client_last_name || ""}`.trim(),
      contact_email: lead.email,
      contact_phone: lead.phone,
      lead_id: lead.id,
      guest_count: lead.guest_count,
      package_name: lead.package_name,
      package_price: lead.total_fee || lead.quote_amount,
      status: "booked",
      booked_date: bookedDate,
      // PHASE D: snapshot quote financials
      add_ons: quoteSnapshot.add_ons,
      discount_amount: quoteSnapshot.discount_amount,
      discount_reason: quoteSnapshot.discount_reason,
      tax_amount: quoteSnapshot.tax_amount,
      total_fee: quoteSnapshot.total_fee,
    });

    // ── 4. Update Lead ────────────────────────────────────────────
    const leadUpdate = {
      status: "booked",
      pipeline_stage: "booked",
      event_id: event.id,
      contact_id,
      booked_date: lead.booked_date || new Date().toISOString(),
    };
    // Preserve duplicate_of if already set
    if (lead.duplicate_of) leadUpdate.duplicate_of = lead.duplicate_of;

    await base44.asServiceRole.entities.Lead.update(lead.id, leadUpdate);

    // ── 5. Activity + AutomationLog ───────────────────────────────
    await base44.asServiceRole.entities.Activity.create({
      type: "status_change",
      subject: `Lead converted to Event — ${event.event_name}`,
      description: `Contact: ${contactMatchType} | Event ID: ${event.id}`,
      related_type: "lead",
      related_id: lead.id,
      related_name: `${lead.client_first_name} ${lead.client_last_name || ""}`.trim(),
      is_internal: true,
      performed_by: user.email,
    }).catch(() => {});

    await base44.asServiceRole.entities.AutomationLog.create({
      trigger: "lead_converted",
      related_type: "lead",
      related_id: lead.id,
      related_name: `${lead.client_first_name} ${lead.client_last_name || ""}`.trim(),
      notes: `Event: ${event.id} | Contact: ${contact_id} (${contactMatchType})`,
    }).catch(() => {});

    // ── 6. Trigger booked automation tasks ───────────────────────
    // Fire-and-forget: create standard post-booking tasks
    const BOOKED_TASKS = [
      { title: "Send booking confirmation to client", category: "email", priority: "high", due_days: 0 },
      { title: "Collect deposit", category: "payment", priority: "high", due_days: 1 },
      { title: "Send contract for signature", category: "contract", priority: "high", due_days: 2 },
    ];
    const taskDate = (days) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d.toISOString().split("T")[0];
    };
    await Promise.all(BOOKED_TASKS.map(t =>
      base44.asServiceRole.entities.Task.create({
        title: t.title,
        category: t.category,
        priority: t.priority,
        due_date: taskDate(t.due_days),
        related_type: "event",
        related_id: event.id,
        related_name: event.event_name,
        status: "pending",
      })
    )).catch(() => {});

    return Response.json({
      ok: true,
      event,
      contact_id,
      contact_match_type: contactMatchType,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});