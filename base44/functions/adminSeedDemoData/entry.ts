/**
 * adminSeedDemoData — Contact-first architecture seed.
 *
 * Flow:
 *  1. Create 30 Contacts (canonical client records)
 *  2. Create 50 Leads — 30 linked to contacts, 20 standalone
 *  3. Create 50 Events — 30 linked (lead + contact), 20 standalone (contact only, no lead)
 *     - 8 contacts get 2 events (repeat client simulation)
 *     - 2 contacts get 3 events (high-repeat client simulation)
 *  4. Back-link leads to their events
 *
 * Returns: leadsCreated, eventsCreated, contactsCreated, contactsWithMultipleEvents,
 *          linkedPairsCreated, mismatchedLinks
 */
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
  const CONTACT_ROLES = ['couple', 'bride', 'groom', 'corporate_contact', 'parent', 'other'];

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

  // ─── 1. Create 30 Contacts (canonical client records) ─────────────────────

  console.log('Step 1: Creating 30 Contacts...');

  const contactRecords = Array.from({ length: 30 }, (_, i) => {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    const city = CITIES[i % CITIES.length];
    return {
      first_name: firstName,
      last_name: lastName,
      email: `demo.contact.${i + 1}@${TAG.toLowerCase()}.test`,
      phone: `(${300 + (i % 100)}) 555-${String(i).padStart(4, '0')}`,
      secondary_phone: i % 5 === 0 ? `(${200 + i}) 555-${String(9999 - i).padStart(4, '0')}` : undefined,
      city,
      role: CONTACT_ROLES[i % CONTACT_ROLES.length],
      preferred_contact_method: ['phone', 'email', 'text', 'any'][i % 4],
      notes: TAG,
    };
  });

  const createdContacts = await createBatch(db.Contact, contactRecords);
  console.log(`Created ${createdContacts.length} contacts`);

  // ─── 2. Create 50 Leads — 30 linked to contacts ───────────────────────────

  console.log('Step 2: Creating 50 Leads (30 contact-linked, 20 standalone)...');

  const leadRecords = Array.from({ length: 50 }, (_, i) => {
    const contact = i < 30 ? createdContacts[i] : null;
    const firstName = contact ? contact.first_name : FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = contact ? contact.last_name : LAST_NAMES[i % LAST_NAMES.length];
    const city = contact ? contact.city : CITIES[i % CITIES.length];
    const stage = PIPELINE_STAGES[i % PIPELINE_STAGES.length];
    const isBooked = stage === 'booked';

    return {
      client_first_name: firstName,
      client_last_name: lastName,
      partner_first_name: i % 3 !== 0 ? PARTNER_NAMES[i % PARTNER_NAMES.length] : undefined,
      email: contact ? contact.email : `demo.lead.${i + 1}@${TAG.toLowerCase()}.test`,
      phone: contact ? contact.phone : `(${400 + (i % 100)}) 555-${String(i).padStart(4, '0')}`,
      event_type: EVENT_TYPES[i % EVENT_TYPES.length],
      city,
      venue_name: i % 4 === 0 ? VENUE_MAP[city] : undefined,
      budget_range: BUDGET_RANGES[i % BUDGET_RANGES.length],
      guest_count: 50 + (i * 7 % 250),
      lead_source: LEAD_SOURCES[i % LEAD_SOURCES.length],
      source_detail: TAG,
      lead_status: isBooked ? 'booked_pending' : LEAD_STATUSES[i % LEAD_STATUSES.length],
      status: isBooked ? 'booked' : pick(['new', 'contacted', 'qualified', 'follow_up', 'lost']),
      pipeline_stage: stage,
      priority: PRIORITIES[i % PRIORITIES.length],
      inquiry_date: new Date(Date.now() - (i * 86400000 * 3)).toISOString(),
      event_date: isoDate(30 + i * 5),
      notes: TAG,
      contact_id: contact ? contact.id : undefined,
      is_deleted: false,
    };
  });

  const createdLeads = await createBatch(db.Lead, leadRecords);
  console.log(`Created ${createdLeads.length} leads`);

  // ─── 3. Build Event plan: repeat clients ──────────────────────────────────
  //
  //  Events 1-30:  Linked (lead + contact), one event per lead
  //  Events 31-38: Repeat clients — contacts 0-7 get a 2nd event (no lead)
  //  Events 39-40: High-repeat — contacts 8-9 get a 3rd event (no lead)
  //  Events 41-50: Standalone (contact only, no lead — direct bookings)
  //
  // Total: 50 events
  //        Contacts 0-9 each appear >=2 times → 10 contacts with multiple events

  const LINK_COUNT = 30;

  // ── 3a. 30 linked events (lead + contact) ────────────────────────────────

  console.log(`Step 3a: Creating ${LINK_COUNT} lead-linked events...`);

  const linkedEvents = [];
  const leadsUsedForLink = createdLeads.slice(0, LINK_COUNT);

  for (let i = 0; i < leadsUsedForLink.length; i++) {
    const lead = leadsUsedForLink[i];
    const contact = i < createdContacts.length ? createdContacts[i] : null;
    const city = lead.city || CITIES[i % CITIES.length];
    const status = EVENT_STATUSES[i % EVENT_STATUSES.length];

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
      contact_id: lead.contact_id || (contact ? contact.id : undefined),
      contact_name: contact
        ? `${contact.first_name} ${contact.last_name}`
        : `${lead.client_first_name} ${lead.client_last_name || ''}`.trim(),
      contact_email: contact ? contact.email : lead.email,
      contact_phone: contact ? contact.phone : lead.phone,
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

    // Back-link the lead to this event
    await withRetry(() => db.Lead.update(lead.id, { event_id: createdEvent.id }));
    await sleep(50);

    if ((i + 1) % 5 === 0) {
      console.log(`Linked ${i + 1}/${LINK_COUNT} pairs`);
      await sleep(150);
    }
  }

  // ── 3b. 10 repeat-client events (contacts 0-9 get a 2nd or 3rd event) ───

  console.log('Step 3b: Creating 10 repeat-client events...');

  // Contacts 0-7: 2nd event each (8 events)
  // Contacts 8-9: 3rd event each (2 events)
  const repeatPlan = [
    ...Array.from({ length: 8 }, (_, i) => ({ contactIdx: i, label: '2nd' })),
    ...Array.from({ length: 2 }, (_, i) => ({ contactIdx: 8 + i, label: '3rd' })),
  ];

  const repeatEvents = [];
  for (let i = 0; i < repeatPlan.length; i++) {
    const { contactIdx, label } = repeatPlan[i];
    const contact = createdContacts[contactIdx];
    const city = contact.city;
    const status = EVENT_STATUSES[(LINK_COUNT + i) % EVENT_STATUSES.length];
    const eventType = EVENT_TYPES[(LINK_COUNT + i + 2) % EVENT_TYPES.length];

    const eventPayload = {
      event_name: `Demo Repeat ${label} — ${contact.first_name} ${contact.last_name} (${TAG})`,
      event_type: eventType,
      event_date: isoDate(-60 + i * 14), // past events — repeat bookings from history
      start_time: '17:00',
      end_time: '22:00',
      city,
      venue_name: VENUE_MAP[city],
      guest_count: 80 + (i * 17 % 220),
      contact_id: contact.id,
      contact_name: `${contact.first_name} ${contact.last_name}`,
      contact_email: contact.email,
      contact_phone: contact.phone,
      status,
      package_name: pick(['Bronze', 'Silver', 'Gold', 'Platinum']),
      package_price: 2000 + (i * 200 % 2500),
      internal_notes: TAG,
      contract_signed: true,
      deposit_paid: true,
      balance_paid: status === 'completed',
      is_deleted: false,
    };

    const createdEvent = await withRetry(() => db.Event.create(eventPayload));
    repeatEvents.push(createdEvent);
    await sleep(75);
  }

  console.log(`Created ${repeatEvents.length} repeat-client events`);

  // ── 3c. 10 standalone events (direct bookings, contact only, no lead) ────

  console.log('Step 3c: Creating 10 standalone direct-booking events...');

  const standaloneEvents = [];
  for (let i = 0; i < 10; i++) {
    // Use contacts 10-19 for standalone events (each gets 1 event)
    const contactIdx = 10 + i;
    const contact = createdContacts[contactIdx];
    const city = contact.city;
    const status = EVENT_STATUSES[i % EVENT_STATUSES.length];

    const eventPayload = {
      event_name: `Demo Direct ${i + 1} — ${contact.first_name} (${TAG})`,
      event_type: EVENT_TYPES[(i + 3) % EVENT_TYPES.length],
      event_date: isoDate(90 + i * 7),
      start_time: '19:00',
      end_time: '23:30',
      city,
      venue_name: VENUE_MAP[city],
      guest_count: 60 + (i * 13 % 180),
      contact_id: contact.id,
      contact_name: `${contact.first_name} ${contact.last_name}`,
      contact_email: contact.email,
      contact_phone: contact.phone,
      status,
      package_name: pick(['Bronze', 'Silver', 'Gold', 'Platinum']),
      package_price: 1800 + (i * 180 % 2200),
      internal_notes: TAG,
      contract_signed: status !== 'booked_pending',
      deposit_paid: ['booked', 'planning_in_progress', 'finalized', 'completed'].includes(status),
      balance_paid: status === 'completed',
      is_deleted: false,
    };

    const createdEvent = await withRetry(() => db.Event.create(eventPayload));
    standaloneEvents.push(createdEvent);
    await sleep(75);
  }

  console.log(`Created ${standaloneEvents.length} standalone events`);

  // ─── 4. Verification ──────────────────────────────────────────────────────

  const allCreatedEvents = [...linkedEvents, ...repeatEvents, ...standaloneEvents];

  // Re-fetch linked leads to confirm event_id was set
  const updatedLinkedLeads = await Promise.all(
    leadsUsedForLink.map(l => withRetry(() => db.Lead.get(l.id)).catch(() => null))
  );
  const leadsWithEventId = updatedLinkedLeads.filter(l => l && l.event_id).length;
  const mismatchedLinks = updatedLinkedLeads.filter((lead, i) =>
    lead && lead.event_id && linkedEvents[i] && lead.event_id !== linkedEvents[i].id
  ).length;

  // Count contacts with multiple events
  const contactEventCount = {};
  for (const e of allCreatedEvents) {
    if (e.contact_id) {
      contactEventCount[e.contact_id] = (contactEventCount[e.contact_id] || 0) + 1;
    }
  }
  const contactsWithMultipleEvents = Object.values(contactEventCount).filter(n => n > 1).length;
  const eventsWithContactId = allCreatedEvents.filter(e => e.contact_id).length;

  return Response.json({
    ok: true,
    contactsCreated: createdContacts.length,
    leadsCreated: createdLeads.length,
    eventsCreated: allCreatedEvents.length,
    eventsBreakdown: {
      leadLinked: linkedEvents.length,
      repeatClient: repeatEvents.length,
      directBooking: standaloneEvents.length,
    },
    contactsWithMultipleEvents,
    eventsWithContactId,
    leadsWithContactId: createdLeads.filter(l => l.contact_id).length,
    leadsWithEventId,
    mismatchedLinks,
  });
});