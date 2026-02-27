/**
 * Admin-only: Seed 250 demo leads + 250 demo events with ~150 bidirectional linked pairs.
 * All seeded rows are tagged with source_detail="DEMO_SEED_v1" (leads) or
 * internal_notes containing "[DEMO_SEED_v1]" (events).
 * Uses chunked batching (50/chunk) to avoid rate-limit issues.
 * Returns full verification object after seeding.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const SEED_TAG = "DEMO_SEED_v1";

const today = new Date();
const d = (days) => {
  const dt = new Date(today);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().split("T")[0];
};
const dt = (daysAgo) => new Date(today - daysAgo * 864e5).toISOString();

// ── Helpers ──────────────────────────────────────────────────────────────────
async function chunkCreate(svc, entityName, records, chunkSize = 50) {
  const results = [];
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const created = await Promise.all(chunk.map(r => svc.entities[entityName].create(r)));
    results.push(...created);
  }
  return results;
}

// ── Canonical pools ───────────────────────────────────────────────────────────
const CITIES = ["TUL","DFW","HOU","SAT","KC","STL","INDY","NASH","DEN","ATL"];
const EVENT_TYPES = ["wedding","corporate","school_dance","private_party","birthday","anniversary","mitzvah","quinceañera","holiday_party","other"];
const LEAD_STATUSES = ["web_lead","email_only","bridal_show_lead","corporate_lead","hot_lead","appointment_set","missed_appointment","x_dated","never_booked","lost_sale","booked_pending"];
const PIPELINE_STAGES = ["new_inquiry","attempted_contact","contacted","qualified","consultation_scheduled","consultation_completed","quote_sent","follow_up","deposit_requested","booked","lost","ghosted"];
const LEAD_SOURCES = ["website","google_ads","meta_ads","referral","bridal_show","the_knot","weddingwire","yelp","phone_call","walk_in","vendor_referral","repeat_client"];
const PRIORITIES = ["low","medium","high","urgent"];
const EVENT_STATUSES = ["booked_pending","booked","planning_in_progress","finalized","completed","cancelled","postponed"];
const PACKAGES = ["Standard Package","Premier Package","Grand Package","Corporate Elite","Essentials Package"];
const VENUES_BY_CITY = {
  TUL:  ["The Mayo Hotel","Philbrook Museum","McNellie's","Ambassador Hotel","Cain's Ballroom"],
  DFW:  ["Omni Dallas","The Adolphus","Nasher Museum","Rosewood Mansion","Frontiers of Flight"],
  HOU:  ["The Houstonian","Four Seasons HOU","Post Oak Hotel","Crystal Ballroom","Hotel ZaZa"],
  SAT:  ["Pearl Stable","La Cantera","Eilan Hotel","The St. Anthony","Hotel Valencia"],
  KC:   ["Longview Mansion","The Elms","Hotel Muehlebach","Union Station KC","The Terrace"],
  STL:  ["Ballpark Village","Four Seasons STL","Old Post Office","The Palladium","Angad Arts Hotel"],
  INDY: ["JW Marriott INDY","The Ritz INDY","Palais Royale","Union Station INDY","Conrad Indianapolis"],
  NASH: ["Noelle Nashville","The Hermitage Hotel","Loews Nashville","Nashville Palace","The Westin"],
  DEN:  ["The Oxford Hotel","Brown Palace","Magnolia Denver","The Ritz Denver","Space Gallery"],
  ATL:  ["The Georgian Terrace","St. Regis Atlanta","Four Seasons ATL","The Ritz ATL","Hotel Clermont"],
};

const FIRST_NAMES = ["Sarah","Laura","Kevin","Donna","Randy","James","Nicole","Andre","Crystal","Marcus","Patricia","Derrick","Sandra","Victor","Tara","Maria","Carlos","Elena","Roberto","Leticia","Derek","Alicia","Thomas","Monica","Gerald","Brittany","Douglas","Melissa","Brian","Karen","Connor","Shannon","Nathan","Joanna","Philip","Priya","Jacob","Heather","Louis","Deborah","Tyler","Jin","Ashley","Cody","Renee","Angela","Raymond","Vanessa","Gregory","Cheryl","Michael","Jennifer","David","Lisa","Robert","Mary","William","Barbara","Richard","Susan","Joseph","Jessica","Charles","Sarah","Daniel","Karen","Matthew","Nancy","Anthony","Betty","Paul","Margaret","Mark","Sandra","Donald","Ashley","George","Dorothy","Kenneth","Kimberly","Steven","Emily","Edward","Donna","Brian","Carol","Ronald","Michelle","Anthony","Amanda","Kevin","Melissa","Jason","Deborah","Jeff","Stephanie","Gary","Rebecca","Timothy","Laura","Jose","Helen","Larry","Sharon","Jeffrey","Cynthia","Frank","Kathleen","Scott","Amy","Eric","Angela","Stephen","Shirley","Raymond","Emma","Gregory","Carol","Joshua","Martha","Jerry","Frances","Ryan","Alice","Dennis","Joan","Harold","Heather","Walter","Diane","Patrick","Julie","Peter","Joyce","Jonathan","Evelyn","Willie","Frances","Katherine","Christine","Jack","Ann","Albert","Alice","Joe","Jean","Jonathan","Kathryn","Justin","Pamela","Terry","Lori","Gerald","Betty","Keith","Jacqueline","Samuel","Ruby","Benjamin","Catherine","Lawrence","Virginia","Roger","Judith","Phillip","Phyllis","Edward","Mildred","Carl","Cheryl","Arthur","Karen","Sean"];
const LAST_NAMES  = ["Mitchell","Simmons","Roper","Reese","Holt","Harrington","Burns","Washington","Ford","Tillman","Owens","Holmes","Pierce","Santos","Blackwell","Garza","Mendez","Rodriguez","Cruz","Flores","Okonkwo","Chambers","Grant","Webb","Pope","Cole","Harper","Knight","Stone","Curtis","Walsh","Lyons","Barker","Perkins","Murray","Nair","Caldwell","Walsh","Ingram","Tran","Marsh","Park","Quinn","Jensen","Horton","Freeman","Brooks","Snow","Vega","Manning","Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Wilson","Martinez","Anderson","Taylor","Thomas","Hernandez","Moore","Jackson","Martin","Lee","Thompson","White","Lopez","Harris","Sanchez","Clark","Lewis","Robinson","Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores","Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts"];
const PARTNER_NAMES = ["James","Michael","Robert","David","John","William","Richard","Joseph","Thomas","Charles","Christopher","Daniel","Matthew","Anthony","Mark","Donald","Steven","Paul","Andrew","Joshua","Kenneth","Kevin","Brian","George","Edward","Ronald","Timothy","Jason","Jeffrey","Ryan","Gary","Eric","Stephen","Raymond","Gregory","Frank","Scott","Patrick","Jonathan","Harold","Walter","Peter","Justin","Terry","Gerald","Keith","Samuel","Benjamin","Lawrence","Roger"];

// ── Generate 250 leads ────────────────────────────────────────────────────────
function buildLeads() {
  const leads = [];
  for (let i = 0; i < 250; i++) {
    const idx = i + 1;
    const cityIdx = i % 10;
    const city = CITIES[cityIdx];
    const eventType = EVENT_TYPES[i % EVENT_TYPES.length];
    const leadStatus = LEAD_STATUSES[i % LEAD_STATUSES.length];
    const source = LEAD_SOURCES[i % LEAD_SOURCES.length];
    const priority = PRIORITIES[i % PRIORITIES.length];

    // Derive pipeline_stage + status from lead_status
    let pipeline_stage = "new_inquiry";
    let status = "new";
    if (leadStatus === "hot_lead") { pipeline_stage = "consultation_completed"; status = "qualified"; }
    else if (leadStatus === "appointment_set") { pipeline_stage = "consultation_scheduled"; status = "consultation_scheduled"; }
    else if (leadStatus === "booked_pending") { pipeline_stage = "booked"; status = "booked"; }
    else if (leadStatus === "x_dated") { pipeline_stage = "follow_up"; status = "follow_up"; }
    else if (leadStatus === "lost_sale" || leadStatus === "never_booked") { pipeline_stage = "lost"; status = "lost"; }
    else if (leadStatus === "missed_appointment") { pipeline_stage = "attempted_contact"; status = "attempted_contact"; }
    else if (leadStatus === "corporate_lead" || leadStatus === "bridal_show_lead") { pipeline_stage = "contacted"; status = "contacted"; }
    else if (leadStatus === "email_only") { pipeline_stage = "new_inquiry"; status = "new"; }

    const inquiryDaysAgo = 1 + (i % 120);
    const eventDays = -180 + (i * 3) % 540; // spread from -180 to +360
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];

    const lead = {
      client_first_name: firstName,
      client_last_name: lastName,
      email: `demo+${String(idx).padStart(3,"0")}@example.com`,
      phone: `555-${String(100 + cityIdx).padStart(3,"0")}-${String(1000 + idx).padStart(4,"0")}`,
      event_type: eventType,
      event_date: d(eventDays),
      city,
      lead_status: leadStatus,
      status,
      pipeline_stage,
      lead_source: source,
      priority,
      do_not_call: (i % 12 === 0), // ~8% do_not_call
      guest_count: 50 + (i * 7) % 350,
      source_detail: SEED_TAG,
      is_deleted: false,
      inquiry_date: dt(inquiryDaysAgo),
    };

    // x_dated: set followup date
    if (leadStatus === "x_dated") {
      lead.x_date_followup_at = d(7 + (i % 30));
    }

    // booked leads: add financial fields
    if (["booked_pending","booked"].includes(leadStatus)) {
      lead.quote_amount = 2000 + (i * 50) % 4500;
      lead.total_fee = lead.quote_amount;
      lead.booked_date = dt(3 + (i % 15));
    }

    // Some leads have a partner name (weddings/anniversaries)
    if (["wedding","anniversary","mitzvah","quinceañera"].includes(eventType) && i % 3 !== 0) {
      lead.partner_first_name = PARTNER_NAMES[i % PARTNER_NAMES.length];
      lead.partner_last_name = LAST_NAMES[(i + 50) % LAST_NAMES.length];
    }

    // Venue for some leads
    if (i % 4 === 0) {
      const venues = VENUES_BY_CITY[city];
      lead.venue_name = venues[i % venues.length];
    }

    leads.push(lead);
  }
  return leads;
}

// ── Generate 250 events ───────────────────────────────────────────────────────
// First 150 use linkedEmail to pair with a lead. Last 100 are standalone.
function buildEvents() {
  const events = [];

  const COMPLETED_FULL = { planning_complete:true, timeline_complete:true, music_complete:true, contract_signed:true, deposit_paid:true, balance_paid:true, final_call_completed:true, dj_briefed:true, readiness_score:100 };
  const FINALIZED      = { planning_complete:true, timeline_complete:true, music_complete:true, contract_signed:true, deposit_paid:true, final_call_completed:true, dj_briefed:true, readiness_score:95 };
  const PLANNING       = { planning_complete:true, contract_signed:true, deposit_paid:true, readiness_score:55 };
  const BOOKED_FULL    = { contract_signed:true, deposit_paid:true, readiness_score:30 };
  const BOOKED_BASIC   = { readiness_score:15 };

  const DJ_NAMES = ["Alex Rivera","Jordan Smith","Sam Taylor","Chris Lee","Morgan Davis","Casey Wilson","Jamie Brown","Drew Johnson","Quinn Martinez","Avery Thompson","Blake Anderson","Cameron Garcia","Devon Harris","Elliot Clark","Finley Lewis","Harper Robinson","Indigo Walker","Jordan Young","Kai Allen","Lane King"];

  for (let i = 0; i < 250; i++) {
    const idx = i + 1;
    const cityIdx = i % 10;
    const city = CITIES[cityIdx];
    const eventType = EVENT_TYPES[i % EVENT_TYPES.length];

    // Status distribution across 250 events:
    // 0-49: completed (20%), 50-99: finalized (20%), 100-149: planning_in_progress (20%),
    // 150-174: booked (10%), 175-199: booked_pending (10%), 200-214: cancelled (6%), 215-224: postponed (4%), 225-249: mixed
    let status, readiness, extras;
    if (i < 50) {
      status = "completed";
      extras = { ...COMPLETED_FULL };
      // ~20% of completed have low survey scores
      if (i % 5 === 0) {
        extras.survey_score = 55 + (i % 20);
        extras.survey_avg   = extras.survey_score;
        extras.survey_flag  = "low_score";
        extras.review_submitted = true;
      } else {
        extras.survey_score = 82 + (i % 18);
        extras.survey_avg   = extras.survey_score;
        extras.review_submitted = i % 3 !== 0;
      }
    } else if (i < 100) {
      status = "finalized";
      extras = { ...FINALIZED };
    } else if (i < 150) {
      status = "planning_in_progress";
      extras = { ...PLANNING };
    } else if (i < 175) {
      status = "booked";
      extras = { ...BOOKED_FULL };
    } else if (i < 200) {
      status = "booked_pending";
      extras = { ...BOOKED_BASIC };
    } else if (i < 215) {
      status = "cancelled";
      extras = { readiness_score: 0 };
    } else if (i < 225) {
      status = "postponed";
      extras = { ...BOOKED_BASIC };
    } else {
      // Remaining: cycle through remaining statuses
      const remaining = ["booked","planning_in_progress","booked_pending","finalized"];
      status = remaining[i % remaining.length];
      extras = status === "booked" ? { ...BOOKED_FULL } : status === "planning_in_progress" ? { ...PLANNING } : { ...BOOKED_BASIC };
    }

    // Event date: completed → past, others → future
    let eventDays;
    if (status === "completed") eventDays = -5 - (i * 3) % 180;
    else if (status === "finalized") eventDays = 5 + (i % 60);
    else if (status === "planning_in_progress") eventDays = 30 + (i % 120);
    else if (status === "cancelled") eventDays = 30 + (i % 90);
    else if (status === "postponed") eventDays = 180 + (i % 120);
    else eventDays = 60 + (i % 180);

    const firstName = FIRST_NAMES[(i + 10) % FIRST_NAMES.length];
    const lastName  = LAST_NAMES[(i + 10) % LAST_NAMES.length];
    const firstName2 = FIRST_NAMES[(i + 60) % FIRST_NAMES.length];
    const lastName2  = LAST_NAMES[(i + 60) % LAST_NAMES.length];

    const eventName = ["wedding","anniversary","mitzvah","quinceañera"].includes(eventType)
      ? `${lastName} - ${lastName2} ${eventType.charAt(0).toUpperCase()+eventType.slice(1).replace("_"," ")}`
      : `${city} ${eventType.replace("_"," ")} ${idx}`;

    const packageName = PACKAGES[i % PACKAGES.length];
    const packagePrice = 2000 + (i * 53) % 4500;

    const venues = VENUES_BY_CITY[city];
    const venue  = venues[i % venues.length];

    const event = {
      event_name: eventName,
      event_type: eventType,
      event_date: d(eventDays),
      city,
      status,
      venue_name: i % 3 !== 0 ? venue : undefined,
      guest_count: 60 + (i * 11) % 340,
      contact_name: `${firstName} ${lastName}`,
      contact_email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@demo.com`,
      package_name: packageName,
      package_price: packagePrice,
      start_time: ["4:00 PM","4:30 PM","5:00 PM","5:30 PM","6:00 PM","6:30 PM","7:00 PM"][i % 7],
      end_time:   ["9:00 PM","9:30 PM","10:00 PM","10:30 PM","11:00 PM","11:30 PM","12:00 AM"][i % 7],
      internal_notes: `[${SEED_TAG}]`,
      is_deleted: false,
      ...extras,
    };

    // Assign DJ for booked+ events
    if (!["cancelled","booked_pending"].includes(status)) {
      event.assigned_dj = DJ_NAMES[i % DJ_NAMES.length];
    }

    // booked_date for booked+ events
    if (!["cancelled","booked_pending"].includes(status)) {
      event.booked_date = d(-(5 + (i % 30)));
    }

    // Link to lead for first 150 events (indices 0-149)
    if (i < 150) {
      event._linkedEmail = `demo+${String(i + 1).padStart(3,"0")}@example.com`;
    }

    events.push(event);
  }
  return events;
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden: admin only" }, { status: 403 });

    const svc = base44.asServiceRole;

    // ── Step 1: Create 250 leads (chunked) ──────────────────────────────────
    const leadDefs = buildLeads();
    const leadResults = await chunkCreate(svc, "Lead", leadDefs, 50);

    // Build email → lead index
    const leadByEmail = {};
    for (const lead of leadResults) {
      if (lead.email) leadByEmail[lead.email] = lead;
    }

    // ── Step 2: Create 250 events (chunked, with lead_id for linked pairs) ──
    const eventDefs = buildEvents();
    const eventPayloads = eventDefs.map(rawEvent => {
      const { _linkedEmail, ...eventData } = rawEvent;
      // Remove undefined fields
      const clean = Object.fromEntries(Object.entries(eventData).filter(([,v]) => v !== undefined));

      if (_linkedEmail && leadByEmail[_linkedEmail]) {
        clean.lead_id = leadByEmail[_linkedEmail].id;
        clean.contact_email = leadByEmail[_linkedEmail].email;
      }
      return { ...clean, _linkedEmail };
    });

    // Create events in chunks, stripping the internal _linkedEmail marker
    const eventResults = [];
    for (let i = 0; i < eventPayloads.length; i += 50) {
      const chunk = eventPayloads.slice(i, i + 50);
      const created = await Promise.all(chunk.map(({ _linkedEmail: _le, ...payload }) =>
        svc.entities.Event.create(payload).then(ev => ({ event: ev, linkedEmail: _le }))
      ));
      eventResults.push(...created);
    }

    // ── Step 3: Back-link event_id onto leads (chunked) ──────────────────────
    const backLinkUpdates = [];
    for (const { event, linkedEmail } of eventResults) {
      if (linkedEmail && leadByEmail[linkedEmail]) {
        backLinkUpdates.push({ leadId: leadByEmail[linkedEmail].id, eventId: event.id });
      }
    }

    for (let i = 0; i < backLinkUpdates.length; i += 50) {
      const chunk = backLinkUpdates.slice(i, i + 50);
      await Promise.all(chunk.map(({ leadId, eventId }) =>
        svc.entities.Lead.update(leadId, { event_id: eventId })
      ));
    }

    // ── Verification ─────────────────────────────────────────────────────────
    const intendedLinks = eventDefs.filter(e => e._linkedEmail).length;
    const missingLeadForLinkedEmail = eventDefs
      .filter(e => e._linkedEmail && !leadByEmail[e._linkedEmail])
      .map(e => e._linkedEmail);

    const eventsWithLeadId = eventResults.filter(({ event }) => !!event.lead_id).length;
    const leadsWithEventId = backLinkUpdates.length; // one update per linked pair

    const mismatchedLinks = [];
    for (const { event, linkedEmail } of eventResults) {
      if (linkedEmail && leadByEmail[linkedEmail] && !event.lead_id) {
        mismatchedLinks.push({ eventId: event.id, linkedEmail, reason: "lead_id not set on created event" });
      }
    }

    // City + status breakdowns
    const citiesUsed = [...new Set(eventResults.map(({ event }) => event.city))];
    const eventStatusBreakdown = {};
    for (const { event } of eventResults) {
      eventStatusBreakdown[event.status] = (eventStatusBreakdown[event.status] || 0) + 1;
    }

    return Response.json({
      ok: true,
      leadsCreated: leadResults.length,
      eventsCreated: eventResults.length,
      intendedLinks,
      linkedPairsCreated: backLinkUpdates.length,
      eventsWithLeadId,
      leadsWithEventId,
      missingLeadForLinkedEmail,
      mismatchedLinks,
      citiesUsed,
      eventStatusBreakdown,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});