/**
 * deleteTableViewConfig — delete a config by ID.
 * Only owner or admin. Cannot delete global configs unless admin.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { id } = body;
    if (!id) return Response.json({ error: "id required" }, { status: 400 });

    const rows = await base44.asServiceRole.entities.TableViewConfig.filter({ id });
    const rec = rows[0];
    if (!rec) return Response.json({ error: "Not found" }, { status: 404 });

    const role = user.role || "sales_rep";
    if (rec.is_global && role !== "admin") {
      return Response.json({ error: "Only admins can delete global configs" }, { status: 403 });
    }
    if (!rec.is_global && rec.owner_user_id !== user.id && role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    await base44.asServiceRole.entities.TableViewConfig.delete(id);

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[deleteTableViewConfig] error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});