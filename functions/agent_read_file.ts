import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function authCheck(req) {
  const token = req.headers.get("x-agent-token");
  const expected = Deno.env.get("AGENT_TOKEN");
  return token && token === expected;
}

// Files the agent is allowed to read (allowlist for safety)
const ALLOWED_PREFIXES = [
  "pages/",
  "components/",
  "functions/",
  "entities/",
  "agents/",
  "Layout.js",
  "globals.css",
];

Deno.serve(async (req) => {
  if (!authCheck(req)) {
    return Response.json({ ok: false, errors: ["Unauthorized: invalid or missing x-agent-token"] }, { status: 401 });
  }

  try {
    const { path } = await req.json();

    if (!path) {
      return Response.json({ ok: false, errors: ["path is required"] }, { status: 400 });
    }

    // Sanitize path — block traversal attacks
    const sanitized = path.replace(/\.\.\//g, "").replace(/^\//, "");
    const allowed = ALLOWED_PREFIXES.some(prefix => sanitized.startsWith(prefix) || sanitized === prefix.replace(/\/$/, ""));

    if (!allowed) {
      return Response.json({
        ok: false,
        errors: [`Path "${sanitized}" is not in the allowed read list. Allowed prefixes: ${ALLOWED_PREFIXES.join(", ")}`],
      }, { status: 403 });
    }

    // Use base44 service role to read entity schemas; for code files, fetch from the app's source
    const base44 = createClientFromRequest(req);

    // Entity files can be read via SDK schema
    if (sanitized.startsWith("entities/")) {
      const entityName = sanitized.replace("entities/", "").replace(".json", "");
      try {
        const schema = await base44.asServiceRole.entities[entityName]?.schema?.();
        if (schema) {
          return Response.json({ ok: true, path: sanitized, content: JSON.stringify(schema, null, 2) });
        }
      } catch (_) {
        // fall through to generic not found
      }
      return Response.json({ ok: false, errors: [`Entity "${entityName}" not found or has no schema method`] }, { status: 404 });
    }

    // For non-entity files, return a helpful message — direct filesystem access isn't available
    // in Deno backend functions (files are served as static assets, not on disk at runtime).
    return Response.json({
      ok: false,
      errors: [
        `Direct file read of "${sanitized}" is not supported at runtime (Deno functions don't have access to app source files on disk). ` +
        `For entity schemas, use path "entities/EntityName". ` +
        `For source code inspection, use agent_search_code with a query instead.`
      ],
    }, { status: 400 });

  } catch (error) {
    return Response.json({ ok: false, errors: [error.message] }, { status: 500 });
  }
});