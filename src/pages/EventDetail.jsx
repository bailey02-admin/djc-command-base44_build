import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EventAPI, ActivityAPI } from "../components/api/secureApi";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, differenceInDays } from "date-fns";
import {
  ArrowLeft, Edit, CalendarDays, MapPin, Music, Clock,
  DollarSign, Loader2, AlertTriangle, Send, History
} from "lucide-react";
import ReadinessPanel from "../components/events/ReadinessPanel";
import FinalizationChecklist from "../components/events/FinalizationChecklist";
import ChangeHistoryPanel from "../components/events/ChangeHistoryPanel";
import EventNextBestAction from "../components/events/EventNextBestAction";
import ActivityFeed from "../components/leads/ActivityFeed";
import SendMessageModal from "../components/communication/SendMessageModal";
import { calculateReadinessScore } from "../components/crm/pipeline";
import { trackEventChanges } from "../components/crm/changeTracker";

const STATUS_OPTIONS = ["booked","planning_in_progress","awaiting_planning_form","final_call_scheduled","finalized","dj_assigned","confirmed","event_completed","survey_sent","review_requested","closed_won","closed_issue"];

export default function EventDetail() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const queryClient = useQueryClient();
  const [sendMsgOpen, setSendMsgOpen] = useState(false);
  const [user, setUser] = useState(null);
  React.useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const events = await base44.entities.Event.list();
      return events.find(e => e.id === id);
    },
    enabled: !!id,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["event-activities", id],
    queryFn: () => base44.entities.Activity.filter({ related_id: id }, "-created_date", 50),
    enabled: !!id,
  });

  const { data: musicSelections = [] } = useQuery({
    queryKey: ["music", id],
    queryFn: () => base44.entities.MusicSelection.filter({ event_id: id }, "category", 100),
    enabled: !!id,
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ["timeline", id],
    queryFn: () => base44.entities.TimelineItem.filter({ event_id: id }, "order", 50),
    enabled: !!id,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["event-payments", id],
    queryFn: () => base44.entities.Payment.filter({ event_id: id }, "-created_date", 20),
    enabled: !!id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["event-tasks", id],
    queryFn: () => base44.entities.Task.filter({ related_id: id }, "-due_date", 20),
    enabled: !!id,
  });

  const updateEvent = async (field, value) => {
    await trackEventChanges(event, { [field]: value }, user?.email || "");
    await base44.entities.Event.update(id, { [field]: value });
    queryClient.invalidateQueries(["event", id]);
    queryClient.invalidateQueries(["change-history", id]);
  };

  const updateReadinessItem = async (key, value) => {
    const update = { [key]: value };
    const updatedEvent = { ...event, ...update };
    const newScore = calculateReadinessScore(updatedEvent);
    await trackEventChanges(event, update, user?.email || "");
    await base44.entities.Event.update(id, { ...update, readiness_score: newScore });
    queryClient.invalidateQueries(["event", id]);
    queryClient.invalidateQueries(["change-history", id]);
  };

  if (isLoading || !event) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-violet-600" /></div>;

  const daysUntil = event.event_date ? differenceInDays(new Date(event.event_date), new Date()) : null;
  const readiness = calculateReadinessScore(event);

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">
      <Link to={createPageUrl("Events")} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to Events
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{event.event_name}</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-500 flex-wrap">
            {event.event_date && <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />{format(new Date(event.event_date), "EEEE, MMMM d, yyyy")}</span>}
            {event.venue_name && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{event.venue_name}</span>}
          </div>
          <div className="flex gap-2 mt-2 flex-wrap">
            <Badge variant="secondary" className="text-xs capitalize">{event.status?.replace(/_/g, " ")}</Badge>
            <Badge variant="outline" className={`text-xs ${readiness >= 80 ? "border-emerald-200 text-emerald-700" : readiness >= 50 ? "border-amber-200 text-amber-700" : "border-red-200 text-red-600"}`}>
              {readiness}% Ready
            </Badge>
            {daysUntil !== null && (
              <Badge variant="outline" className={`text-xs ${daysUntil <= 7 ? "border-red-200 text-red-600" : daysUntil <= 30 ? "border-amber-200 text-amber-700" : ""}`}>
                {daysUntil <= 0 ? "Today!" : `${daysUntil} days`}
              </Badge>
            )}
            {daysUntil !== null && daysUntil <= 14 && readiness < 80 && (
              <Badge className="bg-red-100 text-red-700 text-xs gap-1">
                <AlertTriangle className="w-3 h-3" /> Action Needed
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to={createPageUrl("EventForm") + `?id=${event.id}`}>
            <Button variant="outline" size="sm"><Edit className="w-4 h-4 mr-1" />Edit</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => setSendMsgOpen(true)}>
            <Send className="w-4 h-4 mr-1" />Send Message
          </Button>
          <Select value={event.status} onValueChange={v => updateEvent("status", v)}>
            <SelectTrigger className="w-44 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-white border flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="finalization">Finalization</TabsTrigger>
          <TabsTrigger value="music">Music ({musicSelections.length})</TabsTrigger>
          <TabsTrigger value="timeline">Timeline ({timeline.length})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity ({activities.length})</TabsTrigger>
          <TabsTrigger value="history"><History className="w-3 h-3 mr-1" />Changes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Event Details</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                    <div><span className="text-gray-400 text-xs">Type</span><p className="font-medium capitalize mt-0.5">{event.event_type?.replace(/_/g, " ")}</p></div>
                    <div><span className="text-gray-400 text-xs">Time</span><p className="font-medium mt-0.5">{event.start_time || "TBD"} – {event.end_time || "TBD"}</p></div>
                    <div><span className="text-gray-400 text-xs">Guests</span><p className="font-medium mt-0.5">{event.guest_count || "TBD"}</p></div>
                    <div><span className="text-gray-400 text-xs">City</span><p className="font-medium mt-0.5">{event.city || "TBD"}</p></div>
                    <div><span className="text-gray-400 text-xs">Package</span><p className="font-medium mt-0.5">{event.package_name || "TBD"}</p></div>
                    <div><span className="text-gray-400 text-xs">Price</span><p className="font-medium mt-0.5">{event.package_price ? `$${event.package_price.toLocaleString()}` : "TBD"}</p></div>
                    <div><span className="text-gray-400 text-xs">DJ</span><p className="font-medium mt-0.5">{event.assigned_dj || "Unassigned"}</p></div>
                    <div><span className="text-gray-400 text-xs">Finalizer</span><p className="font-medium mt-0.5">{event.assigned_finalizer || "—"}</p></div>
                    <div><span className="text-gray-400 text-xs">Setup Time</span><p className="font-medium mt-0.5">{event.setup_time || "TBD"}</p></div>
                    <div><span className="text-gray-400 text-xs">Final Call</span><p className="font-medium mt-0.5">{event.final_call_date || "Not scheduled"}</p></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Client Contact</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-gray-400 text-xs">Name</span><p className="font-medium mt-0.5">{event.contact_name || "—"}</p></div>
                    <div><span className="text-gray-400 text-xs">Email</span><p className="font-medium mt-0.5">{event.contact_email || "—"}</p></div>
                    <div><span className="text-gray-400 text-xs">Phone</span><p className="font-medium mt-0.5">{event.contact_phone || "—"}</p></div>
                  </div>
                </CardContent>
              </Card>
              {event.internal_notes && (
                <Card className="border-0 shadow-sm border-l-4 border-l-amber-400">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">Internal Notes</p>
                    <p className="text-sm text-gray-700">{event.internal_notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
            <div className="space-y-4">
              <EventNextBestAction event={event} tasks={tasks} />
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Event Readiness</CardTitle></CardHeader>
                <CardContent>
                  <ReadinessPanel event={event} onToggle={updateReadinessItem} />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="music">
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold">Music Selections</CardTitle>
              <Link to={createPageUrl("MusicPlanner") + `?event_id=${id}`}>
                <Button size="sm" variant="outline"><Music className="w-4 h-4 mr-1" />Edit Music</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {musicSelections.length > 0 ? (
                <div className="space-y-2">
                  {musicSelections.map(m => (
                    <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 text-sm">
                      <div>
                        <p className="font-medium">{m.song_title} <span className="text-gray-400">– {m.artist}</span></p>
                        <Badge variant="secondary" className="text-[10px] mt-0.5 capitalize">{m.category?.replace(/_/g, " ")}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-center py-8 text-gray-400 text-sm">No music selections yet.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold">Event Timeline</CardTitle>
              <Link to={createPageUrl("TimelineBuilder") + `?event_id=${id}`}>
                <Button size="sm" variant="outline"><Clock className="w-4 h-4 mr-1" />Edit Timeline</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {timeline.length > 0 ? (
                <div className="space-y-1">
                  {timeline.map(item => (
                    <div key={item.id} className="flex gap-3 py-2.5 border-b border-gray-100 last:border-0 text-sm">
                      <span className="text-xs font-mono text-violet-600 w-16 flex-shrink-0 pt-0.5">{item.time}</span>
                      <div>
                        <p className="font-medium text-gray-900">{item.segment_name}</p>
                        {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                        <div className="flex gap-2 mt-1">
                          {item.mic_needed && <Badge variant="outline" className="text-[10px]">🎤 Mic</Badge>}
                          {item.music_cue && <Badge variant="outline" className="text-[10px]">🎵 {item.music_cue}</Badge>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-center py-8 text-gray-400 text-sm">No timeline items yet.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Payments</CardTitle></CardHeader>
            <CardContent>
              {payments.length > 0 ? payments.map(p => (
                <div key={p.id} className="flex items-center justify-between py-3 border-b last:border-0 text-sm">
                  <div>
                    <p className="font-medium capitalize">{p.payment_type?.replace(/_/g, " ")}</p>
                    {p.due_date && <p className="text-xs text-gray-400">Due: {format(new Date(p.due_date), "MMM d, yyyy")}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-bold">${p.amount?.toLocaleString()}</p>
                    <Badge variant="secondary" className={`text-[10px] ${p.status === "paid" ? "bg-emerald-50 text-emerald-700" : p.status === "overdue" ? "bg-red-50 text-red-700" : "bg-yellow-50 text-yellow-700"}`}>
                      {p.status}
                    </Badge>
                  </div>
                </div>
              )) : <p className="text-center py-8 text-gray-400 text-sm">No payments recorded.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finalization">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <FinalizationChecklist event={event} onToggle={updateReadinessItem} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <ActivityFeed
            activities={activities}
            relatedId={id}
            relatedName={event.event_name}
            relatedType="event"
            queryKey="event-activities"
          />
        </TabsContent>

        <TabsContent value="history">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Change History</CardTitle></CardHeader>
            <CardContent>
              <ChangeHistoryPanel eventId={id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <SendMessageModal
        open={sendMsgOpen}
        onClose={() => setSendMsgOpen(false)}
        event={event}
        relatedType="event"
        relatedId={id}
        relatedName={event.event_name}
      />
    </div>
  );
}