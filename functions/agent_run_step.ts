import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function authCheck(req) {
  const token = req.headers.get("x-agent-token");
  const expected = Deno.env.get("AGENT_TOKEN");
  return token && token === expected;
}

// Registry of supported steps
const STEPS = {
  "operations:create_event": {
    inputsNeeded: ["event_name", "event_type", "event_date"],
    async run(base44, inputs) {
      const { event_name, event_type, event_date, ...rest } = inputs;
      const existing = await base44.asServiceRole.entities.Event.filter({ event_name, event_date });
      if (existing.length > 0) {
        return { changes: [], logs: [`Event "${event_name}" on ${event_date} already exists (idempotent skip)`] };
      }
      const created = await base44.asServiceRole.entities.Event.create({ event_name, event_type, event_date, ...rest });
      return { changes: [{ entity: "Event", action: "created", id: created.id }], logs: [`Created event: ${event_name}`] };
    },
  },
  "operations:create_lead": {
    inputsNeeded: ["client_first_name", "email", "event_type"],
    async run(base44, inputs) {
      const { client_first_name, email, event_type, ...rest } = inputs;
      const existing = await base44.asServiceRole.entities.Lead.filter({ email });
      if (existing.length > 0) {
        return { changes: [], logs: [`Lead with email "${email}" already exists (idempotent skip)`] };
      }
      const created = await base44.asServiceRole.entities.Lead.create({ client_first_name, email, event_type, ...rest });
      return { changes: [{ entity: "Lead", action: "created", id: created.id }], logs: [`Created lead: ${client_first_name} (${email})`] };
    },
  },
  "operations:create_task": {
    inputsNeeded: ["title"],
    async run(base44, inputs) {
      const { title, idempotency_key, ...rest } = inputs;
      if (idempotency_key) {
        const existing = await base44.asServiceRole.entities.Task.filter({ idempotency_key });
        if (existing.length > 0) {
          return { changes: [], logs: [`Task with idempotency_key "${idempotency_key}" already exists (idempotent skip)`] };
        }
      }
      const created = await base44.asServiceRole.entities.Task.create({ title, idempotency_key, ...rest });
      return { changes: [{ entity: "Task", action: "created", id: created.id }], logs: [`Created task: ${title}`] };
    },
  },
  "operations:update_event_status": {
    inputsNeeded: ["event_id", "status"],
    async run(base44, inputs) {
      const { event_id, status } = inputs;
      const event = await base44.asServiceRole.entities.Event.get(event_id);
      if (!event) throw new Error(`Event ${event_id} not found`);
      if (event.status === status) {
        return { changes: [], logs: [`Event already has status "${status}" (idempotent skip)`] };
      }
      await base44.asServiceRole.entities.Event.update(event_id, { status });
      return { changes: [{ entity: "Event", action: "updated", id: event_id, field: "status", from: event.status, to: status }], logs: [`Updated event ${event_id} status: ${event.status} → ${status}`] };
    },
  },
};

Deno.serve(async (req) => {
  if (!authCheck(req)) {
    return Response.json({ ok: false, errors: ["Unauthorized: invalid or missing x-agent-token"] }, { status: 401 });
  }

  try {
    const { phaseId, stepId, inputs = {} } = await req.json();

    if (!phaseId || !stepId) {
      return Response.json({ ok: false, errors: ["phaseId and stepId are required"] }, { status: 400 });
    }

    const stepKey = `${phaseId}:${stepId}`;
    const step = STEPS[stepKey];

    if (!step) {
      const available = Object.keys(STEPS);
      return Response.json({
        ok: false,
        errors: [`Unknown step "${stepKey}". Available: ${available.join(", ")}`],
        available,
      }, { status: 400 });
    }

    // Validate required inputs
    const missing = (step.inputsNeeded || []).filter(k => inputs[k] === undefined || inputs[k] === null || inputs[k] === "");
    if (missing.length > 0) {
      return Response.json({
        ok: false,
        errors: [`Missing required inputs: ${missing.join(", ")}`],
        next: { phaseId, stepId, inputsNeeded: step.inputsNeeded },
      }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    const result = await step.run(base44, inputs);

    return Response.json({
      ok: true,
      phaseId,
      stepId,
      changes: result.changes || [],
      logs: result.logs || [],
      errors: result.errors || [],
      next: {
        phaseId: "operations",
        stepId: "agent_status",
        inputsNeeded: [],
      },
    });
  } catch (error) {
    return Response.json({ ok: false, errors: [error.message] }, { status: 500 });
  }
});