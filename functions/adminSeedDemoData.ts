/**
 * Admin-only: Seed ~50 demo leads and ~50 demo events using ONLY canonical enums.
 * All seeded rows are tagged with source_detail="DEMO_SEED_v1" (leads) or
 * internal_notes containing "DEMO_SEED_v1" (events) for targeted deletion on reset.
 * Lead↔Event pairs are linked via lead_id / event_id.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const today = new Date();
const d = (days) => {
  const dt = new Date(today);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().split("T")[0];
};

// Seed marker used to identify demo rows for targeted deletion
const SEED_TAG = "DEMO_SEED_v1";

// ─── 50 LEADS ───────────────────────────────────────────────────────────────
// Columns: client_first_name, client_last_name, email, phone, event_type,
//   event_date, city, lead_status, status, pipeline_stage, lead_source,
//   priority, do_not_call, x_date_followup_at, guest_count, venue_name,
//   quote_amount, total_fee, booked_date, inquiry_date, notes
// source_detail is always "DEMO_SEED_v1" (seed marker)

const DEMO_LEADS = [
  // ── TUL ──
  { client_first_name:"Sarah",    client_last_name:"Mitchell",  email:"demo+001@example.com", phone:"918-555-0001", event_type:"wedding",      event_date:d(90),   city:"TUL",  lead_status:"hot_lead",           status:"qualified",               pipeline_stage:"consultation_scheduled", lead_source:"website",       priority:"high",   do_not_call:false, guest_count:180, venue_name:"The Mayo Hotel",       quote_amount:3200, inquiry_date:new Date(today-5*864e5).toISOString() },
  { client_first_name:"Laura",    client_last_name:"Simmons",   email:"demo+002@example.com", phone:"918-555-0002", event_type:"mitzvah",      event_date:d(55),   city:"TUL",  lead_status:"appointment_set",    status:"consultation_scheduled",  pipeline_stage:"consultation_scheduled", lead_source:"referral",      priority:"high",   do_not_call:false, guest_count:120, inquiry_date:new Date(today-3*864e5).toISOString() },
  { client_first_name:"Kevin",    client_last_name:"Roper",     email:"demo+003@example.com", phone:"918-555-0003", event_type:"wedding",      event_date:d(200),  city:"TUL",  lead_status:"web_lead",           status:"new",                     pipeline_stage:"new_inquiry",            lead_source:"google_ads",    priority:"medium", do_not_call:false, guest_count:220, inquiry_date:new Date(today-1*864e5).toISOString() },
  { client_first_name:"Donna",    client_last_name:"Reese",     email:"demo+004@example.com", phone:"918-555-0004", event_type:"anniversary",  event_date:d(40),   city:"TUL",  lead_status:"x_dated",            status:"follow_up",               pipeline_stage:"follow_up",              lead_source:"the_knot",      priority:"low",    do_not_call:false, guest_count:60,  x_date_followup_at:d(10), inquiry_date:new Date(today-20*864e5).toISOString() },
  { client_first_name:"Randy",    client_last_name:"Holt",      email:"demo+005@example.com", phone:"918-555-0005", event_type:"corporate",    event_date:d(30),   city:"TUL",  lead_status:"missed_appointment", status:"attempted_contact",       pipeline_stage:"attempted_contact",      lead_source:"phone_call",    priority:"low",    do_not_call:true,  guest_count:90,  inquiry_date:new Date(today-12*864e5).toISOString() },
  // ── DFW ──
  { client_first_name:"James",    client_last_name:"Harrington",email:"demo+006@example.com", phone:"214-555-0006", event_type:"corporate",    event_date:d(45),   city:"DFW",  lead_status:"booked_pending",     status:"booked",                  pipeline_stage:"booked",                 lead_source:"referral",      priority:"high",   do_not_call:false, guest_count:250, venue_name:"Omni Dallas", quote_amount:4500, total_fee:4500, booked_date:d(-2), inquiry_date:new Date(today-15*864e5).toISOString() },
  { client_first_name:"Nicole",   client_last_name:"Burns",     email:"demo+007@example.com", phone:"214-555-0007", event_type:"wedding",      event_date:d(110),  city:"DFW",  lead_status:"hot_lead",           status:"quote_sent",              pipeline_stage:"quote_sent",             lead_source:"meta_ads",      priority:"high",   do_not_call:false, guest_count:300, quote_amount:5000, inquiry_date:new Date(today-6*864e5).toISOString() },
  { client_first_name:"Andre",    client_last_name:"Washington",email:"demo+008@example.com", phone:"214-555-0008", event_type:"mitzvah",      event_date:d(70),   city:"DFW",  lead_status:"email_only",         status:"new",                     pipeline_stage:"new_inquiry",            lead_source:"website",       priority:"medium", do_not_call:false, guest_count:150, inquiry_date:new Date(today-2*864e5).toISOString() },
  { client_first_name:"Crystal",  client_last_name:"Ford",      email:"demo+009@example.com", phone:"214-555-0009", event_type:"birthday",     event_date:d(25),   city:"DFW",  lead_status:"never_booked",       status:"lost",                    pipeline_stage:"lost",                   lead_source:"weddingwire",   priority:"low",    do_not_call:true,  guest_count:50,  lost_reason:"price", inquiry_date:new Date(today-60*864e5).toISOString() },
  { client_first_name:"Marcus",   client_last_name:"Tillman",   email:"demo+010@example.com", phone:"214-555-0010", event_type:"corporate",    event_date:d(80),   city:"DFW",  lead_status:"corporate_lead",     status:"contacted",               pipeline_stage:"contacted",              lead_source:"vendor_referral",priority:"medium",do_not_call:false, guest_count:180, inquiry_date:new Date(today-4*864e5).toISOString() },
  // ── HOU ──
  { client_first_name:"Patricia", client_last_name:"Owens",     email:"demo+011@example.com", phone:"713-555-0011", event_type:"wedding",      event_date:d(130),  city:"HOU",  lead_status:"bridal_show_lead",   status:"consultation_scheduled",  pipeline_stage:"consultation_scheduled", lead_source:"bridal_show",   priority:"high",   do_not_call:false, guest_count:200, venue_name:"The Houstonian", inquiry_date:new Date(today-7*864e5).toISOString() },
  { client_first_name:"Derrick",  client_last_name:"Holmes",    email:"demo+012@example.com", phone:"713-555-0012", event_type:"corporate",    event_date:d(50),   city:"HOU",  lead_status:"booked_pending",     status:"booked",                  pipeline_stage:"booked",                 lead_source:"referral",      priority:"high",   do_not_call:false, guest_count:350, quote_amount:5500, total_fee:5500, booked_date:d(-5), inquiry_date:new Date(today-20*864e5).toISOString() },
  { client_first_name:"Sandra",   client_last_name:"Pierce",    email:"demo+013@example.com", phone:"713-555-0013", event_type:"quinceañera",  event_date:d(65),   city:"HOU",  lead_status:"web_lead",           status:"new",                     pipeline_stage:"new_inquiry",            lead_source:"google_ads",    priority:"medium", do_not_call:false, guest_count:110, inquiry_date:new Date(today-1*864e5).toISOString() },
  { client_first_name:"Victor",   client_last_name:"Santos",    email:"demo+014@example.com", phone:"713-555-0014", event_type:"wedding",      event_date:d(180),  city:"HOU",  lead_status:"x_dated",            status:"follow_up",               pipeline_stage:"follow_up",              lead_source:"meta_ads",      priority:"medium", do_not_call:false, guest_count:160, x_date_followup_at:d(7), inquiry_date:new Date(today-25*864e5).toISOString() },
  { client_first_name:"Tara",     client_last_name:"Blackwell", email:"demo+015@example.com", phone:"713-555-0015", event_type:"birthday",     event_date:d(20),   city:"HOU",  lead_status:"lost_sale",          status:"lost",                    pipeline_stage:"lost",                   lead_source:"yelp",          priority:"low",    do_not_call:true,  guest_count:40,  lost_reason:"availability", inquiry_date:new Date(today-90*864e5).toISOString() },
  // ── SAT ──
  { client_first_name:"Maria",    client_last_name:"Garza",     email:"demo+016@example.com", phone:"210-555-0016", event_type:"quinceañera",  event_date:d(60),   city:"SAT",  lead_status:"hot_lead",           status:"quote_sent",              pipeline_stage:"quote_sent",             lead_source:"google_ads",    priority:"high",   do_not_call:false, guest_count:120, quote_amount:2800, inquiry_date:new Date(today-8*864e5).toISOString() },
  { client_first_name:"Carlos",   client_last_name:"Mendez",    email:"demo+017@example.com", phone:"210-555-0017", event_type:"wedding",      event_date:d(95),   city:"SAT",  lead_status:"appointment_set",    status:"consultation_scheduled",  pipeline_stage:"consultation_scheduled", lead_source:"referral",      priority:"high",   do_not_call:false, guest_count:210, venue_name:"Pearl Stable", inquiry_date:new Date(today-4*864e5).toISOString() },
  { client_first_name:"Elena",    client_last_name:"Rodriguez", email:"demo+018@example.com", phone:"210-555-0018", event_type:"wedding",      event_date:d(-60),  city:"SAT",  lead_status:"booked_pending",     status:"booked",                  pipeline_stage:"booked",                 lead_source:"weddingwire",   priority:"high",   do_not_call:false, guest_count:150, total_fee:3000, booked_date:d(-100), inquiry_date:new Date(today-120*864e5).toISOString() },
  { client_first_name:"Roberto",  client_last_name:"Cruz",      email:"demo+019@example.com", phone:"210-555-0019", event_type:"corporate",    event_date:d(35),   city:"SAT",  lead_status:"missed_appointment", status:"attempted_contact",       pipeline_stage:"attempted_contact",      lead_source:"phone_call",    priority:"low",    do_not_call:false, guest_count:80,  inquiry_date:new Date(today-11*864e5).toISOString() },
  { client_first_name:"Leticia",  client_last_name:"Flores",    email:"demo+020@example.com", phone:"210-555-0020", event_type:"birthday",     event_date:d(15),   city:"SAT",  lead_status:"email_only",         status:"contacted",               pipeline_stage:"contacted",              lead_source:"website",       priority:"medium", do_not_call:true,  guest_count:65,  inquiry_date:new Date(today-3*864e5).toISOString() },
  // ── KC ──
  { client_first_name:"Derek",    client_last_name:"Okonkwo",   email:"demo+021@example.com", phone:"816-555-0021", event_type:"wedding",      event_date:d(120),  city:"KC",   lead_status:"x_dated",            status:"follow_up",               pipeline_stage:"follow_up",              lead_source:"the_knot",      priority:"medium", do_not_call:false, guest_count:200, venue_name:"Longview Mansion", x_date_followup_at:d(14), inquiry_date:new Date(today-30*864e5).toISOString() },
  { client_first_name:"Alicia",   client_last_name:"Chambers",  email:"demo+022@example.com", phone:"816-555-0022", event_type:"anniversary",  event_date:d(75),   city:"KC",   lead_status:"bridal_show_lead",   status:"contacted",               pipeline_stage:"contacted",              lead_source:"bridal_show",   priority:"medium", do_not_call:false, guest_count:90,  inquiry_date:new Date(today-5*864e5).toISOString() },
  { client_first_name:"Thomas",   client_last_name:"Grant",     email:"demo+023@example.com", phone:"816-555-0023", event_type:"corporate",    event_date:d(50),   city:"KC",   lead_status:"booked_pending",     status:"booked",                  pipeline_stage:"booked",                 lead_source:"referral",      priority:"high",   do_not_call:false, guest_count:280, quote_amount:4200, total_fee:4200, booked_date:d(-3), inquiry_date:new Date(today-18*864e5).toISOString() },
  { client_first_name:"Monica",   client_last_name:"Webb",      email:"demo+024@example.com", phone:"816-555-0024", event_type:"wedding",      event_date:d(160),  city:"KC",   lead_status:"web_lead",           status:"new",                     pipeline_stage:"new_inquiry",            lead_source:"google_ads",    priority:"medium", do_not_call:false, guest_count:185, inquiry_date:new Date(today-2*864e5).toISOString() },
  { client_first_name:"Gerald",   client_last_name:"Pope",      email:"demo+025@example.com", phone:"816-555-0025", event_type:"school_dance", event_date:d(40),   city:"KC",   lead_status:"never_booked",       status:"ghosted",                 pipeline_stage:"lost",                   lead_source:"website",       priority:"low",    do_not_call:true,  guest_count:300, inquiry_date:new Date(today-55*864e5).toISOString() },
  // ── STL ──
  { client_first_name:"Brittany", client_last_name:"Cole",      email:"demo+026@example.com", phone:"314-555-0026", event_type:"birthday",     event_date:d(30),   city:"STL",  lead_status:"missed_appointment", status:"attempted_contact",       pipeline_stage:"attempted_contact",      lead_source:"phone_call",    priority:"low",    do_not_call:true,  guest_count:80,  inquiry_date:new Date(today-10*864e5).toISOString() },
  { client_first_name:"Douglas",  client_last_name:"Harper",    email:"demo+027@example.com", phone:"314-555-0027", event_type:"corporate",    event_date:d(85),   city:"STL",  lead_status:"corporate_lead",     status:"quote_sent",              pipeline_stage:"quote_sent",             lead_source:"vendor_referral",priority:"high",  do_not_call:false, guest_count:400, venue_name:"Ballpark Village", quote_amount:5500, inquiry_date:new Date(today-8*864e5).toISOString() },
  { client_first_name:"Melissa",  client_last_name:"Knight",    email:"demo+028@example.com", phone:"314-555-0028", event_type:"wedding",      event_date:d(145),  city:"STL",  lead_status:"hot_lead",           status:"deposit_requested",       pipeline_stage:"deposit_requested",      lead_source:"referral",      priority:"high",   do_not_call:false, guest_count:230, inquiry_date:new Date(today-9*864e5).toISOString() },
  { client_first_name:"Brian",    client_last_name:"Stone",     email:"demo+029@example.com", phone:"314-555-0029", event_type:"mitzvah",      event_date:d(70),   city:"STL",  lead_status:"x_dated",            status:"follow_up",               pipeline_stage:"follow_up",              lead_source:"the_knot",      priority:"medium", do_not_call:false, guest_count:130, x_date_followup_at:d(21), inquiry_date:new Date(today-22*864e5).toISOString() },
  { client_first_name:"Karen",    client_last_name:"Curtis",    email:"demo+030@example.com", phone:"314-555-0030", event_type:"holiday_party",event_date:d(45),   city:"STL",  lead_status:"email_only",         status:"contacted",               pipeline_stage:"contacted",              lead_source:"website",       priority:"low",    do_not_call:false, guest_count:75,  inquiry_date:new Date(today-4*864e5).toISOString() },
  // ── INDY ──
  { client_first_name:"Connor",   client_last_name:"Walsh",     email:"demo+031@example.com", phone:"317-555-0031", event_type:"school_dance", event_date:d(75),   city:"INDY", lead_status:"corporate_lead",     status:"quote_sent",              pipeline_stage:"quote_sent",             lead_source:"referral",      priority:"medium", do_not_call:false, guest_count:350, quote_amount:2800, inquiry_date:new Date(today-7*864e5).toISOString() },
  { client_first_name:"Shannon",  client_last_name:"Lyons",     email:"demo+032@example.com", phone:"317-555-0032", event_type:"wedding",      event_date:d(100),  city:"INDY", lead_status:"appointment_set",    status:"consultation_scheduled",  pipeline_stage:"consultation_scheduled", lead_source:"google_ads",    priority:"high",   do_not_call:false, guest_count:190, inquiry_date:new Date(today-3*864e5).toISOString() },
  { client_first_name:"Nathan",   client_last_name:"Barker",    email:"demo+033@example.com", phone:"317-555-0033", event_type:"wedding",      event_date:d(-45),  city:"INDY", lead_status:"booked_pending",     status:"booked",                  pipeline_stage:"booked",                 lead_source:"weddingwire",   priority:"high",   do_not_call:false, guest_count:170, total_fee:3400, booked_date:d(-80), inquiry_date:new Date(today-100*864e5).toISOString() },
  { client_first_name:"Joanna",   client_last_name:"Perkins",   email:"demo+034@example.com", phone:"317-555-0034", event_type:"corporate",    event_date:d(55),   city:"INDY", lead_status:"hot_lead",           status:"qualified",               pipeline_stage:"consultation_completed", lead_source:"referral",      priority:"high",   do_not_call:false, guest_count:220, inquiry_date:new Date(today-6*864e5).toISOString() },
  { client_first_name:"Philip",   client_last_name:"Murray",    email:"demo+035@example.com", phone:"317-555-0035", event_type:"birthday",     event_date:d(20),   city:"INDY", lead_status:"lost_sale",          status:"lost",                    pipeline_stage:"lost",                   lead_source:"yelp",          priority:"low",    do_not_call:true,  guest_count:55,  lost_reason:"competitor", inquiry_date:new Date(today-70*864e5).toISOString() },
  // ── NASH ──
  { client_first_name:"Priya",    client_last_name:"Nair",      email:"demo+036@example.com", phone:"615-555-0036", event_type:"wedding",      event_date:d(150),  city:"NASH", lead_status:"bridal_show_lead",   status:"contacted",               pipeline_stage:"contacted",              lead_source:"bridal_show",   priority:"medium", do_not_call:false, guest_count:220, venue_name:"Noelle Nashville", inquiry_date:new Date(today-4*864e5).toISOString() },
  { client_first_name:"Jacob",    client_last_name:"Caldwell",  email:"demo+037@example.com", phone:"615-555-0037", event_type:"wedding",      event_date:d(-90),  city:"NASH", lead_status:"booked_pending",     status:"booked",                  pipeline_stage:"booked",                 lead_source:"the_knot",      priority:"high",   do_not_call:false, guest_count:260, total_fee:4000, booked_date:d(-130), inquiry_date:new Date(today-150*864e5).toISOString() },
  { client_first_name:"Heather",  client_last_name:"Walsh",     email:"demo+038@example.com", phone:"615-555-0038", event_type:"corporate",    event_date:d(65),   city:"NASH", lead_status:"web_lead",           status:"new",                     pipeline_stage:"new_inquiry",            lead_source:"google_ads",    priority:"medium", do_not_call:false, guest_count:140, inquiry_date:new Date(today-1*864e5).toISOString() },
  { client_first_name:"Louis",    client_last_name:"Ingram",    email:"demo+039@example.com", phone:"615-555-0039", event_type:"mitzvah",      event_date:d(85),   city:"NASH", lead_status:"x_dated",            status:"follow_up",               pipeline_stage:"follow_up",              lead_source:"referral",      priority:"medium", do_not_call:false, guest_count:100, x_date_followup_at:d(30), inquiry_date:new Date(today-28*864e5).toISOString() },
  { client_first_name:"Deborah",  client_last_name:"Tran",      email:"demo+040@example.com", phone:"615-555-0040", event_type:"anniversary",  event_date:d(50),   city:"NASH", lead_status:"email_only",         status:"attempted_contact",       pipeline_stage:"attempted_contact",      lead_source:"website",       priority:"low",    do_not_call:true,  guest_count:70,  inquiry_date:new Date(today-5*864e5).toISOString() },
  // ── DEN ──
  { client_first_name:"Tyler",    client_last_name:"Marsh",     email:"demo+041@example.com", phone:"303-555-0041", event_type:"anniversary",  event_date:d(55),   city:"DEN",  lead_status:"never_booked",       status:"lost",                    pipeline_stage:"lost",                   lead_source:"weddingwire",   priority:"low",    do_not_call:true,  guest_count:60,  lost_reason:"price", inquiry_date:new Date(today-45*864e5).toISOString() },
  { client_first_name:"Jin",      client_last_name:"Park",      email:"demo+042@example.com", phone:"303-555-0042", event_type:"wedding",      event_date:d(180),  city:"DEN",  lead_status:"web_lead",           status:"new",                     pipeline_stage:"new_inquiry",            lead_source:"meta_ads",      priority:"medium", do_not_call:false, guest_count:140, inquiry_date:new Date(today-2*864e5).toISOString() },
  { client_first_name:"Ashley",   client_last_name:"Quinn",     email:"demo+043@example.com", phone:"303-555-0043", event_type:"wedding",      event_date:d(-120), city:"DEN",  lead_status:"booked_pending",     status:"booked",                  pipeline_stage:"booked",                 lead_source:"referral",      priority:"high",   do_not_call:false, guest_count:200, total_fee:3600, booked_date:d(-165), inquiry_date:new Date(today-180*864e5).toISOString() },
  { client_first_name:"Cody",     client_last_name:"Jensen",    email:"demo+044@example.com", phone:"303-555-0044", event_type:"corporate",    event_date:d(95),   city:"DEN",  lead_status:"appointment_set",    status:"consultation_scheduled",  pipeline_stage:"consultation_scheduled", lead_source:"vendor_referral",priority:"high",  do_not_call:false, guest_count:240, inquiry_date:new Date(today-6*864e5).toISOString() },
  { client_first_name:"Renee",    client_last_name:"Horton",    email:"demo+045@example.com", phone:"303-555-0045", event_type:"birthday",     event_date:d(25),   city:"DEN",  lead_status:"missed_appointment", status:"attempted_contact",       pipeline_stage:"attempted_contact",      lead_source:"phone_call",    priority:"low",    do_not_call:false, guest_count:45,  inquiry_date:new Date(today-9*864e5).toISOString() },
  // ── ATL ──
  { client_first_name:"Angela",   client_last_name:"Freeman",   email:"demo+046@example.com", phone:"404-555-0046", event_type:"wedding",      event_date:d(200),  city:"ATL",  lead_status:"x_dated",            status:"follow_up",               pipeline_stage:"follow_up",              lead_source:"meta_ads",      priority:"high",   do_not_call:false, guest_count:175, venue_name:"The Georgian Terrace", x_date_followup_at:d(21), inquiry_date:new Date(today-20*864e5).toISOString() },
  { client_first_name:"Raymond",  client_last_name:"Brooks",    email:"demo+047@example.com", phone:"404-555-0047", event_type:"corporate",    event_date:d(70),   city:"ATL",  lead_status:"hot_lead",           status:"deposit_requested",       pipeline_stage:"deposit_requested",      lead_source:"referral",      priority:"high",   do_not_call:false, guest_count:320, quote_amount:6000, inquiry_date:new Date(today-10*864e5).toISOString() },
  { client_first_name:"Vanessa",  client_last_name:"Snow",      email:"demo+048@example.com", phone:"404-555-0048", event_type:"wedding",      event_date:d(-150), city:"ATL",  lead_status:"booked_pending",     status:"booked",                  pipeline_stage:"booked",                 lead_source:"weddingwire",   priority:"high",   do_not_call:false, guest_count:195, total_fee:3900, booked_date:d(-195), inquiry_date:new Date(today-210*864e5).toISOString() },
  { client_first_name:"Gregory",  client_last_name:"Vega",      email:"demo+049@example.com", phone:"404-555-0049", event_type:"mitzvah",      event_date:d(115),  city:"ATL",  lead_status:"bridal_show_lead",   status:"contacted",               pipeline_stage:"contacted",              lead_source:"bridal_show",   priority:"medium", do_not_call:false, guest_count:110, inquiry_date:new Date(today-4*864e5).toISOString() },
  { client_first_name:"Cheryl",   client_last_name:"Manning",   email:"demo+050@example.com", phone:"404-555-0050", event_type:"holiday_party",event_date:d(38),   city:"ATL",  lead_status:"lost_sale",          status:"lost",                    pipeline_stage:"lost",                   lead_source:"google_ads",    priority:"low",    do_not_call:true,  guest_count:85,  lost_reason:"no_response", inquiry_date:new Date(today-80*864e5).toISOString() },
];

// ─── 50 EVENTS ───────────────────────────────────────────────────────────────
// "linkedEmail" is used only to join to the lead created above — it is not stored on Event.
// Events with linkedEmail get lead_id set and the lead gets event_id set.

const COMPLETED_FULL = { planning_complete:true, timeline_complete:true, music_complete:true, contract_signed:true, deposit_paid:true, balance_paid:true, final_call_completed:true, dj_briefed:true, readiness_score:100 };
const FINALIZED = { planning_complete:true, timeline_complete:true, music_complete:true, contract_signed:true, deposit_paid:true, final_call_completed:true, dj_briefed:true, readiness_score:95 };
const PLANNING = { planning_complete:true, contract_signed:true, deposit_paid:true, readiness_score:55 };
const BOOKED_FULL = { contract_signed:true, deposit_paid:true, readiness_score:30 };
const BOOKED_BASIC = { readiness_score:15 };

const DEMO_EVENTS = [
  // ── 10 COMPLETED ──
  { linkedEmail:"demo+046@example.com", event_name:"Freeman - Davis Wedding",       event_type:"wedding",      event_date:d(-30),  city:"ATL",  status:"completed", ...COMPLETED_FULL, venue_name:"The Georgian Terrace", guest_count:175, contact_name:"Angela Freeman",   start_time:"5:00 PM",  end_time:"11:00 PM", package_name:"Grand Package",     package_price:3800, booked_date:d(-80),  survey_score:98, survey_avg:98 },
  { linkedEmail:"demo+018@example.com", event_name:"Rodriguez Quinceañera",         event_type:"quinceañera",  event_date:d(-60),  city:"SAT",  status:"completed", ...COMPLETED_FULL, guest_count:150,                   contact_name:"Elena Rodriguez",  start_time:"6:00 PM",  end_time:"11:00 PM", package_name:"Premier Package",   package_price:3000, booked_date:d(-100), survey_score:72, survey_avg:72, survey_flag:"low_score" },
  { linkedEmail:"demo+033@example.com", event_name:"Barker - Hughes Wedding",       event_type:"wedding",      event_date:d(-45),  city:"INDY", status:"completed", ...COMPLETED_FULL, guest_count:170,                   contact_name:"Nathan Barker",    start_time:"4:30 PM",  end_time:"10:30 PM", package_name:"Premier Package",   package_price:3400, booked_date:d(-80),  survey_score:95, survey_avg:95 },
  { linkedEmail:"demo+037@example.com", event_name:"Caldwell - Evans Wedding",      event_type:"wedding",      event_date:d(-90),  city:"NASH", status:"completed", ...COMPLETED_FULL, guest_count:260,                   contact_name:"Jacob Caldwell",   start_time:"5:00 PM",  end_time:"11:00 PM", package_name:"Grand Package",     package_price:4000, booked_date:d(-130), survey_score:68, survey_avg:68, survey_flag:"low_score" },
  { linkedEmail:"demo+043@example.com", event_name:"Quinn - Zhao Wedding",          event_type:"wedding",      event_date:d(-120), city:"DEN",  status:"completed", ...COMPLETED_FULL, guest_count:200,                   contact_name:"Ashley Quinn",     start_time:"4:00 PM",  end_time:"10:00 PM", package_name:"Premier Package",   package_price:3600, booked_date:d(-165), survey_score:91, survey_avg:91 },
  { linkedEmail:"demo+048@example.com", event_name:"Snow - Turner Wedding",         event_type:"wedding",      event_date:d(-150), city:"ATL",  status:"completed", ...COMPLETED_FULL, guest_count:195,                   contact_name:"Vanessa Snow",     start_time:"5:30 PM",  end_time:"11:30 PM", package_name:"Grand Package",     package_price:3900, booked_date:d(-195), survey_score:88, survey_avg:88 },
  { event_name:"Nguyen - Lopez Wedding",        event_type:"wedding",      event_date:d(-15),  city:"TUL",  status:"completed", ...COMPLETED_FULL, guest_count:145, contact_name:"Amy Nguyen",     start_time:"5:00 PM",  end_time:"10:30 PM", package_name:"Standard Package",  package_price:2800, booked_date:d(-60),  survey_score:100, survey_avg:100 },
  { event_name:"Harrison Corp Year-End",        event_type:"corporate",    event_date:d(-25),  city:"DFW",  status:"completed", ...COMPLETED_FULL, guest_count:280, contact_name:"Gene Harrison",  start_time:"7:00 PM",  end_time:"11:00 PM", package_name:"Corporate Elite",   package_price:4800, booked_date:d(-70),  survey_score:82, survey_avg:82 },
  { event_name:"Kim Sweet 16",                  event_type:"birthday",     event_date:d(-10),  city:"KC",   status:"completed", ...COMPLETED_FULL, guest_count:80,  contact_name:"Lisa Kim",       start_time:"6:00 PM",  end_time:"10:00 PM", package_name:"Standard Package",  package_price:2200, booked_date:d(-50),  survey_score:60, survey_avg:60, survey_flag:"low_score" },
  { event_name:"Patel - Singh Wedding",         event_type:"wedding",      event_date:d(-5),   city:"HOU",  status:"completed", ...COMPLETED_FULL, guest_count:220, contact_name:"Raj Patel",      start_time:"5:00 PM",  end_time:"11:00 PM", package_name:"Grand Package",     package_price:4200, booked_date:d(-60),  survey_score:97, survey_avg:97 },
  // ── 10 FINALIZED ──
  { linkedEmail:"demo+012@example.com", event_name:"Holmes Energy Summit",          event_type:"corporate",    event_date:d(50),   city:"HOU",  status:"finalized", ...FINALIZED, venue_name:"The Houstonian", guest_count:350, contact_name:"Derrick Holmes", start_time:"6:00 PM",  end_time:"10:30 PM", package_name:"Corporate Elite",   package_price:5500, booked_date:d(-5) },
  { linkedEmail:"demo+006@example.com", event_name:"Harrington Corp Gala",          event_type:"corporate",    event_date:d(45),   city:"DFW",  status:"finalized", ...FINALIZED, venue_name:"Omni Dallas", guest_count:250, contact_name:"James Harrington", start_time:"6:00 PM",  end_time:"10:00 PM", package_name:"Corporate Elite",   package_price:4500, booked_date:d(-2) },
  { linkedEmail:"demo+023@example.com", event_name:"Grant Corporate Retreat",       event_type:"corporate",    event_date:d(50),   city:"KC",   status:"finalized", ...FINALIZED, guest_count:280,              contact_name:"Thomas Grant",   start_time:"7:00 PM",  end_time:"11:00 PM", package_name:"Corporate Elite",   package_price:4200, booked_date:d(-3) },
  { event_name:"Rivera - Johnson Wedding",      event_type:"wedding",      event_date:d(18),   city:"SAT",  status:"finalized", ...FINALIZED, guest_count:190, contact_name:"Rosa Rivera",    start_time:"5:00 PM",  end_time:"11:00 PM", package_name:"Grand Package",     package_price:3700, booked_date:d(-30) },
  { event_name:"ATL Networking Gala",           event_type:"corporate",    event_date:d(22),   city:"ATL",  status:"finalized", ...FINALIZED, guest_count:310, contact_name:"Denise Carter",  start_time:"6:30 PM",  end_time:"10:30 PM", package_name:"Corporate Elite",   package_price:5200, booked_date:d(-20) },
  { event_name:"Alvarez Wedding",               event_type:"wedding",      event_date:d(12),   city:"TUL",  status:"finalized", ...FINALIZED, guest_count:160, contact_name:"Julia Alvarez",  start_time:"4:30 PM",  end_time:"10:30 PM", package_name:"Premier Package",   package_price:3200, booked_date:d(-25) },
  { event_name:"INDY School Prom Night",        event_type:"school_dance", event_date:d(28),   city:"INDY", status:"finalized", ...FINALIZED, guest_count:350, contact_name:"Principal Davis",start_time:"7:00 PM",  end_time:"11:00 PM", package_name:"Standard Package",  package_price:2800, booked_date:d(-15) },
  { event_name:"DEN Holiday Gala",              event_type:"holiday_party",event_date:d(35),   city:"DEN",  status:"finalized", ...FINALIZED, guest_count:200, contact_name:"Frank Morgan",   start_time:"7:00 PM",  end_time:"11:00 PM", package_name:"Premier Package",   package_price:3500, booked_date:d(-18) },
  { event_name:"STL Networking Dinner",         event_type:"corporate",    event_date:d(15),   city:"STL",  status:"finalized", ...FINALIZED, guest_count:180, contact_name:"Brad Ellis",     start_time:"6:00 PM",  end_time:"10:00 PM", package_name:"Standard Package",  package_price:2900, booked_date:d(-10) },
  { event_name:"NASH Rooftop Reception",        event_type:"private_party",event_date:d(8),    city:"NASH", status:"finalized", ...FINALIZED, guest_count:130, contact_name:"Carla Moon",     start_time:"5:00 PM",  end_time:"9:00 PM",  package_name:"Standard Package",  package_price:2600, booked_date:d(-12) },
  // ── 10 PLANNING IN PROGRESS ──
  { linkedEmail:"demo+031@example.com", event_name:"Walsh INDY Prom 2026",          event_type:"school_dance", event_date:d(75),   city:"INDY", status:"planning_in_progress", ...PLANNING, guest_count:350, contact_name:"Connor Walsh", start_time:"7:00 PM", end_time:"11:00 PM", package_name:"Standard Package", package_price:2800, booked_date:d(-10) },
  { linkedEmail:"demo+036@example.com", event_name:"Nair - Patel Wedding",          event_type:"wedding",      event_date:d(150),  city:"NASH", status:"planning_in_progress", ...PLANNING, venue_name:"Noelle Nashville", guest_count:220, contact_name:"Priya Nair", start_time:"5:30 PM", end_time:"11:30 PM", package_name:"Grand Package", package_price:4200, booked_date:d(-5) },
  { linkedEmail:"demo+011@example.com", event_name:"Owens - Hall Wedding",          event_type:"wedding",      event_date:d(130),  city:"HOU",  status:"planning_in_progress", ...PLANNING, venue_name:"The Houstonian", guest_count:200, contact_name:"Patricia Owens", start_time:"5:00 PM", end_time:"11:00 PM", package_name:"Premier Package", package_price:3800, booked_date:d(-8) },
  { linkedEmail:"demo+017@example.com", event_name:"Mendez - Torres Wedding",       event_type:"wedding",      event_date:d(95),   city:"SAT",  status:"planning_in_progress", ...PLANNING, venue_name:"Pearl Stable", guest_count:210, contact_name:"Carlos Mendez", start_time:"5:00 PM", end_time:"11:00 PM", package_name:"Premier Package", package_price:3600, booked_date:d(-6) },
  { event_name:"TUL Corporate Awards",          event_type:"corporate",    event_date:d(105),  city:"TUL",  status:"planning_in_progress", ...PLANNING, guest_count:200, contact_name:"Frank North", start_time:"6:00 PM", end_time:"10:00 PM", package_name:"Standard Package", package_price:3000, booked_date:d(-12) },
  { event_name:"DFW Spring Gala",               event_type:"corporate",    event_date:d(90),   city:"DFW",  status:"planning_in_progress", ...PLANNING, guest_count:260, contact_name:"Amy Chen",     start_time:"7:00 PM", end_time:"11:00 PM", package_name:"Corporate Elite",  package_price:4800, booked_date:d(-9) },
  { event_name:"KC Charity Benefit",            event_type:"corporate",    event_date:d(80),   city:"KC",   status:"planning_in_progress", ...PLANNING, guest_count:300, contact_name:"Tom Briggs",   start_time:"6:00 PM", end_time:"10:00 PM", package_name:"Corporate Elite",  package_price:4500, booked_date:d(-7) },
  { event_name:"STL Wedding Showcase",          event_type:"wedding",      event_date:d(145),  city:"STL",  status:"planning_in_progress", ...PLANNING, guest_count:230, contact_name:"Melissa Knight",start_time:"5:00 PM", end_time:"11:00 PM", package_name:"Grand Package",    package_price:4000, booked_date:d(-11) },
  { event_name:"ATL Mitzvah Celebration",       event_type:"mitzvah",      event_date:d(115),  city:"ATL",  status:"planning_in_progress", ...PLANNING, guest_count:110, contact_name:"Gregory Vega", start_time:"5:30 PM", end_time:"10:30 PM", package_name:"Premier Package",  package_price:3200, booked_date:d(-4) },
  { event_name:"DEN Corporate Tech Summit",     event_type:"corporate",    event_date:d(95),   city:"DEN",  status:"planning_in_progress", ...PLANNING, guest_count:240, contact_name:"Cody Jensen",  start_time:"6:30 PM", end_time:"10:30 PM", package_name:"Corporate Elite",  package_price:4300, booked_date:d(-6) },
  // ── 5 BOOKED + 5 BOOKED_PENDING ──
  { linkedEmail:"demo+001@example.com", event_name:"Mitchell - Weber Wedding",      event_type:"wedding",      event_date:d(90),   city:"TUL",  status:"booked_pending", ...BOOKED_BASIC, venue_name:"The Mayo Hotel", guest_count:180, contact_name:"Sarah Mitchell", start_time:"5:00 PM", end_time:"11:00 PM", package_name:"Premier Package", package_price:3200 },
  { linkedEmail:"demo+024@example.com", event_name:"Webb - Chambers Wedding",       event_type:"wedding",      event_date:d(160),  city:"KC",   status:"booked_pending", ...BOOKED_BASIC, guest_count:185, contact_name:"Monica Webb",   start_time:"5:00 PM", end_time:"11:00 PM", package_name:"Premier Package", package_price:3400 },
  { linkedEmail:"demo+016@example.com", event_name:"Garza Quinceañera",             event_type:"quinceañera",  event_date:d(60),   city:"SAT",  status:"booked_pending", ...BOOKED_BASIC, guest_count:120, contact_name:"Maria Garza",   start_time:"6:00 PM", end_time:"11:00 PM", package_name:"Standard Package", package_price:2800 },
  { event_name:"INDY Corporate Mixer",          event_type:"corporate",    event_date:d(170),  city:"INDY", status:"booked_pending", ...BOOKED_BASIC, guest_count:150, contact_name:"Harold Dean",   start_time:"6:00 PM", end_time:"10:00 PM", package_name:"Standard Package", package_price:2700 },
  { event_name:"NASH Wedding Rehearsal Dinner", event_type:"private_party",event_date:d(140),  city:"NASH", status:"booked_pending", ...BOOKED_BASIC, guest_count:60,  contact_name:"Pearl Adams",   start_time:"6:00 PM", end_time:"9:00 PM",  package_name:"Standard Package", package_price:2000 },
  { linkedEmail:"demo+021@example.com", event_name:"Okonkwo - Lewis Wedding",       event_type:"wedding",      event_date:d(120),  city:"KC",   status:"booked", ...BOOKED_FULL, venue_name:"Longview Mansion", guest_count:200, contact_name:"Derek Okonkwo", start_time:"4:30 PM", end_time:"11:30 PM", package_name:"Premier Package", package_price:3500, booked_date:d(-10) },
  { linkedEmail:"demo+027@example.com", event_name:"Harper STL Gala",               event_type:"corporate",    event_date:d(85),   city:"STL",  status:"booked", ...BOOKED_FULL, venue_name:"Ballpark Village", guest_count:400, contact_name:"Douglas Harper", start_time:"7:00 PM", end_time:"11:00 PM", package_name:"Corporate Elite",  package_price:5500, booked_date:d(-8) },
  { linkedEmail:"demo+044@example.com", event_name:"Jensen DEN Corporate Conference",event_type:"corporate",   event_date:d(95),   city:"DEN",  status:"booked", ...BOOKED_FULL, guest_count:240, contact_name:"Cody Jensen",  start_time:"6:30 PM", end_time:"10:30 PM", package_name:"Corporate Elite",  package_price:4300, booked_date:d(-6) },
  { event_name:"ATL Raymond Corp Gala",         event_type:"corporate",    event_date:d(70),   city:"ATL",  status:"booked", ...BOOKED_FULL, guest_count:320, contact_name:"Raymond Brooks", start_time:"7:00 PM", end_time:"11:00 PM", package_name:"Corporate Elite",  package_price:6000, booked_date:d(-10) },
  { event_name:"DFW Nicole Wedding",            event_type:"wedding",      event_date:d(110),  city:"DFW",  status:"booked", ...BOOKED_FULL, guest_count:300, contact_name:"Nicole Burns",  start_time:"5:30 PM", end_time:"11:30 PM", package_name:"Grand Package",    package_price:5000, booked_date:d(-6) },
  // ── 5 CANCELLED ──
  { linkedEmail:"demo+042@example.com", event_name:"Park - Kim Wedding",            event_type:"wedding",      event_date:d(180),  city:"DEN",  status:"cancelled", readiness_score:0, guest_count:140, contact_name:"Jin Park" },
  { event_name:"TUL Birthday Bash (CANCELLED)",  event_type:"birthday",     event_date:d(50),   city:"TUL",  status:"cancelled", readiness_score:0, guest_count:80,  contact_name:"Sam Tucker" },
  { event_name:"SAT Corporate Event (CANCELLED)",event_type:"corporate",    event_date:d(35),   city:"SAT",  status:"cancelled", readiness_score:0, guest_count:100, contact_name:"Anna Webb" },
  { event_name:"HOU Anniversary Party (CANCEL)", event_type:"anniversary",  event_date:d(60),   city:"HOU",  status:"cancelled", readiness_score:0, guest_count:55,  contact_name:"Bill Ramos" },
  { event_name:"KC School Dance (CANCELLED)",    event_type:"school_dance", event_date:d(90),   city:"KC",   status:"cancelled", readiness_score:0, guest_count:280, contact_name:"Coach Miller" },
  // ── 5 POSTPONED ──
  { event_name:"STL Wedding (POSTPONED)",        event_type:"wedding",      event_date:d(210),  city:"STL",  status:"postponed", readiness_score:20, guest_count:190, contact_name:"Dana Cole", ...BOOKED_BASIC },
  { event_name:"INDY Corporate Summit (POSTPND)",event_type:"corporate",    event_date:d(240),  city:"INDY", status:"postponed", readiness_score:15, guest_count:200, contact_name:"Ed Frost",  ...BOOKED_BASIC },
  { event_name:"ATL Mitzvah (POSTPONED)",        event_type:"mitzvah",      event_date:d(260),  city:"ATL",  status:"postponed", readiness_score:10, guest_count:120, contact_name:"Lori Lane", ...BOOKED_BASIC },
  { event_name:"NASH Wedding (POSTPONED)",       event_type:"wedding",      event_date:d(290),  city:"NASH", status:"postponed", readiness_score:5,  guest_count:175, contact_name:"Don Mills",...BOOKED_BASIC },
  { event_name:"DFW Private Party (POSTPONED)",  event_type:"private_party",event_date:d(300),  city:"DFW",  status:"postponed", readiness_score:10, guest_count:65,  contact_name:"Rita Hale", ...BOOKED_BASIC },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden: admin only" }, { status: 403 });

    const svc = base44.asServiceRole;

    // ── Step 1: Create leads with seed marker ──
    const leadResults = await Promise.all(
      DEMO_LEADS.map(l => {
        const { ...lead } = l;
        return svc.entities.Lead.create({
          ...lead,
          source_detail: SEED_TAG,
          is_deleted: false,
        });
      })
    );

    // Build email → lead.id index for linking
    const leadByEmail = {};
    for (const lead of leadResults) {
      if (lead.email) leadByEmail[lead.email] = lead;
    }

    // ── Step 2: Create events with seed marker + optional lead_id ──
    const eventResults = [];
    for (const rawEvent of DEMO_EVENTS) {
      const { linkedEmail, ...eventData } = rawEvent;
      // Omit survey_flag if not set (avoid storing null strings)
      if (!eventData.survey_flag) delete eventData.survey_flag;

      const seedNotes = eventData.internal_notes
        ? `${eventData.internal_notes} [${SEED_TAG}]`
        : `[${SEED_TAG}]`;

      const payload = {
        ...eventData,
        internal_notes: seedNotes,
        is_deleted: false,
      };

      if (linkedEmail && leadByEmail[linkedEmail]) {
        payload.lead_id = leadByEmail[linkedEmail].id;
        payload.contact_email = leadByEmail[linkedEmail].email;
      }

      const created = await svc.entities.Event.create(payload);
      eventResults.push({ event: created, linkedEmail });
    }

    // ── Step 3: Back-link event_id onto lead ──
    const linkedPairs = [];
    for (const { event, linkedEmail } of eventResults) {
      if (linkedEmail && leadByEmail[linkedEmail]) {
        const lead = leadByEmail[linkedEmail];
        await svc.entities.Lead.update(lead.id, { event_id: event.id });
        linkedPairs.push({ leadId: lead.id, eventId: event.id });
      }
    }

    // Verify actual link state on created records
    const leadsWithEventId = leadResults.filter(l => l.event_id).length;
    const eventsWithLeadId = eventResults.filter(e => e.event.lead_id).length;

    // Audit: intended links vs missing/mismatched
    const intendedLinks = DEMO_EVENTS.filter(e => e.linkedEmail).length;
    const missingLeadForLinkedEmail = [];
    const mismatchedLinks = [];
    for (const rawEvent of DEMO_EVENTS) {
      if (!rawEvent.linkedEmail) continue;
      if (!leadByEmail[rawEvent.linkedEmail]) {
        missingLeadForLinkedEmail.push(rawEvent.linkedEmail);
      }
    }
    // Any event that had a linkedEmail but event.lead_id is not set = mismatch
    for (const { event, linkedEmail } of eventResults) {
      if (linkedEmail && leadByEmail[linkedEmail] && !event.lead_id) {
        mismatchedLinks.push({ eventId: event.id, linkedEmail, reason: "lead_id not set on event after create" });
      }
    }

    return Response.json({
      ok: true,
      leadsCreated: leadResults.length,
      eventsCreated: eventResults.length,
      linkedPairsCreated: linkedPairs.length,
      leadsWithEventId,
      eventsWithLeadId,
      intendedLinks,
      missingLeadForLinkedEmail,
      mismatchedLinks,
      eventStatusBreakdown: DEMO_EVENTS.reduce((acc, e) => {
        acc[e.status] = (acc[e.status] || 0) + 1;
        return acc;
      }, {}),
      citiesUsed: [...new Set(DEMO_EVENTS.map(e => e.city))],
      leadStatusBreakdown: DEMO_LEADS.reduce((acc, l) => {
        acc[l.lead_status] = (acc[l.lead_status] || 0) + 1;
        return acc;
      }, {}),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});