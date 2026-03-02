/**
 * sendMessage — Backend messaging endpoint.
 *
 * Handles:
 *   - Merge tag resolution (server-side)
 *   - Template preview (action: preview, returns resolved body/subject)
 *   - Send (action: send) — writes Message + Activity + optional task completion
 *
 * Provider: mock (logs only). Swap sendViaMock for real adapter when Twilio/SendGrid ready.
 *
 * Merge tags available:
 *   {{client_first_name}} {{client_last_name}} {{partner_first_name}} {{partner_last_name}}
 *   {{contact_name}} {{contact_email}} {{contact_phone}}
 *   {{event_date}} {{event_type}} {{venue_name}} {{city}} {{guest_count}}
 *   {{package_name}} {{total_fee}} {{quote_amount}} {{deposit_amount}}
 *   {{assigned_rep}} {{assigned_dj}} {{company_name}} {{portal_link}}
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const SEND_ALLOWED = new Set(["admin","city_manager","sales_manager","sales_rep","office_finalizer"]);

// ─── Merge tag resolver (server-side) ─────────────────────────────────────
function resolveMergeTags(template, ctx = {}) {
  const { lead = {}, event = {}, contact = {} } = ctx;

  const eventDateFormatted = (() => {
    const d = lead.event_date || event.event_date;
    if (!d) return "TBD";
    try { return new Date(d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }); }
    catch { return d; }
  })();

  const tags = {
    client_first_name:  lead.client_first_name || contact.first_name || event.contact_name?.split(" ")[0] || "",
    client_last_name:   lead.client_last_name  || contact.last_name  || event.contact_name?.split(" ").slice(1).join(" ") || "",
    partner_first_name: lead.partner_first_name || "",
    partner_last_name:  lead.partner_last_name  || "",
    contact_name:       event.contact_name || `${lead.client_first_name || ""} ${lead.client_last_name || ""}`.trim(),
    contact_email:      lead.email || event.contact_email || contact.email || "",
    contact_phone:      lead.phone || event.contact_phone || contact.phone || "",
    event_date:         eventDateFormatted,
    event_type:         (lead.event_type || event.event_type || "").replace(/_/g, " "),
    venue_name:         lead.venue_name || event.venue_name || "your venue",
    city:               lead.city || event.city || "",
    guest_count:        String(lead.guest_count || event.guest_count || ""),
    package_name:       lead.package_name || event.package_name || "",
    quote_amount:       lead.quote_amount    ? `$${Number(lead.quote_amount).toLocaleString()}`    : "",
    total_fee:          lead.total_fee       ? `$${Number(lead.total_fee).toLocaleString()}`       : (event.package_price ? `$${Number(event.package_price).toLocaleString()}` : ""),
    deposit_amount:     lead.deposit_amount  ? `$${Number(lead.deposit_amount).toLocaleString()}`  : "",
    assigned_rep:       lead.assigned_rep || "",
    assigned_dj:        event.assigned_dj || "",
    company_name:       "DJ Command",
    portal_link:        "",
  };

  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => tags[key] ?? `{{${key}}}`);
}

async function sendViaMock({ channel, to_email, to_phone, subject, body }) {
  return {
    provider: "mock",
    provider_message_id: `mock_${Date.now()}`,
    status: "sent",
    sent_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = user.role || "sales_rep";
    if (!SEND_ALLOWED.has(role)) {
      return Response.json({ error: "Forbidden: your role cannot send messages" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { action = "send" } = body;

    // ── Fetch context objects if IDs provided ─────────────────────
    const leadId   = body.lead_id;
    const eventId  = body.event_id;
    const contactId = body.contact_id;

    const [leadRows, eventRows, contactRows] = await Promise.all([
      leadId    ? base44.asServiceRole.entities.Lead.filter({ id: leadId })    : Promise.resolve([]),
      eventId   ? base44.asServiceRole.entities.Event.filter({ id: eventId })  : Promise.resolve([]),
      contactId ? base44.asServiceRole.entities.Contact.filter({ id: contactId }) : Promise.resolve([]),
    ]);

    const lead    = leadRows[0]    || body.lead    || {};
    const event   = eventRows[0]   || body.event   || {};
    const contact = contactRows[0] || body.contact || {};

    // ── PREVIEW — resolve merge tags, return without sending ──────
    if (action === "preview") {
      const { template_body = "", template_subject = "", template_id } = body;

      let rawBody    = template_body;
      let rawSubject = template_subject;

      if (template_id && !rawBody) {
        const tmpl = await base44.asServiceRole.entities.MessageTemplate.filter({ id: template_id });
        if (tmpl[0]) { rawBody = tmpl[0].body || ""; rawSubject = tmpl[0].subject || ""; }
      }

      return Response.json({
        subject: resolveMergeTags(rawSubject, { lead, event, contact }),
        body:    resolveMergeTags(rawBody,    { lead, event, contact }),
      });
    }

    // ── SEND ──────────────────────────────────────────────────────
    const {
      channel = "email",
      subject: rawSubject = "",
      body: rawBody = "",
      template_id = "",
      template_name = "",
      related_type,
      related_id,
      related_name = "",
      provider = "mock",
    } = body;

    if (!rawBody.trim()) {
      return Response.json({ error: "body is required" }, { status: 400 });
    }
    if (!related_id) {
      return Response.json({ error: "related_id is required" }, { status: 400 });
    }

    // Resolve merge tags
    const resolvedSubject = resolveMergeTags(rawSubject, { lead, event, contact });
    const resolvedBody    = resolveMergeTags(rawBody,    { lead, event, contact });

    const toName  = lead.client_first_name
      ? `${lead.client_first_name} ${lead.client_last_name || ""}`.trim()
      : (event.contact_name || contact.first_name || related_name);
    const toEmail = lead.email    || event.contact_email || contact.email || "";
    const toPhone = lead.phone    || event.contact_phone || contact.phone || "";

    // Send via provider
    const result = await sendViaMock({ channel, to_email: toEmail, to_phone: toPhone, subject: resolvedSubject, body: resolvedBody });

    // Write Message record
    const message = await base44.asServiceRole.entities.Message.create({
      direction:          "outbound",
      channel,
      status:             result.status || "sent",
      to_name:            toName,
      to_email:           toEmail,
      to_phone:           toPhone,
      subject:            resolvedSubject,
      body:               resolvedBody,
      template_id,
      template_name,
      related_type,
      related_id,
      related_name,
      sent_at:            result.sent_at || new Date().toISOString(),
      provider:           result.provider || provider,
      provider_message_id: result.provider_message_id || "",
      sent_by:            user.email,
    });

    // Log to Activity feed
    await base44.asServiceRole.entities.Activity.create({
      type:          channel === "email" ? "email" : "text",
      direction:     "outbound",
      subject:       resolvedSubject || `SMS to ${toName}`,
      description:   resolvedBody.slice(0, 300),
      outcome:       channel === "email" ? "email_sent" : "text_sent",
      related_type,
      related_id,
      related_name,
      performed_by:  user.email,
      template_used: template_name,
      is_client_visible: true,
    }).catch(() => {});

    return Response.json({ ok: true, message });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});