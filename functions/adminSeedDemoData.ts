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
          (err?.message && (err.message.includes('429') || err.message.toLowerCase().includes('rate limit')));
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

  // Create records in batches of 5, 150ms between batches
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

  // ─── 1. Create 50 leads ───────────────────────────────────────────────────

  const leadRecords = Array.from({ length: 50 }, (_, i) => {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    const city = CITIES[i % CITIES.length];
    const stage = PIPELINE_STAGES[i % PIPELINE_STAGES.length];
    const isBooked = stage === 'booked';
    return {
      client_first_name: firstName,
      client_last_name: lastName,
      partner_first_name: i % 3 !== 0 ? PARTNER_NAMES[i % PARTNER_NAMES.length] : undefined,
      email: `demo.lead.${i + 1}@${TAG.toLowerCase()}.test`,
      phone: `(${400 + (i % 100)}) 555-${String(i).padStart(4, '0')}`,
      event_type: EVENT_TYPES[i % EVENT_TYPES.length],
      city,
      venue_name: i % 4 === 0 ? VENUE_MAP[city] : undefined,
      budget_range: BUDGET_RANGES[i % BUDGET_RANGES.length],
      guest_count: 50 + (i * 7 % 250),
      lead_source: LEAD_SOURCES[i % LEAD_SOURCES.length],
      source_detail: TAG, // used by reset to identify demo leads
      lead_status: isBooked ? 'booked_pending' : LEAD_STATUSES[i % LEAD_STATUSES.length],
      status: isBooked ? 'booked' : pick(['new', 'contacted', 'qualified', 'follow_up', 'lost']),
      pipeline_stage: stage,
      priority: PRIORITIES[i % PRIORITIES.length],
      inquiry_date: new Date(Date.now() - (i * 86400000 * 3)).toISOString(),
      event_date: isoDate(30 + i * 5),
      notes: TAG,
      is_deleted: false,
    };
  });

  console.log('Seeding 50 leads in batches of 5...');
  const createdLeads = await createBatch(db.Lead, leadRecords);
  console.log(`Created ${createdLeads.length} leads`);

  // ─── 2. Create 20 unlinked events (events 31-50) ─────────────────────────

  const LINK_COUNT = 30;
  const UNLINKED_COUNT = 20;

  const unlinkedEventRecords = Array.from({ length: UNLINKED_COUNT }, (_, i) => {
    const city = CITIES[i % CITIES.length];
    const status = EVENT_STATUSES[i % EVENT_STATUSES.length];
    return {
      event_name: `Demo Event ${LINK_COUNT + i + 1} (${TAG})`,
      event_type: EVENT_TYPES[i % EVENT_TYPES.length],
      event_date: isoDate(-30 + i * 3),
      start_time: '18:00',
      end_time: '23:00',
      city,
      venue_name: VENUE_MAP[city],
      guest_count: 75 + (i * 11 % 200),
      contact_name: `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[i % LAST_NAMES.length]}`,
      contact_email: `demo.unlinked.${i + 1}@${TAG.toLowerCase()}.test`,
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

  console.log('Seeding 20 unlinked events in batches of 5...');
  const unlinkedEvents = await createBatch(db.Event, unlinkedEventRecords);
  console.log(`Created ${unlinkedEvents.length} unlinked events`);

  // ─── 3. Create 30 linked events using actual lead data, then back-link ────

  console.log(`Creating ${LINK_COUNT} linked events and back-linking leads serially...`);

  const linkedEvents = [];
  const leadsUsedForLink = createdLeads.slice(0, LINK_COUNT);

  for (let i = 0; i < leadsUsedForLink.length; i++) {
    const lead = leadsUsedForLink[i];
    const city = lead.city || CITIES[i % CITIES.length];
    const status = EVENT_STATUSES[i % EVENT_STATUSES.length];

    // Create the event with lead_id + contact info stamped from the real lead
    const eventPayload = {
      event_name: `Demo Event ${i + 1} (${TAG})`,
      event_type: lead.event_type || EVENT_TYPES[i % EVENT_TYPES.length],
      event_date: lead.event_date || isoDate(30 + i * 5),
      start_time: '18:00',
      end_time: '23:00',
      city,
      venue_name: VENUE_MAP[city] || lead.venue_name,
      guest_count: lead.guest_count || (75 + i * 11 % 200),
      lead_id: lead.id,
      contact_name: `${lead.client_first_name} ${lead.client_last_name || ''}`.trim(),
      contact_email: lead.email,
      status,
      package_name: pick(['Bronze', 'Silver', 'Gold', 'Platinum']),
      package_price: 1500 + (i * 150 % 3000),
      internal_notes: TAG,
      contract_signed: status !== 'booked_pending',
      deposit_paid: ['booked', 'planning_in_progress', 'finalized', 'completed'].includes(status),
      balance_paid: status === 'completed',
      is_deleted: false,
    };

    const createdEvent = await withRetry(() => db.Event.create(eventPayload));
    linkedEvents.push(createdEvent);
    await sleep(50);

    // Immediately back-link the lead to this event
    await withRetry(() => db.Lead.update(lead.id, { event_id: createdEvent.id }));
    await sleep(50);

    if ((i + 1) % 5 === 0) {
      console.log(`Linked ${i + 1}/${LINK_COUNT} pairs`);
      await sleep(150);
    }
  }

  console.log(`Finished linking ${linkedEvents.length} event/lead pairs`);

  // ─── 4. Verification from actual created records ──────────────────────────

  const allCreatedEvents = [...linkedEvents, ...unlinkedEvents];

  // Re-fetch linked leads to get updated event_id values
  const updatedLinkedLeads = await Promise.all(
    leadsUsedForLink.map(l => withRetry(() => db.Lead.get(l.id)))
  );

  const leadsWithEventId = updatedLinkedLeads.filter(l => l && l.event_id).length;
  const eventsWithLeadId = linkedEvents.filter(e => e && e.lead_id).length;

  // missingLeadForLinkedEmail: events where the lead_id doesn't match a created lead
  const createdLeadIds = new Set(createdLeads.map(l => l.id));
  const missingLeadForLinkedEmail = linkedEvents.filter(e => e.lead_id && !createdLeadIds.has(e.lead_id)).length;

  // mismatchedLinks: linked leads whose event_id doesn't point to the expected event
  const mismatchedLinks = updatedLinkedLeads.filter((lead, i) => {
    return lead && lead.event_id && linkedEvents[i] && lead.event_id !== linkedEvents[i].id;
  }).length;

  return Response.json({
    ok: true,
    leadsCreated: createdLeads.length,
    eventsCreated: allCreatedEvents.length,
    linkedPairsCreated: linkedEvents.length,
    leadsWithEventId,
    eventsWithLeadId,
    missingLeadForLinkedEmail,
    mismatchedLinks,
  });
});