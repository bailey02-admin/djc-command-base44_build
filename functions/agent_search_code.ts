import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function authCheck(req) {
  const token = req.headers.get("x-agent-token");
  const expected = Deno.env.get("AGENT_TOKEN");
  return token && token === expected;
}

// Static index of the app's key files and their purposes.
// This gives the external agent a searchable map of the codebase.
const CODE_INDEX = [
  // Pages
  { path: "pages/Dashboard.js", description: "Main dashboard with stats, recent leads, upcoming events, task list" },
  { path: "pages/Events.js", description: "Event management table with column customization, filtering, saved views" },
  { path: "pages/EventDetail.js", description: "Single event detail view with tabs: overview, finances, planning, music, timeline, activities" },
  { path: "pages/EventForm.js", description: "Create/edit event form with status, city, DJ assignment, financial fields" },
  { path: "pages/Leads.js", description: "Lead list with pipeline kanban and table view, filtering, bulk actions" },
  { path: "pages/LeadDetail.js", description: "Single lead detail with CRM activities, stage advancement, quote builder" },
  { path: "pages/LeadForm.js", description: "Create/edit lead form" },
  { path: "pages/Contacts.js", description: "Contact list page" },
  { path: "pages/ContactDetail.js", description: "Single contact detail with linked leads/events" },
  { path: "pages/Tasks.js", description: "Task management page with filtering by assignee, priority, status" },
  { path: "pages/Payments.js", description: "Payment tracking across events" },
  { path: "pages/Contracts.js", description: "Contract management, send/sign tracking" },
  { path: "pages/DJRoster.js", description: "DJ profile management page" },
  { path: "pages/Venues.js", description: "Venue database management" },
  { path: "pages/Reports.js", description: "Business reports and analytics" },
  { path: "pages/Settings.js", description: "App settings with tabs: General, Labels/Statuses, Users, etc." },
  { path: "pages/StatusSettings.js", description: "Admin page for managing EventStatus records and StatusGroups" },
  { path: "pages/FinalizerQueue.js", description: "Queue for office finalizers to process events nearing their date" },
  { path: "pages/MessageTemplates.js", description: "Email/SMS message template management" },
  { path: "pages/ClientPortal.js", description: "Client-facing portal for planning, music, timeline, payments" },
  { path: "pages/DJView.js", description: "DJ-facing view for their assigned events" },
  // Functions
  { path: "functions/getEventDetail.js", description: "Fetch full event bundle: event + contact + payments + tasks + music + activities" },
  { path: "functions/mutateEvent.js", description: "Create/update/delete events with CRM automation triggers" },
  { path: "functions/getLeads.js", description: "Paginated lead list with server-side filtering" },
  { path: "functions/mutateLead.js", description: "Create/update/delete leads, stage transitions, SLA tracking" },
  { path: "functions/getStatusSettings.js", description: "Fetch EventStatus list and StatusGroups, auto-seeds defaults" },
  { path: "functions/saveStatusSettings.js", description: "Admin CRUD for EventStatus and StatusGroup entities" },
  { path: "functions/taskEngine.js", description: "Auto-creates tasks based on event/lead lifecycle triggers" },
  { path: "functions/sendMessage.js", description: "Send email/SMS via templates to contacts" },
  { path: "functions/convertLeadToEvent.js", description: "Convert a booked lead into a full Event record" },
  { path: "functions/snapshotQuoteToEvent.js", description: "Snapshot quote financials onto event when status becomes official_booked" },
  { path: "functions/getReportSummary.js", description: "Aggregate stats for the Reports page" },
  { path: "functions/globalSearch.js", description: "Full-text search across leads, events, contacts" },
  { path: "functions/agent_status.js", description: "Agent integration: returns current system state and next recommended step" },
  { path: "functions/agent_run_step.js", description: "Agent integration: executes a named step idempotently (create_event, create_lead, create_task, update_event_status)" },
  { path: "functions/agent_read_file.js", description: "Agent integration: reads entity schemas by name" },
  { path: "functions/agent_search_code.js", description: "Agent integration: searches this code index by keyword" },
  // Components
  { path: "components/settings/LabelsTab.js", description: "Settings tab for managing LabelMap entries and EventStatus groups" },
  { path: "components/hooks/useStatusSettings.js", description: "React hook: fetches status settings, provides label/color/group helpers" },
  { path: "components/events/ColumnCustomizer.js", description: "Drag-and-drop column visibility/order editor for Events table" },
  { path: "components/crm/automations.js", description: "CRM automation triggers: post-booking tasks, reminders, notifications" },
  { path: "components/api/secureApi.js", description: "Frontend API client proxying entity ops through backend functions" },
  { path: "components/quotes/QuoteBuilderModal.js", description: "Modal for building and sending quotes to leads" },
  { path: "components/layout/RouteGuard.js", description: "Role-based access control wrapper for pages" },
  // Entities
  { path: "entities/Event.json", description: "Event entity schema: event_name, event_type, event_date, status, city, DJ assignment, planning flags, financials" },
  { path: "entities/Lead.json", description: "Lead entity schema: contact info, pipeline_stage, lead_status, SLA fields, UTM tracking" },
  { path: "entities/EventStatus.json", description: "EventStatus entity: key, label, color, sort_order, is_active" },
  { path: "entities/StatusGroup.json", description: "StatusGroup entity: entity_key, key, label, statuses[], required flag" },
  { path: "entities/Task.json", description: "Task entity: title, assigned_to, due_date, priority, status, related_type/id, idempotency_key" },
  { path: "entities/Contact.json", description: "Contact entity: name, email, phone, role, preferred_contact_method" },
  { path: "entities/Payment.json", description: "Payment entity: event_id, amount, payment_type, status, due_date, paid_date" },
  { path: "entities/Quote.json", description: "Quote entity: lead_id, package_name, add_ons, total_amount, status, version" },
  { path: "entities/Venue.json", description: "Venue entity: name, city, capacity, load-in instructions, sound restrictions" },
  { path: "entities/DJProfile.json", description: "DJ profile: name, city, contact info, availability" },
  { path: "entities/Activity.json", description: "CRM activity log: type (call/email/note), direction, related_type/id, outcome" },
];

Deno.serve(async (req) => {
  if (!authCheck(req)) {
    return Response.json({ ok: false, errors: ["Unauthorized: invalid or missing x-agent-token"] }, { status: 401 });
  }

  try {
    const { query } = await req.json();

    if (!query) {
      return Response.json({ ok: false, errors: ["query is required"] }, { status: 400 });
    }

    const q = query.toLowerCase();
    const results = CODE_INDEX
      .filter(item =>
        item.path.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      )
      .map(item => ({
        path: item.path,
        snippet: item.description,
      }));

    return Response.json({
      ok: true,
      query,
      results,
      total: results.length,
    });
  } catch (error) {
    return Response.json({ ok: false, errors: [error.message] }, { status: 500 });
  }
});