import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const agentToken = req.headers.get('x-agent-token');
  const expectedToken = Deno.env.get('AGENT_TOKEN');
  if (!agentToken || agentToken !== expectedToken) {
    return Response.json({ ok: false, errors: ['Unauthorized: invalid x-agent-token'] }, { status: 401 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const { phaseId, stepId, inputs = {} } = await req.json().catch(() => ({}));

    if (!phaseId || !stepId) {
      return Response.json({ ok: false, errors: ['phaseId and stepId are required'] }, { status: 400 });
    }

    const logs = [];
    const changes = [];
    const errors = [];

    // ── user_management / invite_user ──────────────────────────────────────
    if (phaseId === 'user_management' && stepId === 'invite_user') {
      const { user_id, email, role, full_name, cities = [] } = inputs;
      if (!user_id && !email) {
        errors.push('inputs.user_id or inputs.email required');
      } else {
        const payload = user_id ? { user_id } : { email, role: role || 'sales_rep', full_name, cities };
        const res = await base44.asServiceRole.functions.invoke('inviteUser', payload);
        if (res?.error) errors.push(res.error);
        else {
          changes.push(`Invite sent to user_id=${res?.user_id || email}`);
          logs.push('inviteUser function called successfully');
        }
      }
    }

    // ── user_management / create_user ──────────────────────────────────────
    else if (phaseId === 'user_management' && stepId === 'create_user') {
      const { email, role, full_name, cities = [], default_city } = inputs;
      if (!email || !role) {
        errors.push('inputs.email and inputs.role are required');
      } else {
        const existing = await base44.asServiceRole.entities.User.list('-created_date', 500);
        const dup = existing.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (dup) {
          logs.push(`User ${email} already exists (id=${dup.id}), skipping create (idempotent)`);
          changes.push(`User already exists: ${email}`);
        } else {
          const newUser = await base44.asServiceRole.entities.User.create({
            email, role, full_name: full_name || '', cities, default_city: default_city || null,
            is_active: true, invite_status: 'not_invited',
          });
          changes.push(`Created user ${email} with role=${role}`);
          logs.push(`User record id=${newUser.id} created`);
        }
      }
    }

    // ── user_management / deactivate_user ──────────────────────────────────
    else if (phaseId === 'user_management' && stepId === 'deactivate_user') {
      const { user_id } = inputs;
      if (!user_id) {
        errors.push('inputs.user_id required');
      } else {
        await base44.asServiceRole.entities.User.update(user_id, { is_active: false });
        changes.push(`User ${user_id} deactivated`);
        logs.push('User is_active set to false');
      }
    }

    // ── Unknown step ───────────────────────────────────────────────────────
    else {
      errors.push(`Unknown step: phaseId=${phaseId} stepId=${stepId}`);
    }

    return Response.json({
      ok: errors.length === 0,
      phaseId,
      stepId,
      changes,
      logs,
      errors,
      next: {
        phaseId: 'user_management',
        stepId: 'system_health_check',
        inputsNeeded: [],
      },
    });
  } catch (e) {
    return Response.json({ ok: false, phaseId: null, stepId: null, changes: [], logs: [], errors: [e.message], next: null }, { status: 500 });
  }
});