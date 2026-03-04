/**
 * crm/accessControl.js — Centralized event access control for all backend functions.
 *
 * Exports:
 *   canAccessEvent(user, event) → boolean
 *   redactEvent(record, role)   → redacted record
 *   safeContactSummary(contact, role) → role-scoped contact fields (or null)
 *
 * Access Policy (authoritative):
 *   admin, sales_manager, sales_rep, city_manager, office_finalizer, finance → global (all events)
 *   dj → only events where event.assigned_dj === user.email
 *   client → handled separately in each endpoint (returns false here)
 */

// ─── DJ finance/contact fields to hide (from Event schema) ───────────────────
// Finance keys derived from entities/Event.json: package_price, survey_score,
// survey_avg, survey_flag, survey_comments, booked_date (financial milestone),
// plus any balance/fee fields.
const DJ_HIDDEN = [
  // Contact PII
  "contact_email", "contact_phone",
  // All finance / pricing fields present in Event schema
  "package_price",
  // Survey / performance data (finance-adjacent, not for DJs)
  "survey_score", "survey_avg", "survey_flag", "survey_comments",
  // Internal
  "lead_id", "internal_notes",
];

// ─── Role → hidden event fields ──────────────────────────────────────────────
const EVENT_HIDDEN_FIELDS = {
  dj:               DJ_HIDDEN,
  // office_finalizer: hide finance pricing, internal notes, survey data
  office_finalizer: ["package_price", "internal_notes", "survey_score", "survey_avg", "survey_flag", "survey_comments"],
  // sales_rep: hide pricing only — internal_notes are visible and writable
  sales_rep:        ["package_price"],
  // finance: hide internal notes (they see all finance fields)
  finance:          ["internal_notes"],
  // city_manager, sales_manager, admin: no field redaction
};

// ─── Role → allowed contact fields ───────────────────────────────────────────
const CONTACT_FIELDS_BY_ROLE = {
  admin: [
    "id", "first_name", "last_name", "email", "phone", "secondary_phone",
    "preferred_contact_method", "city", "notes",
  ],
  sales_manager: [
    "id", "first_name", "last_name", "email", "phone", "secondary_phone",
    "preferred_contact_method",
  ],
  sales_rep: [
    "id", "first_name", "last_name", "email", "phone", "secondary_phone",
    "preferred_contact_method",
  ],
  city_manager: [
    "id", "first_name", "last_name", "email", "phone", "secondary_phone",
    "preferred_contact_method",
  ],
  office_finalizer: [
    "id", "first_name", "last_name", "email", "phone", "secondary_phone",
    "preferred_contact_method",
  ],
  finance: ["id", "first_name", "last_name"],
  dj:      ["id", "first_name", "last_name", "preferred_contact_method"],
  client:  null, // clients never receive contact summary
};

/**
 * canAccessEvent — returns true if the user may read/act on this event.
 *
 * Global roles (all events visible):
 *   admin, sales_manager, sales_rep, city_manager, office_finalizer, finance
 *
 * Scoped roles:
 *   dj → only if event.assigned_dj === user.email
 *
 * Client handled separately in endpoints — returns false here.
 */
export function canAccessEvent(user, event) {
  const role = user.role || "sales_rep";

  switch (role) {
    case "admin":
    case "sales_manager":
    case "sales_rep":
    case "city_manager":
    case "office_finalizer":
    case "finance":
      return true;

    case "dj":
      // Match by ID (preferred) or email fallback for legacy records
      return event.assigned_dj_id === user.id || event.assigned_dj === user.email ||
             event.assigned_mc_id === user.id || event.assigned_mc === user.email;

    default:
      return false;
  }
}

/**
 * redactEvent — strips hidden fields from an event record based on role.
 * Returns a shallow copy with restricted fields removed.
 */
export function redactEvent(record, role) {
  const hidden = EVENT_HIDDEN_FIELDS[role];
  if (!hidden || hidden.length === 0) return { ...record };
  const out = { ...record };
  for (const f of hidden) delete out[f];
  return out;
}

/**
 * safeContactSummary — returns only the fields allowed for the given role.
 * Returns null for client role or if contact is falsy.
 */
export function safeContactSummary(contact, role) {
  if (!contact) return null;
  const allowed = CONTACT_FIELDS_BY_ROLE[role || "sales_rep"];
  if (!allowed) return null; // client role
  const out = {};
  for (const f of allowed) {
    if (contact[f] !== undefined) out[f] = contact[f];
  }
  return out;
}