import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Known code index — maps keywords to file paths and snippets
// This is a lightweight static index; extend as the codebase grows.
const CODE_INDEX = [
  { path: 'functions/mutateUser', keywords: ['user', 'create user', 'update user', 'deactivate', 'reactivate', 'audit log', 'admin user'], snippet: 'Admin-only CRUD for User entity with audit logging. Actions: create, update, deactivate, reactivate.' },
  { path: 'functions/inviteUser', keywords: ['invite', 'invitation', 'email token', 'authtoken', 'set password'], snippet: 'Generates SHA-256 invite token, stores in AuthToken entity, sends email with AcceptInvite link. Admin-only.' },
  { path: 'functions/acceptInvite', keywords: ['accept invite', 'set password', 'password', 'token', 'invite accepted'], snippet: 'Validates invite token from AuthToken, calls base44.users.inviteUser, marks token used, writes audit log.' },
  { path: 'functions/requestPasswordReset', keywords: ['forgot password', 'reset password', 'password reset request', 'email reset'], snippet: 'Generates password_reset token in AuthToken, sends email. Always returns ok:true to prevent enumeration.' },
  { path: 'functions/resetPassword', keywords: ['reset password', 'confirm reset', 'new password', 'token reset'], snippet: 'Validates password_reset token from AuthToken, marks used, updates user, writes audit log.' },
  { path: 'functions/getUsers', keywords: ['list users', 'user list', 'filter users', 'search users'], snippet: 'Returns paginated, filtered user list. Requires admin/city_manager/sales_manager/office_finalizer role.' },
  { path: 'functions/crm/accessControl', keywords: ['rbac', 'access control', 'canAccessEvent', 'redactEvent', 'field redaction', 'city scoping', 'dj access'], snippet: 'canAccessEvent(user, event), redactEvent(record, role), safeContactSummary(contact, role). DJ sees only assigned events. Finance fields redacted by role.' },
  { path: 'functions/securityAudit', keywords: ['audit', 'security audit', 'rbac audit', 'access check', 'finalization gate'], snippet: 'Admin-only. Returns structured audit report of all function RBAC claims + finalization gate alignment check.' },
  { path: 'pages/Users', keywords: ['users page', 'user table', 'invite button', 'deactivate user', 'rbac test'], snippet: 'Admin user management page: table with filters, invite/deactivate/reset actions, inline RBAC self-test panel.' },
  { path: 'pages/UserForm', keywords: ['user form', 'create user form', 'edit user', 'city assignment', 'role select'], snippet: 'Create/Edit user form with role selector, city multi-select, Save & Send Invite button.' },
  { path: 'pages/AcceptInvite', keywords: ['accept invite page', 'set password page', 'invite link', 'password form'], snippet: 'Public page. Reads token from URL, calls acceptInvite function, shows success then redirects to login.' },
  { path: 'pages/ForgotPassword', keywords: ['forgot password page', 'reset link', 'email form'], snippet: 'Public page. Submits email to requestPasswordReset function. Always shows success message.' },
  { path: 'pages/ResetPassword', keywords: ['reset password page', 'new password form', 'confirm password'], snippet: 'Public page. Reads token from URL, calls resetPassword function.' },
  { path: 'components/users/RbacSelfTest', keywords: ['rbac self test', 'access checks', 'role test panel', 'debug rbac'], snippet: 'Admin-only panel showing current user role/cities + runs securityAudit checks. Toggle from Users page.' },
  { path: 'entities/AuthToken', keywords: ['auth token', 'invite token', 'reset token', 'token hash'], snippet: 'Stores invite and password_reset tokens as SHA-256 hashes. Fields: token_hash, type, user_id, expires_at, used_at.' },
  { path: 'entities/User', keywords: ['user entity', 'user schema', 'user fields', 'cities field', 'invite_status'], snippet: 'User entity fields: role, cities, default_city, is_active, invite_status, invited_at, last_login_at, contact_id, notes.' },
  { path: 'entities/Activity', keywords: ['activity log', 'audit activity', 'system activity'], snippet: 'Activity entity used for audit logging. type=system, is_internal=true for user management events.' },
];

Deno.serve(async (req) => {
  const agentToken = req.headers.get('x-agent-token');
  const expectedToken = Deno.env.get('AGENT_TOKEN');
  if (!agentToken || agentToken !== expectedToken) {
    return Response.json({ ok: false, errors: ['Unauthorized: invalid x-agent-token'] }, { status: 401 });
  }

  try {
    const { query } = await req.json().catch(() => ({}));
    if (!query) return Response.json({ ok: false, errors: ['query is required'] }, { status: 400 });

    const q = query.toLowerCase();
    const results = CODE_INDEX
      .filter(entry => entry.keywords.some(k => q.includes(k) || k.includes(q.split(' ')[0])))
      .map(entry => ({ path: entry.path, snippet: entry.snippet }));

    // If no matches, return all as fallback catalog
    if (results.length === 0) {
      return Response.json({
        ok: true,
        results: CODE_INDEX.map(e => ({ path: e.path, snippet: e.snippet })),
        note: 'No exact matches found — returning full index.',
      });
    }

    return Response.json({ ok: true, results });
  } catch (e) {
    return Response.json({ ok: false, errors: [e.message] }, { status: 500 });
  }
});