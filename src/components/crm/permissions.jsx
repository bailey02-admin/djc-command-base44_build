/**
 * Role-based permission definitions for DJ Command CRM
 * Roles: admin, city_manager, sales_manager, sales_rep, dj, office_finalizer, finance, client
 */

export const ROLES = {
  ADMIN: "admin",
  CITY_MANAGER: "city_manager",
  SALES_MANAGER: "sales_manager",
  SALES_REP: "sales_rep",
  DJ: "dj",
  OFFICE_FINALIZER: "office_finalizer",
  FINANCE: "finance",
  CLIENT: "client",
};

export const ENTITY_PERMISSIONS = {
  Lead: {
    admin:            { read: true, create: true, update: true, delete: true },
    city_manager:     { read: true, create: true, update: true, delete: false },
    sales_manager:    { read: true, create: true, update: true, delete: false },
    sales_rep:        { read: true, create: true, update: true, delete: false },
    dj:               { read: false, create: false, update: false, delete: false },
    office_finalizer: { read: true, create: false, update: false, delete: false },
    finance:          { read: true, create: false, update: false, delete: false },
    client:           { read: false, create: false, update: false, delete: false },
  },
  Event: {
    admin:            { read: true, create: true, update: true, delete: true },
    city_manager:     { read: true, create: true, update: true, delete: false },
    sales_manager:    { read: true, create: true, update: true, delete: false },
    sales_rep:        { read: true, create: false, update: false, delete: false },
    dj:               { read: true, create: false, update: false, delete: false },
    office_finalizer: { read: true, create: false, update: true, delete: false },
    finance:          { read: true, create: false, update: false, delete: false },
    client:           { read: false, create: false, update: false, delete: false },
  },
  Payment: {
    admin:            { read: true, create: true, update: true, delete: true },
    city_manager:     { read: true, create: true, update: true, delete: false },
    sales_manager:    { read: true, create: true, update: true, delete: false },
    sales_rep:        { read: false, create: false, update: false, delete: false },
    dj:               { read: false, create: false, update: false, delete: false },
    office_finalizer: { read: false, create: false, update: false, delete: false },
    finance:          { read: true, create: true, update: true, delete: false },
    client:           { read: false, create: false, update: false, delete: false },
  },
};

export const HIDDEN_FIELDS = {
  sales_rep:        ["package_price", "discount_amount", "internal_notes", "assigned_dj"],
  dj:               ["package_price", "contact_email", "contact_phone", "lead_id"],
  office_finalizer: ["package_price"],
  client:           ["internal_notes", "assigned_dj", "package_price", "lead_id"],
};

export function can(role, entity, action) {
  const r = role || "sales_rep";
  return ENTITY_PERMISSIONS[entity]?.[r]?.[action] ?? false;
}

export function canSeeField(role, fieldName) {
  return !(HIDDEN_FIELDS[role] || []).includes(fieldName);
}

export function getNavItems(role) {
  const all = ["Dashboard", "Leads", "Events", "Contacts", "Tasks", "Venues", "Payments", "Reports", "Settings"];
  const restricted = {
    dj:               ["Dashboard", "Events"],
    client:           [],
    office_finalizer: ["Dashboard", "Events", "Tasks", "Contacts"],
    finance:          ["Dashboard", "Payments", "Reports"],
    sales_rep:        ["Dashboard", "Leads", "Events", "Contacts", "Tasks"],
    sales_manager:    ["Dashboard", "Leads", "Events", "Contacts", "Tasks", "Reports"],
    city_manager:     all,
    admin:            all,
  };
  return restricted[role] || all;
}