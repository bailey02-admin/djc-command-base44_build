import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import {
  ArrowLeft, Edit, CalendarDays, MapPin, User, Music, Clock,
  CheckCircle2, Circle, FileText, DollarSign, MessageSquare, Send, Loader2
} from "lucide-react";

const STATUS_OPTIONS = ["booked","planning_in_progress","awaiting_planning_form","final_call_scheduled","finalized","dj_assigned","confirmed","event_completed","survey_sent","review_requested","closed_won","closed_issue"];

export default function EventDetail() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);

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

  const updateEvent = async (field, value) => {
    await base44.entities.Event.update(id, { [field]: value });
    queryClient.invalidateQueries(["event", id]);
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    await base44.entities.Activity.create({
      type: "note", subject: "Note added", description: noteText,
      related_type: "event", related_id: id, related_name: event?.event_name,
    });
    setNoteText("");
    setAddingNote(false);
    queryClient.invalidateQueries(["event-activities", id]);
  };

  if (isLoading || !event) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-violet-600" /></div>;

  const checklist = [
    { label: "Contract Signed", key: "contract_signed", done: event.contract_signed },
    { label: "Deposit Paid", key: "deposit_paid", done: event.deposit_paid },
    { label: "Planning Complete", key: "planning_complete", done: event.planning_complete },
    { label: "Timeline Complete", key: "timeline_complete", done: event.timeline_complete },
    { label: "Music Complete", key: "music_complete", done: event.music_complete },
    { label: "Balance Paid", key: "balance_paid", done: event.balance_paid },
  ];

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
        </div>
        <div className="flex gap-2">
          <Link to={createPageUrl("EventForm") + `?id=${event.id}`}>
            <Button variant="outline" size="sm"><Edit className="w-4 h-4 mr-1" />Edit</Button>
          </Link>
          <Select value={event.status} onValueChange={v => updateEvent("status", v)}>
            <SelectTrigger className="w-44 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-white border">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="music">Music ({musicSelections.length})</TabsTrigger>
          <TabsTrigger value="timeline">Timeline ({timeline.length})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Event Details</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                    <div><span className="text-gray-400">Type</span><p className="font-medium capitalize mt-0.5">{event.event_type?.replace(/_/g, " ")}</p></div>
                    <div><span className="text-gray-400">Time</span><p className="font-medium mt-0.5">{event.start_time || "TBD"} - {event.end_time || "TBD"}</p></div>
                    <div><span className="text-gray-400">Guests</span><p className="font-medium mt-0.5">{event.guest_count || "TBD"}</p></div>
                    <div><span className="text-gray-400">City</span><p className="font-medium mt-0.5">{event.city || "TBD"}</p></div>
                    <div><span className="text-gray-400">Package</span><p className="font-medium mt-0.5">{event.package_name || "TBD"}</p></div>
                    <div><span className="text-gray-400">Price</span><p className="font-medium mt-0.5">{event.package_price ? `$${event.package_price.toLocaleString()}` : "TBD"}</p></div>
                    <div><span className="text-gray-400">DJ</span><p className="font-medium mt-0.5">{event.assigned_dj || "Unassigned"}</p></div>
                    <div><span className="text-gray-400">MC</span><p className="font-medium mt-0.5">{event.assigned_mc || "Unassigned"}</p></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Contact</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-gray-400">Name</span><p className="font-medium mt-0.5">{event.contact_name || "—"}</p></div>
                    <div><span className="text-gray-400">Email</span><p className="font-medium mt-0.5">{event.contact_email || "—"}</p></div>
                    <div><span className="text-gray-400">Phone</span><p className="font-medium mt-0.5">{event.contact_phone || "—"}</p></div>
                  </div>
                </CardContent>
              </Card>
              {(event.internal_notes || event.equipment_notes) && (
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Notes</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {event.internal_notes && <div><span className="text-gray-400 text-xs">Internal</span><p className="mt-1 text-gray-600">{event.internal_notes}</p></div>}
                    {event.equipment_notes && <div><span className="text-gray-400 text-xs">Equipment</span><p className="mt-1 text-gray-600">{event.equipment_notes}</p></div>}
                  </CardContent>
                </Card>
              )}
            </div>
            <div className="space-y-6">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Checklist</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {checklist.map(item => (
                    <button
                      key={item.key}
                      onClick={() => updateEvent(item.key, !item.done)}
                      className="flex items-center gap-2.5 w-full p-2 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                    >
                      {item.done ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 text-gray-300" />}
                      <span className={item.done ? "text-gray-400 line-through" : "text-gray-700"}>{item.label}</span>
                    </button>
                  ))}
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

        <TabsContent value="activity">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex gap-2 mb-4">
                <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note..." rows={2} className="text-sm" />
                <Button onClick={addNote} disabled={addingNote || !noteText.trim()} size="sm" className="self-end">
                  {addingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
              <div className="space-y-3">
                {activities.map(a => (
                  <div key={a.id} className="flex gap-3 text-sm">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                    <div>
                      <p className="font-medium">{a.subject}</p>
                      {a.description && <p className="text-gray-500 mt-0.5">{a.description}</p>}
                      <p className="text-xs text-gray-300 mt-1">{format(new Date(a.created_date), "MMM d, h:mm a")}</p>
                    </div>
                  </div>
                ))}
                {activities.length === 0 && <p className="text-center text-gray-400 text-xs py-4">No activity yet</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}