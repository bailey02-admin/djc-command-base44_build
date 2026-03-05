/**
 * crm/accessControl.js — Centralized event access control for all backend functions.
 *
 * Exports:
 *   resolveRole(base44, user)       → { role, cities, isActive, profile }
 *   canAccessEvent(user, event, resolvedRole) → boolean
 *   redactEvent(record, role)       → redacted record
 *   safeContactSummary(contact, role) → role-scoped contact fields (or null)
 *
 * Role resolution order:
 *   1. StaffProfile.custom_role (source of truth)
 *   2. Fallback to user.role from platform (migration safety for existing admins)
 *
 * is_active=false → callers should return 403 after calling resolveRole.
 */

// ─── DJ finance/contact fields to hide ───────────────────────────────────────
const DJ_HIDDEN = [
  "contact_email", "contact_phone",
  "package_price",
  "survey_score", "survey_avg", "survey_flag", "survey_comments",
  "lead_id", "internal_notes",
];

const EVENT_HIDDEN_FIELDS = {
  dj:               DJ_HIDDEN,
  office_finalizer: ["package_price", "internal_notes", "survey_score", "survey_avg", "survey_flag", "survey_comments"],
  sales_rep:        ["package_price"],
  finance:          ["internal_notes"],
};

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
  client:  null,
};

/**
 * resolveRole — looks up the caller's StaffProfile by email.
 * Falls back to user.role if no profile found (migration safety).
 * Returns { role, cities, isActive, profile }.
 */
export async function resolveRole(base44, user) {
  if (!user?.email) return { role: 'sales_rep', cities: [], isActive: true, profile: null };

  try {
    const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email });
    const profile = profiles?.[0];

    if (profile) {
      return {
        role: profile.custom_role || 'sales_rep',
        cities: profile.cities || [],
        isActive: profile.is_active !== false,
        profile,
      };
    }
  } catch (_) {
    // StaffProfile entity may not exist yet during initial migration
  }

  // Fallback: use platform user.role so existing admins aren't locked out
  return {
    role: user.role || 'sales_rep',
    cities: [],
    isActive: true,
    profile: null,
  };
}

/**
 * canAccessEvent — returns true if the user may read/act on this event.
 */
export function canAccessEvent(user, event, resolvedRole) {
  const role = resolvedRole || user?.role || 'sales_rep';

  switch (role) {
    case "admin":
    case "sales_manager":
    case "sales_rep":
    case "city_manager":
    case "office_finalizer":
    case "finance":
      return true;

    case "dj":
      return event.assigned_dj_id === user.id || event.assigned_dj === user.email ||
             event.assigned_mc_id === user.id || event.assigned_mc === user.email;

    default:
      return false;
  }
}

/**
 * redactEvent — strips hidden fields from an event record based on role.
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
 */
export function safeContactSummary(contact, role) {
  if (!contact) return null;
  const allowed = CONTACT_FIELDS_BY_ROLE[role || "sales_rep"];
  if (!allowed) return null;
  const out = {};
  for (const f of allowed) {
    if (contact[f] !== undefined) out[f] = contact[f];
  }
  return out;
}