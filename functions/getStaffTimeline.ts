import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const STAFF_ROLES = new Set(["admin","city_manager","sales_manager","sales_rep","office_finalizer","dj"]);

const TEMPLATES = {
  wedding: [
    { activity_name: "Guests Arrive", time_display: "5:00 PM", comments: "" },
    { activity_name: "Ceremony Begins", time_display: "5:30 PM", comments: "" },
    { activity_name: "Processional", time_display: "5:35 PM", comments: "" },
    { activity_name: "Bridal Entrance", time_display: "5:45 PM", comments: "" },
    { activity_name: "Recessional", time_display: "6:00 PM", comments: "" },
    { activity_name: "Cocktail Hour", time_display: "6:15 PM", comments: "" },
    { activity_name: "Grand Entrance", time_display: "7:00 PM", comments: "" },
    { activity_name: "First Dance", time_display: "7:10 PM", comments: "" },
    { activity_name: "Parent Dances", time_display: "7:15 PM", comments: "" },
    { activity_name: "Dinner", time_display: "7:30 PM", comments: "" },
    { activity_name: "Toasts / Speeches", time_display: "8:00 PM", comments: "" },
    { activity_name: "Cake Cutting", time_display: "8:30 PM", comments: "" },
    { activity_name: "Open Dancing Begins", time_display: "8:45 PM", comments: "" },
    { activity_name: "Last Dance", time_display: "10:45 PM", comments: "" },
    { activity_name: "Send Off", time_display: "11:00 PM", comments: "" },
  ],
  default: [
    { activity_name: "Guests Arrive", time_display: "", comments: "" },
    { activity_name: "Program Begins", time_display: "", comments: "" },
    { activity_name: "Open Dancing", time_display: "", comments: "" },
    { activity_name: "Last Song", time_display: "", comments: "" },
  ],
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !STAFF_ROLES.has(user.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { event_id, timeline_type = "PRIMARY" } = await req.json();
    if (!event_id) return Response.json({ error: "event_id required" }, { status: 400 });

    const svc = base44.asServiceRole;
    const timelines = await svc.entities.StaffTimeline.filter({ event_id, timeline_type });
    const timeline = timelines[0] ?? null;

    const activities = timeline
      ? await svc.entities.StaffTimelineActivity.filter({ timeline_id: timeline.id }, "sort_order", 200)
      : [];

    // Fetch event type for template suggestions
    const events = timeline ? [] : await svc.entities.Event.filter({ id: event_id });
    const event_type = events[0]?.event_type ?? "default";
    const template = TEMPLATES[event_type] ?? TEMPLATES.default;

    return Response.json({ timeline, activities, template });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});