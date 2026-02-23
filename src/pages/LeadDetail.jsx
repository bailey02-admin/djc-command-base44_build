import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import {
  ArrowLeft, Edit, Phone, Mail, Calendar, MapPin, User, DollarSign,
  MessageSquare, ClipboardList, Send, Loader2, CheckCircle2
} from "lucide-react";

const STATUS_OPTIONS = ["new","attempted_contact","contacted","qualified","proposal_sent","follow_up","booked","lost","ghosted","disqualified"];
const PIPELINE_OPTIONS = ["new_inquiry","qualified","consultation_scheduled","consultation_completed","quote_sent","negotiation","deposit_requested","booked","lost","nurture"];

export default function LeadDetail() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const queryClient = useQueryClient();

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const leads = await base44.entities.Lead.list();
      return leads.find(l => l.id === id);
    },
    enabled: !!id,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["activities", id],
    queryFn: () => base44.entities.Activity.filter({ related_id: id }, "-created_date", 50),
    enabled: !!id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", id],
    queryFn: () => base44.entities.Task.filter({ related_id: id }, "-created_date", 20),
    enabled: !!id,
  });

  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const updateLead = useMutation({
    mutationFn: ({ field, value }) => base44.entities.Lead.update(id, { [field]: value }),
    onSuccess: () => queryClient.invalidateQueries(["lead", id]),
  });

  const addActivity = async () => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    await base44.entities.Activity.create({
      type: "note",
      subject: "Note added",
      description: noteText,
      related_type: "lead",
      related_id: id,
      related_name: `${lead.client_first_name} ${lead.client_last_name}`,
    });
    setNoteText("");
    setAddingNote(false);
    queryClient.invalidateQueries(["activities", id]);
  };

  const convertToEvent = async () => {
    const event = await base44.entities.Event.create({
      event_name: `${lead.client_first_name} ${lead.client_last_name} - ${lead.event_type?.replace(/_/g, " ")}`,
      event_type: lead.event_type,
      event_date: lead.event_date,
      city: lead.city,
      venue_name: lead.venue_name,
      contact_name: `${lead.client_first_name} ${lead.client_last_name}`,
      contact_email: lead.email,
      contact_phone: lead.phone,
      lead_id: lead.id,
      guest_count: lead.guest_count,
      status: "booked",
    });
    await base44.entities.Lead.update(id, { status: "booked", pipeline_stage: "booked", event_id: event.id });
    queryClient.invalidateQueries(["lead", id]);
  };

  if (isLoading || !lead) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">
      <Link to={createPageUrl("Leads")} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to Leads
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {lead.client_first_name} {lead.client_last_name}
            {lead.partner_first_name && ` & ${lead.partner_first_name} ${lead.partner_last_name}`}
          </h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-500 flex-wrap">
            {lead.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{lead.email}</span>}
            {lead.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{lead.phone}</span>}
            {lead.city && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{lead.city}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={createPageUrl("LeadForm") + `?id=${lead.id}`}>
            <Button variant="outline" size="sm"><Edit className="w-4 h-4 mr-1" />Edit</Button>
          </Link>
          {lead.status !== "booked" && (
            <Button size="sm" onClick={convertToEvent} className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="w-4 h-4 mr-1" />Convert to Event
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status controls */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Status</label>
                  <Select value={lead.status} onValueChange={v => updateLead.mutate({ field: "status", value: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Pipeline Stage</label>
                  <Select value={lead.pipeline_stage} onValueChange={v => updateLead.mutate({ field: "pipeline_stage", value: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PIPELINE_OPTIONS.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Event details */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Event Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                <div><span className="text-gray-400">Type</span><p className="font-medium capitalize mt-0.5">{lead.event_type?.replace(/_/g, " ")}</p></div>
                <div><span className="text-gray-400">Date</span><p className="font-medium mt-0.5">{lead.event_date ? format(new Date(lead.event_date), "MMMM d, yyyy") : "TBD"}</p></div>
                <div><span className="text-gray-400">Venue</span><p className="font-medium mt-0.5">{lead.venue_name || "TBD"}</p></div>
                <div><span className="text-gray-400">Guest Count</span><p className="font-medium mt-0.5">{lead.guest_count || "TBD"}</p></div>
                <div><span className="text-gray-400">Budget</span><p className="font-medium mt-0.5 capitalize">{lead.budget_range?.replace(/_/g, " - ") || "Not specified"}</p></div>
                <div><span className="text-gray-400">Source</span><p className="font-medium mt-0.5 capitalize">{lead.lead_source?.replace(/_/g, " ")}</p></div>
              </div>
              {lead.notes && <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">{lead.notes}</div>}
            </CardContent>
          </Card>

          {/* Activity feed */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Add a note..."
                  rows={2}
                  className="text-sm"
                />
                <Button onClick={addActivity} disabled={addingNote || !noteText.trim()} size="sm" className="self-end">
                  {addingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
              <div className="space-y-3">
                {activities.map(act => (
                  <div key={act.id} className="flex gap-3 text-sm">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{act.subject}</p>
                      {act.description && <p className="text-gray-500 mt-0.5">{act.description}</p>}
                      <p className="text-xs text-gray-300 mt-1">{format(new Date(act.created_date), "MMM d, yyyy h:mm a")}</p>
                    </div>
                  </div>
                ))}
                {activities.length === 0 && <p className="text-center text-gray-400 text-xs py-4">No activity yet</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Quick Info</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Priority</span><Badge variant="secondary" className="capitalize">{lead.priority}</Badge></div>
              <div className="flex justify-between"><span className="text-gray-400">Assigned Rep</span><span className="font-medium">{lead.assigned_rep || "Unassigned"}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Created</span><span className="font-medium">{format(new Date(lead.created_date), "MMM d, yyyy")}</span></div>
              {lead.event_id && (
                <Link to={createPageUrl("EventDetail") + `?id=${lead.event_id}`} className="block mt-2">
                  <Button variant="outline" size="sm" className="w-full">View Event →</Button>
                </Link>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Tasks</CardTitle></CardHeader>
            <CardContent>
              {tasks.length > 0 ? tasks.map(t => (
                <div key={t.id} className="flex items-center gap-2 py-2 text-sm border-b last:border-0">
                  <div className={`w-2 h-2 rounded-full ${t.status === "completed" ? "bg-emerald-500" : "bg-amber-500"}`} />
                  <span className={t.status === "completed" ? "line-through text-gray-400" : "text-gray-700"}>{t.title}</span>
                </div>
              )) : <p className="text-xs text-gray-400 text-center py-4">No tasks</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}