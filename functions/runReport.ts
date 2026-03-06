import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── Allowlists ──────────────────────────────────────────────────────────────
const COLUMNS = {
  events: [
    { key: 'event_date',      label: 'Event Date' },
    { key: 'start_time',      label: 'Start Time' },
    { key: 'city',            label: 'City' },
    { key: 'status',          label: 'Status' },
    { key: 'event_name',      label: 'Event Name' },
    { key: 'event_type',      label: 'Event Type' },
    { key: 'contact_name',    label: 'Contact Name' },
    { key: 'contact_email',   label: 'Contact Email' },
    { key: 'venue_name',      label: 'Venue' },
    { key: 'assigned_dj',     label: 'Assigned DJ' },
    { key: 'assigned_mc',     label: 'Assigned MC' },
    { key: 'package_name',    label: 'Package' },
    { key: 'package_price',   label: 'Package Price' },
    { key: 'guest_count',     label: 'Guest Count' },
    { key: 'planning_complete',  label: 'Planning Complete' },
    { key: 'contract_signed',    label: 'Contract Signed' },
    { key: 'deposit_paid',       label: 'Deposit Paid' },
    { key: 'balance_paid',       label: 'Balance Paid' },
    { key: 'readiness_score',    label: 'Readiness Score' },
  ],
  leads: [
    { key: 'created_date',    label: 'Created Date' },
    { key: 'city',            label: 'City' },
    { key: 'lead_status',     label: 'Lead Status' },
    { key: 'status',          label: 'CRM Status' },
    { key: 'pipeline_stage',  label: 'Pipeline Stage' },
    { key: 'client_first_name', label: 'First Name' },
    { key: 'client_last_name',  label: 'Last Name' },
    { key: 'email',           label: 'Email' },
    { key: 'phone',           label: 'Phone' },
    { key: 'event_type',      label: 'Event Type' },
    { key: 'event_date',      label: 'Event Date' },
    { key: 'lead_source',     label: 'Lead Source' },
    { key: 'assigned_rep',    label: 'Assigned Rep' },
    { key: 'quote_amount',    label: 'Quote Amount' },
    { key: 'lost_reason',     label: 'Lost Reason' },
    { key: 'priority',        label: 'Priority' },
  ],
  payments: [
    { key: 'created_date',       label: 'Date Created' },
    { key: 'paid_date',          label: 'Date Paid' },
    { key: 'due_date',           label: 'Due Date' },
    { key: 'amount',             label: 'Amount' },
    { key: 'payment_type',       label: 'Payment Type' },
    { key: 'payment_method',     label: 'Method' },
    { key: 'status',             label: 'Status' },
    { key: 'contact_name',       label: 'Contact' },
    { key: 'transaction_reference', label: 'Reference' },
    { key: 'notes',              label: 'Notes' },
  ],
};

const COLUMN_KEYS = {
  events:   new Set(COLUMNS.events.map(c => c.key)),
  leads:    new Set(COLUMNS.leads.map(c => c.key)),
  payments: new Set(COLUMNS.payments.map(c => c.key)),
};

const ENTITY_MAP = {
  events:   'Event',
  leads:    'Lead',
  payments: 'Payment',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function pickColumns(row, keys) {
  const out = {};
  for (const k of keys) out[k] = row[k] ?? null;
  return out;
}

function applyFilters(rows, filters, entity_key) {
  return rows.filter(row => {
    if (filters.city && row.city !== filters.city) return false;
    if (filters.status && row.status !== filters.status) return false;
    if (filters.lead_status && row.lead_status !== filters.lead_status) return false;
    if (filters.event_type && row.event_type !== filters.event_type) return false;
    if (filters.payment_type && row.payment_type !== filters.payment_type) return false;

    // Date range filtering
    const dateField = entity_key === 'events' ? 'event_date'
                    : entity_key === 'leads'   ? 'created_date'
                    : 'paid_date';
    const rowDate = row[dateField];
    if (filters.date_from && rowDate && rowDate < filters.date_from) return false;
    if (filters.date_to   && rowDate && rowDate > filters.date_to)   return false;

    return true;
  });
}

function sortRows(rows, sort) {
  if (!sort) return rows;
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  return [...rows].sort((a, b) => {
    const av = a[field] ?? '';
    const bv = b[field] ?? '';
    if (av < bv) return desc ? 1 : -1;
    if (av > bv) return desc ? -1 : 1;
    return 0;
  });
}

// ── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email.toLowerCase() });
    const profile = profiles?.[0];
    if (!profile || profile.is_active === false) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    let { report_definition_id, entity_key, columns, filters, sort, limit } = body;

    // Load saved definition if id provided
    if (report_definition_id) {
      const defs = await base44.asServiceRole.entities.ReportDefinition.filter({ id: report_definition_id });
      const def = defs?.[0];
      if (!def) return Response.json({ error: 'Report not found' }, { status: 404 });
      const canRun = def.is_shared || def.created_by_staff_profile_id === profile.id || profile.custom_role === 'admin';
      if (!canRun) return Response.json({ error: 'Forbidden' }, { status: 403 });
      entity_key = def.entity_key;
      columns = def.columns;
      filters = def.filters || {};
      sort = def.sort;
      limit = def.limit || 500;
    }

    if (!entity_key || !ENTITY_MAP[entity_key]) {
      return Response.json({ error: 'Invalid entity_key' }, { status: 400 });
    }
    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      return Response.json({ error: 'At least one column required' }, { status: 400 });
    }

    // Sanitize columns to allowlist only
    const safeColumns = columns.filter(c => COLUMN_KEYS[entity_key].has(c));
    if (safeColumns.length === 0) {
      return Response.json({ error: 'No valid columns specified' }, { status: 400 });
    }

    // ── RBAC / city scoping ──────────────────────────────────────────────────
    const role = profile.custom_role;
    const isAdmin = role === 'admin';
    const staffCities = profile.cities || [];
    if (profile.default_city && !staffCities.includes(profile.default_city)) {
      staffCities.push(profile.default_city);
    }

    // DJ: can only run events report, limited to their assigned events
    if (role === 'dj' && entity_key !== 'events') {
      return Response.json({ error: 'DJs can only run event reports' }, { status: 403 });
    }

    // Finance: payments only + events readonly
    // (no additional field gating needed for v1 allowlist)

    // Fetch raw data
    const entityName = ENTITY_MAP[entity_key];
    let rows = await base44.asServiceRole.entities[entityName].list('-created_date', 2000);

    // Exclude soft-deleted
    rows = rows.filter(r => !r.is_deleted);

    // City scoping for non-admin
    if (!isAdmin && staffCities.length > 0) {
      if (entity_key === 'events' || entity_key === 'leads') {
        rows = rows.filter(r => staffCities.includes(r.city));
      }
    }

    // DJ scoping: only their assigned events
    if (role === 'dj') {
      const djEmail = user.email.toLowerCase();
      rows = rows.filter(r => {
        const djField = (r.assigned_dj || '').toLowerCase();
        const djId = (r.assigned_dj_id || '').toLowerCase();
        return djField.includes(djEmail) || djId === profile.id;
      });
    }

    // Apply user-specified filters
    if (filters && Object.keys(filters).length > 0) {
      // Enforce: non-admin city filter must still be within allowed cities
      if (!isAdmin && filters.city && staffCities.length > 0 && !staffCities.includes(filters.city)) {
        return Response.json({ error: 'Forbidden: city out of scope' }, { status: 403 });
      }
      rows = applyFilters(rows, filters, entity_key);
    }

    // Sort
    rows = sortRows(rows, sort || '-created_date');

    // Limit
    const cap = Math.min(limit || 500, 2000);
    rows = rows.slice(0, cap);

    // Project to requested columns only
    const projected = rows.map(r => pickColumns(r, safeColumns));

    // Build column metadata (preserving order)
    const colMap = Object.fromEntries(COLUMNS[entity_key].map(c => [c.key, c.label]));
    const columnMeta = safeColumns.map(k => ({ key: k, label: colMap[k] || k }));

    return Response.json({
      rows: projected,
      columns: columnMeta,
      row_count: projected.length,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});