import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const agentToken = req.headers.get('x-agent-token');
  const expectedToken = Deno.env.get('AGENT_TOKEN');
  if (!agentToken || agentToken !== expectedToken) {
    return Response.json({ ok: false, errors: ['Unauthorized: invalid x-agent-token'] }, { status: 401 });
  }

  try {
    const base44 = createClientFromRequest(req);

    // Sample system state
    const [users, events, leads] = await Promise.all([
      base44.asServiceRole.entities.User.list('-created_date', 20).catch(() => []),
      base44.asServiceRole.entities.Event.list('-created_date', 5).catch(() => []),
      base44.asServiceRole.entities.Lead.list('-created_date', 5).catch(() => []),
    ]);

    const activeUsers = users.filter(u => u.is_active !== false);
    const pendingInvites = users.filter(u => u.invite_status === 'invited');
    const notInvited = users.filter(u => !u.invite_status || u.invite_status === 'not_invited');

    const blockers = [];
    if (notInvited.length > 0) blockers.push(`${notInvited.length} user(s) not yet invited`);

    return Response.json({
      ok: true,
      phaseId: 'user_management',
      stepId: 'system_health_check',
      completedSteps: ['rbac_backend_enforced', 'audit_logging_enabled', 'invite_flow_ready'],
      blockers,
      system_state: {
        total_users: users.length,
        active_users: activeUsers.length,
        pending_invites: pendingInvites.length,
        not_invited: notInvited.length,
        total_events: events.length,
        total_leads: leads.length,
      },
      next: {
        phaseId: 'user_management',
        stepId: 'invite_pending_users',
        inputsNeeded: notInvited.length > 0 ? ['user_ids'] : [],
      },
    });
  } catch (e) {
    return Response.json({ ok: false, errors: [e.message] }, { status: 500 });
  }
});