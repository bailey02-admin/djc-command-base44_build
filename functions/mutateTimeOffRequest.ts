import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Resolve StaffProfile for RBAC
    let role = user.role || 'sales_rep';
    let staffProfile = null;
    try {
      const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email });
      staffProfile = profiles?.[0];
      if (staffProfile) {
        if (staffProfile.is_active === false) return Response.json({ error: 'Account deactivated' }, { status: 403 });
        role = staffProfile.custom_role || role;
      }
    } catch (_) {}

    const body = await req.json().catch(() => ({}));
    const { action, id, staff_profile_id, date_from, date_to, type, reason } = body;

    if (!action) return Response.json({ error: 'action required' }, { status: 400 });

    // CREATE/UPDATE/CANCEL: DJs can manage their own pending requests
    if (action === 'create' || action === 'update' || action === 'cancel') {
      if (role === 'dj') {
        const targetId = action === 'create' ? null : id;
        if (targetId) {
          const existing = await base44.asServiceRole.entities.TimeOffRequest.filter({ id: targetId }, '-created_date', 1);
          const rec = existing?.[0];
          if (!rec || rec.staff_profile_id !== staffProfile?.id) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
          }
          if (rec.status !== 'pending') {
            return Response.json({ error: 'Can only edit pending requests' }, { status: 400 });
          }
        }
      } else if (!['admin', 'city_manager'].includes(role)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // APPROVE/DENY: admin/city_manager only
    if (action === 'approve' || action === 'deny') {
      if (!['admin', 'city_manager'].includes(role)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });

      const existing = await base44.asServiceRole.entities.TimeOffRequest.filter({ id }, '-created_date', 1);
      const rec = existing?.[0];
      if (!rec) return Response.json({ error: 'Not found' }, { status: 404 });

      // City manager can only review their city
      if (role === 'city_manager' && rec.city !== staffProfile?.default_city) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }

      const newStatus = action === 'approve' ? 'approved' : 'denied';
      await base44.asServiceRole.entities.TimeOffRequest.update(id, {
        status: newStatus,
        reviewed_by: staffProfile?.id,
        reviewed_at: new Date().toISOString()
      });

      // Log activity
      await base44.asServiceRole.entities.Activity.create({
        type: 'status_change',
        subject: `Time off request ${action}ed`,
        description: `${rec.staff_name}'s time off request from ${rec.date_from} to ${rec.date_to} was ${action}ed`,
        related_type: 'event',
        related_id: rec.staff_profile_id,
        related_name: rec.staff_name,
        performed_by: user.email,
        is_internal: true
      });

      return Response.json({ success: true, status: newStatus });
    }

    // CREATE
    if (action === 'create') {
      if (!staff_profile_id || !date_from || !date_to || !type) {
        return Response.json({ error: 'staff_profile_id, date_from, date_to, type required' }, { status: 400 });
      }

      const targetProfile = await base44.asServiceRole.entities.StaffProfile.filter({ id: staff_profile_id }, '-created_date', 1);
      const prof = targetProfile?.[0];
      if (!prof) return Response.json({ error: 'Staff profile not found' }, { status: 404 });

      const newReq = await base44.asServiceRole.entities.TimeOffRequest.create({
        staff_profile_id,
        staff_name: prof.full_name,
        city: prof.default_city,
        date_from,
        date_to,
        type,
        reason: reason || null,
        status: 'pending'
      });

      return Response.json({ success: true, request: newReq });
    }

    // UPDATE
    if (action === 'update') {
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });
      const updates = {};
      if (date_from) updates.date_from = date_from;
      if (date_to) updates.date_to = date_to;
      if (type) updates.type = type;
      if (reason !== undefined) updates.reason = reason;

      await base44.asServiceRole.entities.TimeOffRequest.update(id, updates);
      return Response.json({ success: true });
    }

    // CANCEL
    if (action === 'cancel') {
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });
      await base44.asServiceRole.entities.TimeOffRequest.update(id, { status: 'denied' });
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});