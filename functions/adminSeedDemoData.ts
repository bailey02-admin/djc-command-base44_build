import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  const db = base44.asServiceRole.entities;

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  async function withRetry(fn, maxAttempts = 5, baseDelayMs = 250) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const is429 = err?.status === 429 || err?.statusCode === 429 ||
          (err?.message && err.message.includes('429')) ||
          (err?.message && err.message.toLowerCase().includes('rate limit'));
        if (is429 && attempt < maxAttempts) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1);
          console.log(`Rate limited. Retry ${attempt}/${maxAttempts} after ${delay}ms`);
          await sleep(delay);
        } else {
          throw err;
        }
      }
    }
  }

  async function createBatch(entity, records, batchSize = 5, batchDelayMs = 150) {
    const created = [];
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(r => withRetry(() => entity.create(r)))
      );
      created.push(...results);
      if (i + batchSize < records.length) await sleep(batchDelayMs);
    }
    return created;
  }

  async function updateSerial(entity, updates, delayMs = 50) {
    const results = [];
    for (const { id, data } of updates) {
      const result = await withRetry(() => entity.update(id, data));
      results.push(result);
      await sleep(delayMs);
    }
    return results;
  }

  // ─── Data pools ───────────────────────────────────────────────────────────

  const CITIES = ['TUL', 'DFW', 'HOU', 'SAT', 'KC', 'STL', 'INDY', 'NASH', 'DEN', 'ATL'];
  const EVENT_TYPES = ['wedding', 'corporate', 'school_dance', 'private_party', 'birthday', 'anniversary', 'mitzvah', 'quinceanera', 'holiday_party', 'other'];

  const LEAD_STATUSES = ['web_lead', 'email_only', 'hot_lead', 'appointment_set', 'x_dated', 'never_booked', 'lost_sale', 'booked_pending'];
  const PIPELINE_STAGES = ['new_inquiry', 'contacted', 'qualified', 'consultation_scheduled', 'quote_sent', 'follow_up', 'booked', 'lost'];
  const LEAD_SOURCES = ['website', 'google_ads', 'meta_ads', 'referral', 'the_knot', 'weddingwire', 'phone_call'];
  const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
  const BUDGET_RANGES = ['1000_1500', '1500_2000', '2000_3000', '3000_plus', 'not_specified'];

  const EVENT_STATUSES = ['booked_pending', 'booked', 'planning_in_progress', 'finalized', 'completed', 'cancelled'];

  const FIRST_NAMES = ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason', 'Isabella', 'Logan',
    'Mia', 'Lucas', 'Charlotte', 'Jackson', 'Amelia', 'Aiden', 'Harper', 'Elijah', 'Evelyn', 'James',
    'Abigail', 'Benjamin', 'Emily', 'Sebastian', 'Ella', 'Owen', 'Elizabeth', 'Carter', 'Camila', 'Wyatt'];
  const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Martinez', 'Wilson',
    'Anderson', 'Taylor', 'Thomas', 'Hernandez', 'Moore', 'Martin', 'Jackson', 'Thompson', 'White', 'Lee'];
  const PARTNER_NAMES = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Riley', 'Cameron', 'Avery', 'Quinn', 'Peyton', 'Drew'];

  const VENUE_MAP = {
    TUL: 'River Spirit Casino', DFW: 'Gaylord Texan', HOU: 'Houston Country Club',
    SAT: 'Pearl Stable', KC: 'Arrowhead Stadium Club', STL: 'Chase Park Plaza',
    INDY: 'Crowne Plaza Union Station', NASH: 'Noelle Nashville', DEN: 'Brown Palace', ATL: 'Fox Theatre'
  };

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const isoDate = (daysOffset) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString().split('T')[0];
  };

  const TAG = 'DEMO_SEED_v1';

  // ─── Build leads ──────────────────────────────────────────────────────────

  const leadRecords = Array.from({ length: 50 }, (_, i) => {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    const city = pick(CITIES);
    const stage = PIPELINE_STAGES[i % PIPELINE_STAGES.length];
    const isBooked = stage === 'booked';
    return {
      client_first_name: firstName,
      client_last_name: lastName,
      partner_first_name: i % 3 !== 0 ? pick(PARTNER_NAMES) : undefined,
      email: `demo.lead.${i + 1}@${TAG.toLowerCase()}.test`,
      phone: `(${400 + (i % 100)}) 555-${String(i).padStart(4, '0')}`,
      event_type: pick(EVENT_TYPES),
      city,
      venue_name: i % 4 === 0 ? VENUE_MAP[city] : undefined,
      budget_range: pick(BUDGET_RANGES),
      guest_count: 50 + (i * 7 % 250),
      lead_source: pick(LEAD_SOURCES),
      lead_status: isBooked ? 'booked_pending' : pick(LEAD_STATUSES),
      status: isBooked ? 'booked' : pick(['new', 'contacted', 'qualified', 'follow_up', 'lost']),
      pipeline_stage: stage,
      priority: pick(PRIORITIES),
      inquiry_date: new Date(Date.now() - (i * 86400000 * 3)).toISOString(),
      event_date: isoDate(30 + i * 5),
      notes: TAG,
      is_deleted: false,
    };
  });

  // ─── Build events ─────────────────────────────────────────────────────────

  const eventRecords = Array.from({ length: 50 }, (_, i) => {
    const city = pick(CITIES);
    const status = EVENT_STATUSES[i % EVENT_STATUSES.length];
    const eventDate = isoDate(-60 + i * 5);
    return {
      event_name: `Demo Event ${i + 1} (${TAG})`,
      event_type: pick(EVENT_TYPES),
      event_date: eventDate,
      start_time: '18:00',
      end_time: '23:00',
      city,
      venue_name: VENUE_MAP[city],
      guest_count: 75 + (i * 11 % 200),
      contact_name: `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[i % LAST_NAMES.length]}`,
      contact_email: `demo.event.${i + 1}@${TAG.toLowerCase()}.test`,
      status,
      package_name: pick(['Bronze', 'Silver', 'Gold', 'Platinum']),
      package_price: 1500 + (i * 150 % 3000),
      internal_notes: TAG,
      contract_signed: status !== 'booked_pending',
      deposit_paid: ['booked', 'planning_in_progress', 'finalized', 'completed'].includes(status),
      balance_paid: status === 'completed',
      is_deleted: false,
    };
  });

  // ─── Seed leads ───────────────────────────────────────────────────────────

  console.log('Seeding 50 leads in batches of 5...');
  const createdLeads = await createBatch(db.Lead, leadRecords);
  console.log(`Created ${createdLeads.length} leads`);

  // ─── Seed events ──────────────────────────────────────────────────────────

  console.log('Seeding 50 events in batches of 5...');
  const createdEvents = await createBatch(db.Event, eventRecords);
  console.log(`Created ${createdEvents.length} events`);

  // ─── Bidirectional linking (first 30 pairs) ───────────────────────────────

  console.log('Linking 30 lead/event pairs serially...');
  const LINK_COUNT = Math.min(30, createdLeads.length, createdEvents.length);

  const leadUpdates = createdLeads.slice(0, LINK_COUNT).map((lead, i) => ({
    id: lead.id,
    data: { event_id: createdEvents[i].id },
  }));

  const eventUpdates = createdEvents.slice(0, LINK_COUNT).map((event, i) => ({
    id: event.id,
    data: {
      lead_id: createdLeads[i].id,
      contact_email: createdLeads[i].email,
      contact_name: `${createdLeads[i].client_first_name} ${createdLeads[i].client_last_name || ''}`.trim(),
    },
  }));

  await updateSerial(db.Lead, leadUpdates);
  await updateSerial(db.Event, eventUpdates);

  // ─── Verification ─────────────────────────────────────────────────────────

  const linkedLeads = createdLeads.slice(0, LINK_COUNT);
  const linkedEvents = createdEvents.slice(0, LINK_COUNT);

  const leadsWithEventId = linkedLeads.filter(l => l.event_id).length;
  const eventsWithLeadId = linkedEvents.filter(e => e.lead_id).length;

  const missingLeadForLinkedEmail = linkedEvents.filter(e => {
    const matchingLead = createdLeads.find(l => l.id === e.lead_id);
    return !matchingLead;
  }).length;

  const mismatchedLinks = linkedLeads.filter((lead, i) => {
    return lead.event_id && lead.event_id !== createdEvents[i].id;
  }).length;

  return Response.json({
    ok: true,
    leadsCreated: createdLeads.length,
    eventsCreated: createdEvents.length,
    linkedPairsCreated: LINK_COUNT,
    leadsWithEventId,
    eventsWithLeadId,
    missingLeadForLinkedEmail,
    mismatchedLinks,
  });
});