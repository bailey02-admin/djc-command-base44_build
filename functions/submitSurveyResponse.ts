import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const STAFF_ROLES = ["admin", "city_manager", "office_finalizer", "sales_manager", "finance"];
const FALLBACK_ELIGIBLE_STATUSES = ["completed"];

async function getEligibleStatuses(base44) {
  try {
    const groups = await base44.asServiceRole.entities.StatusGroup.filter({ key: "post_event" });
    const group = groups?.[0];
    if (group?.statuses?.length > 0) return group.statuses;
  } catch (_) {}
  return FALLBACK_ELIGIBLE_STATUSES;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email });
    const profile = profiles?.[0];
    const role = profile?.custom_role || user.role || "sales_rep";
    const isStaff = STAFF_ROLES.includes(role);
    const isClient = role === "client";

    if (!isStaff && !isClient) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { event_id, template_id, answers = [] } = body;
    if (!event_id || !template_id) {
      return Response.json({ error: "event_id and template_id are required" }, { status: 400 });
    }

    // Load event + eligible statuses in parallel
    const [eventRows, eligibleStatuses] = await Promise.all([
      base44.asServiceRole.entities.Event.filter({ id: event_id }),
      getEligibleStatuses(base44),
    ]);

    const event = eventRows[0];
    if (!event) return Response.json({ error: "Event not found" }, { status: 404 });

    // Eligibility check using dynamic status group
    if (!eligibleStatuses.includes(event.status)) {
      return Response.json({
        error: `Event is not eligible for survey. Eligible statuses: ${eligibleStatuses.join(", ")}. Current: "${event.status}"`,
      }, { status: 422 });
    }

    // Client ownership check
    if (isClient) {
      let resolvedContactId = user.contact_id || null;
      if (!resolvedContactId) {
        const emailContactRows = await base44.asServiceRole.entities.Contact.filter({ email: user.email }).catch(() => []);
        resolvedContactId = emailContactRows[0]?.id || null;
      }
      if (!resolvedContactId || event.contact_id !== resolvedContactId) {
        return Response.json({ error: "Forbidden: not your event" }, { status: 403 });
      }
    }

    // One-response-per-event enforcement
    const existingResponses = await base44.asServiceRole.entities.SurveyResponse.filter({ event_id });
    if (existingResponses.length > 0) {
      return Response.json({ error: "A survey response already exists for this event." }, { status: 409 });
    }

    // Load template and questions
    const templateRows = await base44.asServiceRole.entities.SurveyTemplate.filter({ id: template_id });
    const template = templateRows[0];
    if (!template || template.is_active === false) {
      return Response.json({ error: "Survey template not found or inactive" }, { status: 404 });
    }

    const questions = await base44.asServiceRole.entities.SurveyQuestion.filter({ template_id }, "sort_order", 200);

    // Validate required questions answered
    const answerMap = {};
    for (const a of answers) {
      answerMap[a.question_id] = a;
    }
    for (const q of questions) {
      if (q.is_required) {
        const ans = answerMap[q.id];
        if (!ans) {
          return Response.json({ error: `Required question not answered: "${q.question_text}"` }, { status: 422 });
        }
        if (q.question_type === "rating_1_10" && (ans.rating_value == null)) {
          return Response.json({ error: `Required rating question not answered: "${q.question_text}"` }, { status: 422 });
        }
        if (q.question_type === "yes_no" && (ans.boolean_value == null)) {
          return Response.json({ error: `Required yes/no question not answered: "${q.question_text}"` }, { status: 422 });
        }
        if (q.question_type === "text" && (!ans.text_value || !ans.text_value.trim())) {
          return Response.json({ error: `Required text question not answered: "${q.question_text}"` }, { status: 422 });
        }
      }
    }

    // Compute average score from rating_1_10 questions
    const ratingQs = questions.filter(q => q.question_type === "rating_1_10");
    let averageScore = null;
    if (ratingQs.length > 0) {
      const ratingAnswers = ratingQs
        .map(q => answerMap[q.id])
        .filter(a => a && a.rating_value != null);
      if (ratingAnswers.length > 0) {
        const sum = ratingAnswers.reduce((acc, a) => acc + a.rating_value, 0);
        averageScore = Math.round((sum / ratingAnswers.length) * 10) / 10;
      }
    }

    const lowScoreFlag = averageScore != null && averageScore < (template.low_score_threshold ?? 7.0);

    // Collect text comments for summary
    const textAnswers = answers
      .filter(a => a.text_value && a.text_value.trim())
      .map(a => a.text_value.trim());
    const commentsSummary = textAnswers.length > 0 ? textAnswers.join(" | ") : null;

    // Write SurveyResponse
    const surveyResponse = await base44.asServiceRole.entities.SurveyResponse.create({
      event_id,
      template_id,
      contact_id: event.contact_id || "",
      submitted_at: new Date().toISOString(),
      average_score: averageScore,
      low_score_flag: lowScoreFlag,
      comments_summary: commentsSummary,
      created_by_actor_type: isClient ? "client" : "staff",
      created_by_actor_id: profile?.id || user.id,
    });

    // Write SurveyAnswers
    await Promise.all(
      answers.map(a =>
        base44.asServiceRole.entities.SurveyAnswer.create({
          response_id: surveyResponse.id,
          question_id: a.question_id,
          rating_value: a.rating_value ?? null,
          boolean_value: a.boolean_value ?? null,
          text_value: a.text_value ?? null,
        })
      )
    );

    // Update Event fields
    await base44.asServiceRole.entities.Event.update(event_id, {
      survey_avg: averageScore,
      survey_score: averageScore,
      survey_flag: lowScoreFlag ? "low_score" : "",
      review_submitted: true,
    });

    // Low-score workflow
    if (lowScoreFlag) {
      // Log internal activity (fire and forget)
      base44.asServiceRole.entities.Activity.create({
        type: "system",
        subject: `⚠️ Low Survey Score: ${averageScore}/10`,
        description: `Survey submitted with average score ${averageScore}/10 (threshold: ${template.low_score_threshold ?? 7.0}). Service recovery required.`,
        related_type: "event",
        related_id: event_id,
        related_name: event.event_name,
        is_internal: true,
        outcome: "follow_up_needed",
        performed_by: isClient ? "client" : (user.email || "staff"),
      }).catch(() => {});

      // Idempotent recovery task — check by idempotency_key AND by (related_id + category)
      // to handle any edge case where idempotency_key was not stored
      const idempotencyKey = `low_score_recovery:${event_id}`;

      const [byKey, byEvent] = await Promise.all([
        base44.asServiceRole.entities.Task.filter({ idempotency_key: idempotencyKey }).catch(() => []),
        base44.asServiceRole.entities.Task.filter({ related_id: event_id, category: "survey" }).catch(() => []),
      ]);

      const alreadyExists = (byKey?.length > 0) || (byEvent?.length > 0);

      if (!alreadyExists) {
        // Find manager to assign
        let assignTo = event.assigned_city_manager || event.assigned_finalizer || "";
        if (!assignTo && event.city) {
          const managers = await base44.asServiceRole.entities.StaffProfile.filter({
            custom_role: "city_manager",
          }).catch(() => []);
          const cityMgr = managers.find(m => m.cities?.includes(event.city) || m.default_city === event.city);
          assignTo = cityMgr?.email || "";
        }

        await base44.asServiceRole.entities.Task.create({
          title: `🚨 Service Recovery — Low Survey Score (${averageScore}/10)`,
          description: `Event "${event.event_name}" received a low survey score of ${averageScore}/10. Review feedback and follow up with the client.`,
          related_type: "event",
          related_id: event_id,
          related_name: event.event_name,
          category: "survey",
          priority: "high",
          status: "pending",
          assigned_to: assignTo,
          due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          idempotency_key: idempotencyKey,
        }).catch(() => {});
      }
    }

    return Response.json({
      response: surveyResponse,
      average_score: averageScore,
      low_score_flag: lowScoreFlag,
    });
  } catch (err) {
    console.error("[submitSurveyResponse]", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});