import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const { email } = await req.json();
    if (!email) {
      return Response.json({ error: 'Email required' }, { status: 400 });
    }

    // Find or create StaffProfile
    const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email });
    let profile = profiles?.[0];

    if (profile) {
      // Update existing
      await base44.asServiceRole.entities.StaffProfile.update(profile.id, { 
        custom_role: 'admin' 
      });
    } else {
      // Create new
      await base44.asServiceRole.entities.StaffProfile.create({ 
        email, 
        custom_role: 'admin' 
      });
    }

    return Response.json({ success: true, email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});