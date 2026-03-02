/**
 * crm/accessControl.js — Centralized event access control for all backend functions.
 *
 * Exports:
 *   canAccessEvent(user, event) → boolean
 *   redactEvent(record, role)   → redacted record
 *   safeContactSummary(contact, role) → role-scoped contact fields (or null)
 */

// ─── Role → hidden event fields ──────────────────────────────────────────────
const EVENT_HIDDEN_FIELDS = {
  dj:               ["package_price", "contact_email", "contact_phone", "lead_id", "internal_notes"],
  sales_rep:        ["package_price", "internal_notes"],
  office_finalizer: ["package_price"],
  finance:          ["internal_notes"],
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
 * canAccessEvent — returns true if the user can read/act on this event.
 *
 * Rules:
 *   admin / sales_manager / sales_rep / finance → always allowed
 *   city_manager / office_finalizer → allowed only if event.city === user.city (when user.city set)
 *   dj → allowed only if event.assigned_dj === user.email
 *   client → must be handled separately in the endpoint
 */
export function canAccessEvent(user, event) {
  const role = user.role || "sales_rep";

  switch (role) {
    case "admin":
    case "sales_manager":
    case "sales_rep":
    case "finance":
      return true;

    case "city_manager":
    case "office_finalizer":
      // If user.city is not set, allow (degraded-mode guard)
      if (!user.city) return true;
      return event.city === user.city;

    case "dj":
      return event.assigned_dj === user.email;

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
  if (!hidden || hidden.length === 0) return record;
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