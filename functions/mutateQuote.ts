/**
 * Secure Quote mutation endpoint.
 * Actions: create | update | delete | send | accept | decline
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const ALLOWED = new Set(["admin", "city_manager", "sales_manager", "sales_rep"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = user.role || "sales_rep";
    if (!ALLOWED.has(role)) return Response.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { action, id, data = {} } = body;

    if (action === "create") {
      if (!data.lead_id || !data.package_name || data.total_amount === undefined) {
        return Response.json({ error: "lead_id, package_name, and total_amount are required" }, { status: 400 });
      }
      const quote = await base44.asServiceRole.entities.Quote.create({
        ...data,
        total_amount: Number(data.total_amount),
        base_price: Number(data.base_price || 0),
        status: data.status || "draft",
      });

      // Write quote_amount back to lead
      if (data.lead_id) {
        await base44.asServiceRole.entities.Lead.update(data.lead_id, {
          quote_amount: Number(data.total_amount),
          package_name: data.package_name,
        }).catch(() => {});
      }

      // Log activity
      await base44.asServiceRole.entities.Activity.create({
        type: "note",
        subject: `Quote created: ${data.package_name} — $${Number(data.total_amount).toLocaleString()}`,
        related_type: "lead",
        related_id: data.lead_id,
        is_internal: true,
        performed_by: user.email,
      }).catch(() => {});

      return Response.json({ quote });
    }

    if (action === "update") {
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      const payload = { ...data };
      if (payload.total_amount !== undefined) payload.total_amount = Number(payload.total_amount);
      if (payload.base_price !== undefined) payload.base_price = Number(payload.base_price);
      const quote = await base44.asServiceRole.entities.Quote.update(id, payload);

      // Sync to lead
      if (quote.lead_id && payload.total_amount !== undefined) {
        await base44.asServiceRole.entities.Lead.update(quote.lead_id, {
          quote_amount: payload.total_amount,
        }).catch(() => {});
      }

      return Response.json({ quote });
    }

    if (action === "send") {
      if (!id) return Response.json({ error: "id required" }, { status: 400 });

      // Idempotency: fetch current state first
      const existing = await base44.asServiceRole.entities.Quote.filter({ id });
      const currentQuote = existing[0];
      if (!currentQuote) return Response.json({ error: "Quote not found" }, { status: 404 });

      // If already sent (or beyond), just return without re-advancing pipeline or logging again
      if (currentQuote.status !== "draft") {
        return Response.json({ quote: currentQuote });
      }

      const now = new Date().toISOString();
      const quote = await base44.asServiceRole.entities.Quote.update(id, {
        status: "sent",
        sent_date: now,
      });
      if (quote.lead_id) {
        // Only advance pipeline if lead is still in an earlier stage
        const leads = await base44.asServiceRole.entities.Lead.filter({ id: quote.lead_id });
        const lead = leads[0];
        const TERMINAL = new Set(["booked", "lost", "ghosted", "disqualified", "quote_sent", "deposit_requested"]);
        if (lead && !TERMINAL.has(lead.pipeline_stage)) {
          await base44.asServiceRole.entities.Lead.update(quote.lead_id, {
            quote_sent_date: now,
            pipeline_stage: "quote_sent",
            status: "quote_sent",
          }).catch(() => {});
        } else if (lead && !lead.quote_sent_date) {
          // Still stamp the timestamp even if not advancing stage
          await base44.asServiceRole.entities.Lead.update(quote.lead_id, {
            quote_sent_date: now,
          }).catch(() => {});
        }
      }
      await base44.asServiceRole.entities.Activity.create({
        type: "email",
        subject: `Quote sent — $${quote.total_amount?.toLocaleString()}`,
        related_type: "lead",
        related_id: quote.lead_id,
        outcome: "email_sent",
        is_internal: false,
        performed_by: user.email,
      }).catch(() => {});
      return Response.json({ quote });
    }

    if (action === "accept") {
      if (!id) return Response.json({ error: "id required" }, { status: 400 });

      // Idempotency: fetch first
      const existing = await base44.asServiceRole.entities.Quote.filter({ id });
      const currentQuote = existing[0];
      if (!currentQuote) return Response.json({ error: "Quote not found" }, { status: 404 });
      if (currentQuote.status === "accepted") return Response.json({ quote: currentQuote });

      const quote = await base44.asServiceRole.entities.Quote.update(id, { status: "accepted" });
      if (quote.lead_id) {
        // Only advance pipeline if lead is not already booked/lost/past deposit_requested
        const leads = await base44.asServiceRole.entities.Lead.filter({ id: quote.lead_id });
        const lead = leads[0];
        const SAFE_TO_ADVANCE = new Set(["new_inquiry","contacted","qualified","consultation_scheduled","consultation_completed","quote_sent","follow_up"]);
        if (lead && SAFE_TO_ADVANCE.has(lead.pipeline_stage)) {
          await base44.asServiceRole.entities.Lead.update(quote.lead_id, {
            pipeline_stage: "deposit_requested",
            total_fee: quote.total_amount,
          }).catch(() => {});
        }
        // If already booked/lost, just log and skip — don't overwrite
      }
      await base44.asServiceRole.entities.Activity.create({
        type: "note",
        subject: `Quote accepted — $${quote.total_amount?.toLocaleString()}`,
        related_type: "lead",
        related_id: quote.lead_id,
        outcome: "completed",
        is_internal: true,
        performed_by: user.email,
      }).catch(() => {});
      return Response.json({ quote });
    }

    if (action === "decline") {
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      const quote = await base44.asServiceRole.entities.Quote.update(id, { status: "declined" });
      return Response.json({ quote });
    }

    if (action === "delete") {
      if (!["admin", "city_manager", "sales_manager"].includes(role)) {
        return Response.json({ error: "Forbidden: insufficient role" }, { status: 403 });
      }
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      await base44.asServiceRole.entities.Quote.delete(id);
      return Response.json({ ok: true });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});