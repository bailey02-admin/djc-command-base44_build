/**
 * saveTableViewConfig — create or update a TableViewConfig for the current user.
 * Validates column keys against the ALLOWED_EVENTS_COLUMNS registry.
 * If is_default=true, unsets other defaults for same user+entity_key.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ─── Column registry ────────────────────────────────────────────────────────
const ALLOWED_EVENTS_COLUMNS = [
  { key: "event_date",      default_label: "Date",           value_type: "date" },
  { key: "status_city",     default_label: "Status – City",  value_type: "badge" },
  { key: "contact_name",    default_label: "Client",         value_type: "text" },
  { key: "event_name",      default_label: "Event",          value_type: "text" },
  { key: "event_type",      default_label: "Event Type",     value_type: "badge" },
  { key: "assigned_dj",     default_label: "DJ",             value_type: "text" },
  { key: "assigned_mc",     default_label: "MC",             value_type: "text" },
  { key: "assigned_finalizer", default_label: "Finalizer",   value_type: "text" },
  { key: "staff_combined",  default_label: "Staff",          value_type: "text" },
  { key: "venue_name",      default_label: "Venue",          value_type: "text" },
  { key: "setup_time",      default_label: "Setup",          value_type: "text" },
  { key: "start_time",      default_label: "Start",          value_type: "text" },
  { key: "end_time",        default_label: "End",            value_type: "text" },
  { key: "city",            default_label: "City",           value_type: "text" },
  { key: "lead_source",     default_label: "Source",         value_type: "text" },
  { key: "package_name",    default_label: "Package",        value_type: "text" },
  { key: "total_fee",       default_label: "Total Fee",      value_type: "money", role_min: "finance" },
  { key: "balance_due",     default_label: "Balance Due",    value_type: "money", role_min: "finance" },
  { key: "readiness_score", default_label: "Readiness",      value_type: "text" },
  { key: "view_action",     default_label: "View",           value_type: "action" },
];

const ALLOWED_KEYS = new Set(ALLOWED_EVENTS_COLUMNS.map(c => c.key));

const FINANCE_KEYS = new Set(
  ALLOWED_EVENTS_COLUMNS.filter(c => c.role_min === "finance").map(c => c.key)
);

const FINANCE_ROLES = new Set(["admin", "city_manager", "sales_manager", "finance"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { id, entity_key = "events", name, columns = [], sort, is_default = false } = body;

    if (!name) return Response.json({ error: "name is required" }, { status: 400 });

    const role = user.role || "sales_rep";
    const warnings = [];

    // Validate + sanitize columns
    const sanitized = [];
    for (const col of columns) {
      if (!ALLOWED_KEYS.has(col.key)) {
        warnings.push(`Unknown column key: ${col.key} — dropped`);
        continue;
      }
      if (FINANCE_KEYS.has(col.key) && !FINANCE_ROLES.has(role)) {
        warnings.push(`Column ${col.key} requires finance role — dropped`);
        continue;
      }
      sanitized.push({
        key: col.key,
        label: col.label || col.key,
        visible: col.visible !== false,
        width: col.width || null,
      });
    }

    const payload = {
      entity_key,
      owner_user_id: user.id,
      name,
      columns: sanitized,
      sort: sort || "event_date",
      is_default,
      is_global: false,
    };

    let saved;
    if (id) {
      // Verify ownership
      const existing = await base44.asServiceRole.entities.TableViewConfig.filter({ id });
      const rec = existing[0];
      if (!rec) return Response.json({ error: "Not found" }, { status: 404 });
      if (rec.owner_user_id !== user.id && role !== "admin") {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      saved = await base44.asServiceRole.entities.TableViewConfig.update(id, payload);
    } else {
      saved = await base44.asServiceRole.entities.TableViewConfig.create(payload);
    }

    // If is_default=true, unset other defaults for same user+entity_key
    if (is_default) {
      const others = await base44.asServiceRole.entities.TableViewConfig.filter({
        entity_key, owner_user_id: user.id, is_default: true,
      });
      await Promise.all(
        others.filter(c => c.id !== saved.id).map(c =>
          base44.asServiceRole.entities.TableViewConfig.update(c.id, { is_default: false })
        )
      );
    }

    return Response.json({ config: saved, warnings });
  } catch (err) {
    console.error("[saveTableViewConfig] error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});