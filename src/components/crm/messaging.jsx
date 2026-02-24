/**
 * Communication Execution Layer — Phase 2A
 * 
 * Template engine + send abstraction.
 * Provider adapters (Twilio, SendGrid) slot in here when enabled.
 * Currently uses "mock" provider which logs all sends to Message entity.
 */

import { base44 } from "@/api/base44Client";

// ─── Merge tag resolver ────────────────────────────────────────────────────
/**
 * Resolve merge tags from a lead or event record.
 * Available tags:
 *   {{client_first_name}} {{client_last_name}} {{partner_first_name}}
 *   {{event_date}} {{event_type}} {{venue_name}} {{city}} {{guest_count}}
 *   {{package_name}} {{quote_amount}} {{total_fee}} {{deposit_amount}}
 *   {{assigned_rep}} {{assigned_dj}} {{contact_name}} {{contact_email}}
 *   {{contact_phone}} {{company_name}} {{portal_link}}
 */
export function resolveMergeTags(template, context = {}) {
  const {
    lead = {},
    event = {},
    contact = {},
    extra = {},
  } = context;

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
    quote_amount:       lead.quote_amount ? `$${lead.quote_amount.toLocaleString()}` : "",
    total_fee:          lead.total_fee    ? `$${lead.total_fee.toLocaleString()}`    : (event.package_price ? `$${event.package_price.toLocaleString()}` : ""),
    deposit_amount:     lead.deposit_amount ? `$${lead.deposit_amount.toLocaleString()}` : "",
    assigned_rep:       lead.assigned_rep || "",
    assigned_dj:        event.assigned_dj || "",
    company_name:       extra.company_name || "DJ Command",
    portal_link:        extra.portal_link  || "",
    ...extra,
  };

  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => tags[key] ?? `{{${key}}}`);
}

// ─── Provider adapter (mock) ───────────────────────────────────────────────
async function sendViaMock({ channel, to_email, to_phone, subject, body, metadata }) {
  // Mock: immediately "sent". Replace with real provider calls.
  return {
    provider: "mock",
    provider_message_id: `mock_${Date.now()}`,
    status: "sent",
    sent_at: new Date().toISOString(),
  };
}

// Future adapters:
// async function sendViaTwilio({ to_phone, body }) { ... }
// async function sendViaSendGrid({ to_email, subject, body_html }) { ... }

const PROVIDER_MAP = {
  mock: sendViaMock,
  twilio: sendViaMock,    // swap when credentials added
  sendgrid: sendViaMock,  // swap when credentials added
};

// ─── Core send function ────────────────────────────────────────────────────
/**
 * Send a message and log it to Message entity + Activity feed.
 * 
 * @param {object} opts
 * @param {string} opts.channel          "email"|"sms"
 * @param {string} opts.to_name
 * @param {string} opts.to_email
 * @param {string} opts.to_phone
 * @param {string} opts.subject          (email only)
 * @param {string} opts.body             Plain text body (resolved)
 * @param {string} opts.body_html        (optional HTML for email)
 * @param {string} opts.template_id
 * @param {string} opts.template_name
 * @param {string} opts.related_type     "lead"|"event"|"contact"
 * @param {string} opts.related_id
 * @param {string} opts.related_name
 * @param {string} opts.sent_by          User email
 * @param {string} opts.provider         "mock"|"twilio"|"sendgrid"
 */
export async function sendMessage(opts) {
  const {
    channel = "email",
    to_name = "",
    to_email = "",
    to_phone = "",
    subject = "",
    body = "",
    body_html = "",
    template_id = "",
    template_name = "",
    related_type,
    related_id,
    related_name = "",
    sent_by = "",
    provider = "mock",
  } = opts;

  const adapter = PROVIDER_MAP[provider] || sendViaMock;
  const result = await adapter({ channel, to_email, to_phone, subject, body });

  // Write Message record
  const message = await base44.entities.Message.create({
    direction: "outbound",
    channel,
    status: result.status || "sent",
    to_name,
    to_email,
    to_phone,
    subject,
    body,
    body_html,
    template_id,
    template_name,
    related_type,
    related_id,
    related_name,
    sent_at: result.sent_at || new Date().toISOString(),
    provider: result.provider || provider,
    provider_message_id: result.provider_message_id || "",
    sent_by,
  });

  // Log to Activity feed
  await base44.entities.Activity.create({
    type: channel === "email" ? "email" : "text",
    direction: "outbound",
    subject: subject || `SMS to ${to_name}`,
    description: body.slice(0, 300),
    outcome: channel === "email" ? "email_sent" : "text_sent",
    related_type,
    related_id,
    related_name,
    performed_by: sent_by,
    template_used: template_name,
    is_client_visible: true,
  });

  return message;
}

// ─── Template library ─────────────────────────────────────────────────────
export const DEFAULT_TEMPLATES = [
  {
    name: "New Lead — Initial Outreach",
    category: "new_lead",
    channel: "email",
    subject: "Thanks for reaching out, {{client_first_name}}! 🎵",
    body: `Hi {{client_first_name}},

Thanks so much for reaching out about your {{event_type}} on {{event_date}}!

We'd love to chat and learn more about your vision for the event. 

Would you have 15 minutes this week for a quick call? I can be reached at any time that works best for you.

Looking forward to connecting!

{{assigned_rep}}
{{company_name}}`,
    auto_trigger: "new_inquiry",
    is_active: true,
  },
  {
    name: "New Lead — Initial SMS",
    category: "new_lead",
    channel: "sms",
    body: `Hi {{client_first_name}}! This is {{assigned_rep}} from {{company_name}}. Thanks for reaching out about your {{event_type}} on {{event_date}}! I'd love to connect — when's a good time to chat?`,
    auto_trigger: "new_inquiry",
    is_active: true,
  },
  {
    name: "Quote Follow-Up (24h)",
    category: "quote_followup",
    channel: "email",
    subject: "Following up on your quote, {{client_first_name}}",
    body: `Hi {{client_first_name}},

Just wanted to follow up on the quote I sent over for your {{event_type}} at {{venue_name}} on {{event_date}}.

The package comes in at {{total_fee}}, which includes everything we discussed. 

Do you have any questions, or would you like to hop on a quick call to review?

Best,
{{assigned_rep}}
{{company_name}}`,
    auto_trigger: "quote_sent",
    is_active: true,
  },
  {
    name: "Quote Follow-Up SMS",
    category: "quote_followup",
    channel: "sms",
    body: `Hi {{client_first_name}}! Just following up on the quote I sent for your {{event_type}}. Any questions? Happy to hop on a quick call! — {{assigned_rep}}`,
    auto_trigger: "quote_sent",
    is_active: true,
  },
  {
    name: "Deposit Reminder",
    category: "deposit_reminder",
    channel: "email",
    subject: "Deposit reminder — secure your date, {{client_first_name}}!",
    body: `Hi {{client_first_name}},

Your {{event_type}} date of {{event_date}} is still available! To officially lock it in, we just need a deposit of {{deposit_amount}}.

Once received, you'll have peace of mind knowing your entertainment is confirmed.

Ready to move forward? Just reply to this email and we'll get everything set up.

{{assigned_rep}}
{{company_name}}`,
    auto_trigger: "deposit_requested",
    is_active: true,
  },
  {
    name: "Booking Confirmation",
    category: "booking_confirmation",
    channel: "email",
    subject: "🎉 You're officially booked! — {{client_first_name}}",
    body: `Hi {{client_first_name}},

Congratulations! Your {{event_type}} at {{venue_name}} on {{event_date}} is officially booked!

Here's a quick recap:
• Event: {{event_type}} at {{venue_name}}
• Date: {{event_date}}
• Package: {{package_name}}
• Investment: {{total_fee}}

Next steps: We'll send you our planning form about 8 weeks before your event so we can start crafting the perfect experience for you.

We're so excited to be part of your big day!

{{assigned_rep}}
{{company_name}}`,
    auto_trigger: "booked",
    is_active: true,
  },
  {
    name: "Planning Form Reminder",
    category: "planning_reminder",
    channel: "email",
    subject: "Time to plan your {{event_type}}, {{client_first_name}}! 🎵",
    body: `Hi {{client_first_name}},

Your {{event_type}} at {{venue_name}} is coming up on {{event_date}} — it's time to start planning the music and timeline!

Please click the link below to complete your planning form. This helps us create a personalized experience tailored to your vision.

{{portal_link}}

Please complete the form at your earliest convenience so we have time to prepare everything perfectly.

{{assigned_rep}}
{{company_name}}`,
    auto_trigger: "awaiting_planning_form",
    is_active: true,
  },
  {
    name: "Final Call Invitation",
    category: "final_call",
    channel: "email",
    subject: "Let's schedule your final planning call, {{client_first_name}}!",
    body: `Hi {{client_first_name}},

Your {{event_type}} is just around the corner on {{event_date}}!

We'd love to schedule a final planning call to review every detail together — timeline, music, announcements, and any last-minute changes.

Please reply with a few times that work for you and we'll get it on the calendar.

So excited for {{event_date}}!

{{assigned_rep}}
{{company_name}}`,
    auto_trigger: "final_call_scheduled",
    is_active: true,
  },
  {
    name: "Post-Event Survey",
    category: "post_event_survey",
    channel: "email",
    subject: "How did we do, {{client_first_name}}? 🎉",
    body: `Hi {{client_first_name}},

Thank you so much for letting us be part of your {{event_type}}! We hope it was everything you dreamed of.

We'd love to hear your feedback — it only takes 2 minutes and means the world to our team.

[Survey Link]

Also, if you loved the experience, a quick review on Google or The Knot would help other couples find us. Thank you!

With gratitude,
{{company_name}}`,
    auto_trigger: "event_completed",
    is_active: true,
  },
];

export async function seedDefaultTemplates() {
  const existing = await base44.entities.MessageTemplate.list();
  if (existing.length > 0) return; // Already seeded
  await base44.entities.MessageTemplate.bulkCreate(DEFAULT_TEMPLATES);
}