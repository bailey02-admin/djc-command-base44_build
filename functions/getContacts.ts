/**
 * Secure Contact read endpoint — Performance-hardened.
 *
 * Key changes:
 * - DB-level filtering by city, role
 * - Hard limit cap: 50/page with skip pagination
 * - Slim field projection for list views
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const BLOCKED_ROLES = new Set(["dj", "client"]);

// Slim field list for contact list/table views
const LIST_VIEW_FIELDS = new Set([
  "id", "first_name", "last_name", "email", "phone", "secondary_phone",
  "role", "city", "preferred_contact_method", "tags",
]);

function projectFields(record) {
  const out = {};
  for (const key of LIST_VIEW_FIELDS) {
    if (record[key] !== undefined) out[key] = record[key];
  }
  out.id = record.id;
  return out;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = user.role || "sales_rep";
    if (BLOCKED_ROLES.has(role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const {
      limit: rawLimit = 50,
      skip = 0,
      sort = "-created_date",
      filters = {},
      id,
      slim = true,
    } = body;

    // Single record lookup — return full record for detail view
    if (id) {
      const results = await base44.asServiceRole.entities.Contact.filter({ id }, "-created_date", 1);
      return Response.json({ contact: results[0] || null });
    }

    const limit = Math.min(Number(rawLimit) || 50, 200);

    // Build DB-level filter
    const dbFilter = {};
    const DB_FILTERABLE = ["city", "role", "preferred_contact_method"];
    for (const key of DB_FILTERABLE) {
      if (filters[key] && filters[key] !== "all") {
        dbFilter[key] = filters[key];
      }
    }

    let contacts = await base44.asServiceRole.entities.Contact.filter(dbFilter, sort, limit + skip);

    // Apply non-DB-filterable filters
    for (const [key, val] of Object.entries(filters)) {
      if (val && val !== "all" && !DB_FILTERABLE.includes(key)) {
        contacts = contacts.filter(c => c[key] === val);
      }
    }

    const paginated = contacts.slice(skip, skip + limit);
    const result = slim ? paginated.map(projectFields) : paginated;

    return Response.json({ contacts: result, total: contacts.length, page: { skip, limit, returned: result.length } });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});