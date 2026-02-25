/**
 * Duplicate lead detection endpoint.
 * Checks for likely duplicates before/after lead create.
 * Detection signals (in priority order):
 *   1. Exact email match (strongest)
 *   2. Phone match + event_date match
 *   3. First+last name match + event_date match
 *
 * Returns: { duplicates: Lead[], risk: "high"|"medium"|"low"|"none" }
 * Never blocks creation — caller decides.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function normalize(str) {
  return (str || "").toLowerCase().replace(/\D/g, ""); // strip non-alphanum for phone
}

function normalizeEmail(email) {
  return (email || "").toLowerCase().trim();
}

function normalizePhone(phone) {
  return (phone || "").replace(/\D/g, ""); // digits only
}

function nameSimilar(a, b) {
  return a && b && a.toLowerCase().trim() === b.toLowerCase().trim();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { email, phone, event_date, client_first_name, client_last_name, exclude_id } = body;

    if (!email && !phone) {
      return Response.json({ duplicates: [], risk: "none" });
    }

    // Fetch recent non-deleted, non-lost leads (last 2000)
    const allLeads = await base44.asServiceRole.entities.Lead.list("-created_date", 2000);
    const candidates = allLeads.filter(l =>
      !l.is_deleted &&
      !["lost", "ghosted", "disqualified"].includes(l.status) &&
      l.id !== exclude_id
    );

    const emailNorm = normalizeEmail(email);
    const phoneNorm = normalizePhone(phone);

    const results = [];

    for (const lead of candidates) {
      const leadEmail = normalizeEmail(lead.email);
      const leadPhone = normalizePhone(lead.phone);
      const leadDate = lead.event_date;

      let matchReason = null;
      let risk = null;

      // Signal 1: exact email
      if (emailNorm && leadEmail && emailNorm === leadEmail) {
        matchReason = "Same email";
        risk = "high";
      }
      // Signal 2: phone + event_date
      else if (
        phoneNorm && leadPhone && phoneNorm.length >= 7 && phoneNorm === leadPhone &&
        event_date && leadDate && event_date === leadDate
      ) {
        matchReason = "Same phone + same event date";
        risk = "high";
      }
      // Signal 3: name + event_date
      else if (
        event_date && leadDate && event_date === leadDate &&
        nameSimilar(client_first_name, lead.client_first_name) &&
        nameSimilar(client_last_name, lead.client_last_name)
      ) {
        matchReason = "Same name + same event date";
        risk = "medium";
      }
      // Signal 4: phone only (weaker)
      else if (phoneNorm && leadPhone && phoneNorm.length >= 10 && phoneNorm === leadPhone) {
        matchReason = "Same phone number";
        risk = "medium";
      }

      if (matchReason) {
        results.push({
          ...lead,
          _match_reason: matchReason,
          _match_risk: risk,
        });
      }
    }

    // Overall risk = worst match
    const overallRisk = results.some(r => r._match_risk === "high")
      ? "high"
      : results.some(r => r._match_risk === "medium")
        ? "medium"
        : results.length > 0 ? "low" : "none";

    // Return minimal safe fields only (no financials)
    const safe = results.map(l => ({
      id: l.id,
      client_first_name: l.client_first_name,
      client_last_name: l.client_last_name,
      email: l.email,
      phone: l.phone,
      event_date: l.event_date,
      event_type: l.event_type,
      city: l.city,
      pipeline_stage: l.pipeline_stage,
      status: l.status,
      created_date: l.created_date,
      _match_reason: l._match_reason,
      _match_risk: l._match_risk,
    }));

    return Response.json({ duplicates: safe, risk: overallRisk });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});