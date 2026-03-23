/**
 * getTableViewConfigs — returns configs visible to the current user:
 *   - their own configs for the entity_key
 *   - global configs (is_global=true)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { entity_key = "events" } = body;

    const [userConfigs, globalConfigs] = await Promise.all([
      base44.asServiceRole.entities.TableViewConfig.filter({ entity_key, owner_user_id: user.id }),
      base44.asServiceRole.entities.TableViewConfig.filter({ entity_key, is_global: true }),
    ]);

    // De-dupe: user's own version of a global config takes precedence (by name match)
    const userNames = new Set(userConfigs.map(c => c.name));
    const mergedGlobals = globalConfigs.filter(c => !userNames.has(c.name));

    const all = [...userConfigs, ...mergedGlobals];

    return Response.json({ configs: all });
  } catch (err) {
    console.error("[getTableViewConfigs] error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});