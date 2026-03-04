import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const [statuses, groups] = await Promise.all([
      base44.asServiceRole.entities.EventStatus.list("sort_order", 100),
      base44.asServiceRole.entities.StatusGroup.list("key", 100),
    ]);

    return Response.json({
      statuses: statuses.filter(s => s.is_active),
      all_statuses: statuses,
      groups,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});