/**
 * Admin-only: Seed demo leads and events using ONLY canonical enums.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const today = new Date();
const dateOffset = (days) => {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

const DEMO_LEADS = [
  {
    client_first_name: "Sarah", client_last_name: "Mitchell",
    email: "sarah.mitchell@example.com", phone: "918-555-0101",
    event_type: "wedding", event_date: dateOffset(90), city: "TUL",
    lead_status: "hot_lead", status: "qualified", pipeline_stage: "consultation_scheduled",
    lead_source: "website", priority: "high", do_not_call: false,
    guest_count: 180, venue_name: "The Mayo Hotel",
    inquiry_date: new Date(today - 5 * 86400000).toISOString(),
  },
  {
    client_first_name: "James", client_last_name: "Harrington",
    email: "jharrington@example.com", phone: "214-555-0202",
    event_type: "corporate", event_date: dateOffset(45), city: "DFW",
    lead_status: "appointment_set", status: "consultation_scheduled", pipeline_stage: "consultation_scheduled",
    lead_source: "referral", priority: "high", do_not_call: false,
    guest_count: 250, venue_name: "Omni Dallas",
    inquiry_date: new Date(today - 3 * 86400000).toISOString(),
  },
  {
    client_first_name: "Maria", client_last_name: "Garza",
    email: "maria.garza@example.com", phone: "210-555-0303",
    event_type: "quinceañera", event_date: dateOffset(60), city: "SAT",
    lead_status: "web_lead", status: "new", pipeline_stage: "new_inquiry",
    lead_source: "google_ads", priority: "medium", do_not_call: false,
    guest_count: 120,
    inquiry_date: new Date(today - 1 * 86400000).toISOString(),
  },
  {
    client_first_name: "Derek", client_last_name: "Okonkwo",
    email: "derek.o@example.com", phone: "816-555-0404",
    event_type: "wedding", event_date: dateOffset(120), city: "KC",
    lead_status: "x_dated", status: "follow_up", pipeline_stage: "follow_up",
    lead_source: "the_knot", priority: "medium", do_not_call: false,
    x_date_followup_at: dateOffset(14),
    guest_count: 200, venue_name: "Longview Mansion",
    inquiry_date: new Date(today - 30 * 86400000).toISOString(),
  },
  {
    client_first_name: "Brittany", client_last_name: "Cole",
    email: "bcole@example.com", phone: "314-555-0505",
    event_type: "birthday", event_date: dateOffset(30), city: "STL",
    lead_status: "missed_appointment", status: "attempted_contact", pipeline_stage: "attempted_contact",
    lead_source: "phone_call", priority: "low", do_not_call: true,
    guest_count: 80,
    inquiry_date: new Date(today - 10 * 86400000).toISOString(),
  },
  {
    client_first_name: "Connor", client_last_name: "Walsh",
    email: "cwalsh@example.com", phone: "317-555-0606",
    event_type: "school_dance", event_date: dateOffset(75), city: "INDY",
    lead_status: "corporate_lead", status: "quote_sent", pipeline_stage: "quote_sent",
    lead_source: "referral", priority: "medium", do_not_call: false,
    guest_count: 350, quote_amount: 2800,
    inquiry_date: new Date(today - 7 * 86400000).toISOString(),
  },
  {
    client_first_name: "Priya", client_last_name: "Nair",
    email: "priya.nair@example.com", phone: "615-555-0707",
    event_type: "wedding", event_date: dateOffset(150), city: "NASH",
    lead_status: "bridal_show_lead", status: "contacted", pipeline_stage: "contacted",
    lead_source: "bridal_show", priority: "medium", do_not_call: false,
    guest_count: 220, venue_name: "Noelle Nashville",
    inquiry_date: new Date(today - 4 * 86400000).toISOString(),
  },
  {
    client_first_name: "Tyler", client_last_name: "Marsh",
    email: "tmarsh@example.com", phone: "303-555-0808",
    event_type: "anniversary", event_date: dateOffset(55), city: "DEN",
    lead_status: "never_booked", status: "lost", pipeline_stage: "lost",
    lead_source: "weddingwire", priority: "low", do_not_call: true,
    lost_reason: "price", guest_count: 60,
    inquiry_date: new Date(today - 45 * 86400000).toISOString(),
  },
  {
    client_first_name: "Angela", client_last_name: "Freeman",
    email: "afreeman@example.com", phone: "404-555-0909",
    event_type: "wedding", event_date: dateOffset(200), city: "ATL",
    lead_status: "x_dated", status: "follow_up", pipeline_stage: "follow_up",
    lead_source: "meta_ads", priority: "high", do_not_call: false,
    x_date_followup_at: dateOffset(21),
    guest_count: 175, venue_name: "The Georgian Terrace",
    inquiry_date: new Date(today - 20 * 86400000).toISOString(),
  },
  {
    client_first_name: "Marcus", client_last_name: "Tillman",
    email: "mtillman@example.com", phone: "713-555-1010",
    event_type: "corporate", event_date: dateOffset(40), city: "HOU",
    lead_status: "booked_pending", status: "booked", pipeline_stage: "booked",
    lead_source: "vendor_referral", priority: "high", do_not_call: false,
    guest_count: 300, venue_name: "The Houstonian",
    inquiry_date: new Date(today - 15 * 86400000).toISOString(),
    booked_date: new Date(today - 2 * 86400000).toISOString(),
  },
];

const DEMO_EVENTS = [
  {
    event_name: "Mitchell - Weber Wedding",
    event_type: "wedding", event_date: dateOffset(90),
    city: "TUL", status: "booked_pending",
    venue_name: "The Mayo Hotel", guest_count: 180,
    contact_name: "Sarah Mitchell", contact_email: "sarah.mitchell@example.com",
    start_time: "5:00 PM", end_time: "11:00 PM",
    package_name: "Premier Package", package_price: 3200,
    readiness_score: 15,
  },
  {
    event_name: "Harrington Corp Gala",
    event_type: "corporate", event_date: dateOffset(45),
    city: "DFW", status: "booked",
    venue_name: "Omni Dallas", guest_count: 250,
    contact_name: "James Harrington", contact_email: "jharrington@example.com",
    start_time: "6:00 PM", end_time: "10:00 PM",
    package_name: "Corporate Elite", package_price: 4500,
    planning_complete: true, contract_signed: true, deposit_paid: true,
    readiness_score: 45,
  },
  {
    event_name: "Okonkwo - Lewis Wedding",
    event_type: "wedding", event_date: dateOffset(120),
    city: "KC", status: "booked",
    venue_name: "Longview Mansion", guest_count: 200,
    contact_name: "Derek Okonkwo", contact_email: "derek.o@example.com",
    start_time: "4:30 PM", end_time: "11:30 PM",
    package_name: "Premier Package", package_price: 3500,
    contract_signed: true, deposit_paid: true,
    readiness_score: 30,
  },
  {
    event_name: "Walsh INDY Prom 2026",
    event_type: "school_dance", event_date: dateOffset(75),
    city: "INDY", status: "planning_in_progress",
    guest_count: 350,
    contact_name: "Connor Walsh", contact_email: "cwalsh@example.com",
    start_time: "7:00 PM", end_time: "11:00 PM",
    package_name: "Standard Package", package_price: 2800,
    planning_complete: true, contract_signed: true, deposit_paid: true,
    music_complete: false, readiness_score: 50,
  },
  {
    event_name: "Nair - Patel Wedding",
    event_type: "wedding", event_date: dateOffset(150),
    city: "NASH", status: "planning_in_progress",
    venue_name: "Noelle Nashville", guest_count: 220,
    contact_name: "Priya Nair", contact_email: "priya.nair@example.com",
    start_time: "5:30 PM", end_time: "11:30 PM",
    package_name: "Grand Package", package_price: 4200,
    contract_signed: true, deposit_paid: true, planning_complete: true,
    readiness_score: 55,
  },
  {
    event_name: "Tillman Energy Summit",
    event_type: "corporate", event_date: dateOffset(40),
    city: "HOU", status: "finalized",
    venue_name: "The Houstonian", guest_count: 300,
    contact_name: "Marcus Tillman", contact_email: "mtillman@example.com",
    start_time: "6:00 PM", end_time: "10:30 PM",
    package_name: "Corporate Elite", package_price: 5000,
    planning_complete: true, timeline_complete: true, music_complete: true,
    contract_signed: true, deposit_paid: true, final_call_completed: true, dj_briefed: true,
    readiness_score: 95,
  },
  {
    event_name: "Freeman - Davis Wedding",
    event_type: "wedding", event_date: dateOffset(-30),
    city: "ATL", status: "completed",
    venue_name: "The Georgian Terrace", guest_count: 175,
    contact_name: "Angela Freeman", contact_email: "afreeman@example.com",
    start_time: "5:00 PM", end_time: "11:00 PM",
    package_name: "Grand Package", package_price: 3800,
    planning_complete: true, timeline_complete: true, music_complete: true,
    contract_signed: true, deposit_paid: true, balance_paid: true,
    final_call_completed: true, dj_briefed: true,
    readiness_score: 100,
    survey_score: 98, survey_avg: 98, survey_flag: null,
  },
  {
    event_name: "Rodriguez Quinceañera",
    event_type: "quinceañera", event_date: dateOffset(-60),
    city: "SAT", status: "completed",
    guest_count: 150,
    contact_name: "Elena Rodriguez", contact_email: "erodriguez@example.com",
    start_time: "6:00 PM", end_time: "11:00 PM",
    package_name: "Premier Package", package_price: 3000,
    planning_complete: true, timeline_complete: true, music_complete: true,
    contract_signed: true, deposit_paid: true, balance_paid: true,
    final_call_completed: true, dj_briefed: true,
    readiness_score: 100,
    survey_score: 72, survey_avg: 72, survey_flag: "low_score",
  },
  {
    event_name: "Cunningham STL Gala",
    event_type: "corporate", event_date: dateOffset(85),
    city: "STL", status: "booked",
    venue_name: "Ballpark Village", guest_count: 400,
    contact_name: "Donna Cunningham", contact_email: "dcunningham@example.com",
    start_time: "7:00 PM", end_time: "11:00 PM",
    package_name: "Corporate Elite", package_price: 5500,
    contract_signed: true, deposit_paid: true,
    readiness_score: 35,
  },
  {
    event_name: "Park - Kim Wedding",
    event_type: "wedding", event_date: dateOffset(180),
    city: "DEN", status: "cancelled",
    guest_count: 140,
    contact_name: "Jin Park", contact_email: "jpark@example.com",
    start_time: "4:00 PM", end_time: "10:00 PM",
    package_name: "Standard Package", package_price: 2600,
    readiness_score: 0,
    internal_notes: "Client cancelled — venue fell through.",
  },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden: admin only" }, { status: 403 });

    const svc = base44.asServiceRole;

    const createdLeads = await Promise.all(
      DEMO_LEADS.map(l => svc.entities.Lead.create({ ...l, is_deleted: false }))
    );

    const createdEvents = await Promise.all(
      DEMO_EVENTS.map(e => svc.entities.Event.create({ ...e, is_deleted: false }))
    );

    return Response.json({
      ok: true,
      leadsCreated: createdLeads.length,
      eventsCreated: createdEvents.length,
      cities: [...new Set(createdEvents.map(e => e.city))],
      eventStatuses: [...new Set(createdEvents.map(e => e.status))],
      leadStatuses: [...new Set(createdLeads.map(l => l.lead_status))],
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});