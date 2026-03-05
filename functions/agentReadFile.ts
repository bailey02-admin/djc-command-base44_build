import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Allowed path prefixes for security — agent can only read app source files
const ALLOWED_PREFIXES = ['pages/', 'components/', 'functions/', 'entities/', 'agents/', 'Layout', 'globals.css', 'lib/'];

Deno.serve(async (req) => {
  const agentToken = req.headers.get('x-agent-token');
  const expectedToken = Deno.env.get('AGENT_TOKEN');
  if (!agentToken || agentToken !== expectedToken) {
    return Response.json({ ok: false, errors: ['Unauthorized: invalid x-agent-token'] }, { status: 401 });
  }

  try {
    const { path } = await req.json().catch(() => ({}));
    if (!path) return Response.json({ ok: false, errors: ['path is required'] }, { status: 400 });

    const allowed = ALLOWED_PREFIXES.some(p => path.startsWith(p));
    if (!allowed) {
      return Response.json({ ok: false, errors: [`Path not allowed. Must start with one of: ${ALLOWED_PREFIXES.join(', ')}`] }, { status: 403 });
    }

    const base44 = createClientFromRequest(req);
    // Use service role to read entities as a proxy for file metadata
    // Note: actual file reading is limited to what the platform exposes.
    // This returns a structured record describing the file's known entity schema if it's an entity path.
    if (path.startsWith('entities/')) {
      const entityName = path.replace('entities/', '').replace('.json', '');
      const schema = await base44.asServiceRole.entities[entityName]?.schema?.().catch(() => null);
      return Response.json({ ok: true, path, content: schema ? JSON.stringify(schema, null, 2) : `Entity schema for ${entityName} not accessible via API` });
    }

    // For non-entity paths, return path metadata (actual file content access is platform-restricted)
    return Response.json({
      ok: true,
      path,
      content: `File at ${path} acknowledged. Direct file content access requires platform file API. Use agent_search_code to find relevant code snippets.`,
    });
  } catch (e) {
    return Response.json({ ok: false, errors: [e.message] }, { status: 500 });
  }
});