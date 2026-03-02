import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LeadAPI, TaskAPI, ActivityAPI, ConversionAPI } from "../components/api/secureApi";

import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import {
  ArrowLeft, Edit, Phone, Mail, MapPin, DollarSign,
  CheckCircle2, Loader2, AlertCircle, Plus, ExternalLink
} from "lucide-react";
import { PIPELINE_STAGES, STAGE_MAP, calculateSLAStatus, SLA_BADGE } from "../components/crm/pipeline";
import { onStageChange, onEventBooked, logFirstResponse } from "../components/crm/automations";
import StageAdvancer from "../components/leads/StageAdvancer";
import SLABadge from "../components/leads/SLABadge";
import ActivityFeed from "../components/leads/ActivityFeed";
import NextBestAction from "../components/leads/NextBestAction";
import SendMessageModal from "../components/communication/SendMessageModal";

const LOST_REASONS = ["price","availability","competitor","no_response","changed_plans","diy","other"];

export default function LeadDetail() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const queryClient = useQueryClient();
  const [converting, setConverting] = useState(false);
  const [lostDialog, setLostDialog] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [lostDetail, setLostDetail] = useState("");
  const [sendMsgOpen, setSendMsgOpen] = useState(false);

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: () => LeadAPI.get(id),
    enabled: !!id,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["activities", id],
    queryFn: () => ActivityAPI.forRecord(id, 50),
    enabled: !!id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", id],
    queryFn: () => TaskAPI.forRecord(id, "-created_date", 20),
    enabled: !!id,
  });

  const updateLead = async (updates, newStage = null) => {
    const prevStage = lead.pipeline_stage;
    await LeadAPI.update(id, updates);
    queryClient.invalidateQueries(["lead", id]);

    if (newStage && newStage !== prevStage) {
      await onStageChange({ ...lead, ...updates }, newStage);
    }

    // Auto-set first response date if this is the first meaningful action
    if (!lead.first_response_date && ["contacted","qualified"].includes(newStage)) {
      await logFirstResponse(lead);
    }
  };

  const convertToEvent = async () => {
    setConverting(true);
    const res = await base44.functions.invoke("convertLeadToEvent", { lead_id: id });
    const { event } = res.data || {};
    if (event) await onEventBooked(event);
    queryClient.invalidateQueries(["lead", id]);
    setConverting(false);
  };

  const markLost = async () => {
    if (!lostReason) return;
    await LeadAPI.markLost(id, {
      status: "lost", pipeline_stage: "lost",
      lost_reason: lostReason, lost_reason_detail: lostDetail,
    });
    await ActivityAPI.create({
      type: "status_change",
      subject: `Marked Lost — ${lostReason.replace(/_/g, " ")}`,
      description: lostDetail,
      related_type: "lead", related_id: id,
      related_name: `${lead.client_first_name} ${lead.client_last_name}`,
      is_internal: true,
    });
    setLostDialog(false);
    queryClient.invalidateQueries(["lead", id]);
  };

  if (isLoading || !lead) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-violet-600" /></div>;

  const stage = STAGE_MAP[lead.pipeline_stage] || STAGE_MAP["new_inquiry"];

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
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {lead.email && <span className="text-sm text-gray-500 flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{lead.email}</span>}
            {lead.phone && <span className="text-sm text-gray-500 flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{lead.phone}</span>}
            {lead.city && <span className="text-sm text-gray-500 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{lead.city}</span>}
          </div>
          <div className="flex gap-2 mt-2 flex-wrap">
            <Badge className={`text-xs ${stage.color}`}>{stage.label}</Badge>
            <SLABadge lead={lead} />
            {lead.priority === "urgent" && <Badge className="bg-red-100 text-red-700 text-xs">🔥 Urgent</Badge>}
            {lead.duplicate_of && (
              <Link to={createPageUrl("LeadDetail") + `?id=${lead.duplicate_of}`}>
                <Badge className="bg-amber-100 text-amber-700 text-xs cursor-pointer hover:bg-amber-200">
                  ⚠ Duplicate — view original
                </Badge>
              </Link>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to={createPageUrl("LeadForm") + `?id=${lead.id}`}>
            <Button variant="outline" size="sm"><Edit className="w-4 h-4 mr-1" />Edit</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => setSendMsgOpen(true)}>
            <Mail className="w-4 h-4 mr-1" />Send Message
          </Button>
          <StageAdvancer lead={lead} onUpdate={updateLead} />
          {lead.pipeline_stage !== "lost" && lead.pipeline_stage !== "booked" && (
            <Button size="sm" variant="outline" onClick={() => setLostDialog(true)} className="border-red-200 text-red-600 hover:bg-red-50">
              Mark Lost
            </Button>
          )}
          {lead.pipeline_stage === "deposit_requested" && !lead.event_id && (
            <Button size="sm" onClick={convertToEvent} disabled={converting} className="bg-emerald-600 hover:bg-emerald-700">
              {converting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Convert → Event
            </Button>
          )}
          {lead.event_id && (
            <Link to={createPageUrl("EventDetail") + `?id=${lead.event_id}`}>
              <Button size="sm" variant="outline" className="border-emerald-200 text-emerald-700">
                <ExternalLink className="w-3.5 h-3.5 mr-1" /> View Event
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Pipeline progress bar */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 overflow-x-auto">
        <div className="flex items-center gap-0 min-w-max">
          {PIPELINE_STAGES.filter(s => !["ghosted","disqualified"].includes(s.key)).map((s, i, arr) => {
            const stages = arr.map(x => x.key);
            const currentIdx = stages.indexOf(lead.pipeline_stage);
            const stageIdx = stages.indexOf(s.key);
            const isPast = stageIdx < currentIdx;
            const isCurrent = stageIdx === currentIdx;
            return (
              <React.Fragment key={s.key}>
                <div className={`flex flex-col items-center gap-1 px-2 ${isCurrent ? "opacity-100" : isPast ? "opacity-70" : "opacity-30"}`}>
                  <div className={`w-3 h-3 rounded-full ${isCurrent ? s.dot : isPast ? "bg-emerald-400" : "bg-gray-200"}`} />
                  <span className={`text-[9px] font-medium ${isCurrent ? "text-violet-700" : isPast ? "text-gray-400" : "text-gray-300"} whitespace-nowrap`}>{s.label}</span>
                </div>
                {i < arr.length - 1 && <div className={`h-px w-6 flex-shrink-0 ${stageIdx < currentIdx ? "bg-emerald-300" : "bg-gray-200"}`} />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Quick stage controls */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5 grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-gray-400">Pipeline Stage</Label>
                <Select value={lead.pipeline_stage} onValueChange={v => updateLead({ pipeline_stage: v }, v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PIPELINE_STAGES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-400">Assigned Rep</Label>
                <Input value={lead.assigned_rep || ""} onChange={e => updateLead({ assigned_rep: e.target.value })} className="mt-1 text-sm" placeholder="rep@company.com" />
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="activity">
            <TabsList className="bg-white border">
              <TabsTrigger value="activity">Activity ({activities.length})</TabsTrigger>
              <TabsTrigger value="details">Event Details</TabsTrigger>
              <TabsTrigger value="attribution">Attribution</TabsTrigger>
            </TabsList>

            <TabsContent value="activity" className="mt-4">
              <ActivityFeed
                activities={activities}
                relatedId={id}
                relatedName={`${lead.client_first_name} ${lead.client_last_name}`}
                relatedType="lead"
                queryKey="activities"
              />
            </TabsContent>

            <TabsContent value="details" className="mt-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                    <div><span className="text-gray-400 text-xs">Type</span><p className="font-medium capitalize mt-0.5">{lead.event_type?.replace(/_/g, " ")}</p></div>
                    <div><span className="text-gray-400 text-xs">Date</span><p className="font-medium mt-0.5">{lead.event_date ? format(new Date(lead.event_date), "MMMM d, yyyy") : "TBD"}</p></div>
                    <div><span className="text-gray-400 text-xs">Venue</span><p className="font-medium mt-0.5">{lead.venue_name || "TBD"}</p></div>
                    <div><span className="text-gray-400 text-xs">Guests</span><p className="font-medium mt-0.5">{lead.guest_count || "TBD"}</p></div>
                    <div><span className="text-gray-400 text-xs">Budget</span><p className="font-medium mt-0.5 capitalize">{lead.budget_range?.replace(/_/g, " - ") || "Not specified"}</p></div>
                    <div><span className="text-gray-400 text-xs">Source</span><p className="font-medium mt-0.5 capitalize">{lead.lead_source?.replace(/_/g, " ")}</p></div>
                    {lead.quote_amount && <div><span className="text-gray-400 text-xs">Quote</span><p className="font-medium mt-0.5">${lead.quote_amount?.toLocaleString()}</p></div>}
                    {lead.total_fee && <div><span className="text-gray-400 text-xs">Total Fee</span><p className="font-medium mt-0.5">${lead.total_fee?.toLocaleString()}</p></div>}
                    {lead.deposit_amount && <div><span className="text-gray-400 text-xs">Deposit</span><p className="font-medium mt-0.5">${lead.deposit_amount?.toLocaleString()}</p></div>}
                    <div><span className="text-gray-400 text-xs">Package</span><p className="font-medium mt-0.5">{lead.package_name || "TBD"}</p></div>
                  </div>
                  {lead.notes && <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">{lead.notes}</div>}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="attribution" className="mt-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-gray-400 text-xs">Source</span><p className="font-medium mt-0.5 capitalize">{lead.lead_source?.replace(/_/g, " ") || "—"}</p></div>
                    <div><span className="text-gray-400 text-xs">Source Detail</span><p className="font-medium mt-0.5">{lead.source_detail || "—"}</p></div>
                    <div><span className="text-gray-400 text-xs">UTM Source</span><p className="font-medium mt-0.5">{lead.utm_source || "—"}</p></div>
                    <div><span className="text-gray-400 text-xs">UTM Campaign</span><p className="font-medium mt-0.5">{lead.utm_campaign || "—"}</p></div>
                    <div><span className="text-gray-400 text-xs">UTM Medium</span><p className="font-medium mt-0.5">{lead.utm_medium || "—"}</p></div>
                    <div><span className="text-gray-400 text-xs">GCLID</span><p className="font-mono text-xs mt-0.5 truncate">{lead.gclid || "—"}</p></div>
                    <div><span className="text-gray-400 text-xs">FBCLID</span><p className="font-mono text-xs mt-0.5 truncate">{lead.fbclid || "—"}</p></div>
                    <div><span className="text-gray-400 text-xs">Landing Page</span><p className="font-medium mt-0.5 truncate">{lead.landing_page_url || "—"}</p></div>
                    {lead.inquiry_date && <div><span className="text-gray-400 text-xs">Inquiry Date</span><p className="font-medium mt-0.5">{format(new Date(lead.inquiry_date), "MMM d, h:mm a")}</p></div>}
                    {lead.booked_date && <div><span className="text-gray-400 text-xs">Booked Date</span><p className="font-medium mt-0.5">{format(new Date(lead.booked_date), "MMM d, yyyy")}</p></div>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
            {/* Next Best Action */}
          <NextBestAction lead={lead} tasks={tasks} />

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">SLA & Timing</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Inquiry</span><span>{lead.inquiry_date ? format(new Date(lead.inquiry_date), "MMM d, h:mm a") : "—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">First Response</span><span>{lead.first_response_date ? format(new Date(lead.first_response_date), "MMM d, h:mm a") : <span className="text-red-500">Not logged</span>}</span></div>
              {lead.sla_minutes_elapsed && <div className="flex justify-between"><span className="text-gray-400">Response Time</span><span className="font-medium">{lead.sla_minutes_elapsed}m</span></div>}
              <div className="flex justify-between"><span className="text-gray-400">Attempts</span><span>{lead.no_response_count || 0}</span></div>
              {lead.last_contact_date && <div className="flex justify-between"><span className="text-gray-400">Last Contact</span><span>{format(new Date(lead.last_contact_date), "MMM d")}</span></div>}
              {!lead.first_response_date && (
                <Button
                  size="sm"
                  className="w-full mt-1 text-xs bg-violet-600 hover:bg-violet-700"
                  onClick={async () => {
                    await logFirstResponse(lead);
                    queryClient.invalidateQueries(["lead", id]);
                  }}
                >
                  Log First Response Now
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Quick Info</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between items-center"><span className="text-gray-400">Lead ID</span><span className="font-mono text-[10px] text-gray-500 select-all">{lead.lead_id || lead.id}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Priority</span><Badge variant="secondary" className="capitalize">{lead.priority}</Badge></div>
              <div className="flex justify-between"><span className="text-gray-400">Preferred Contact</span><span className="capitalize">{lead.preferred_contact_method || "any"}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Created</span><span>{format(new Date(lead.created_date), "MMM d, yyyy")}</span></div>
              {lead.next_follow_up_date && <div className="flex justify-between"><span className="text-gray-400">Follow Up</span><span className="text-violet-700 font-medium">{format(new Date(lead.next_follow_up_date), "MMM d")}</span></div>}
              {lead.lost_reason && <div className="flex justify-between items-start"><span className="text-gray-400">Lost Reason</span><span className="text-red-600 capitalize">{lead.lost_reason.replace(/_/g, " ")}</span></div>}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Tasks ({tasks.length})</CardTitle></CardHeader>
            <CardContent>
              {tasks.length > 0 ? tasks.slice(0, 5).map(t => (
                <div key={t.id} className="flex items-center gap-2 py-1.5 text-xs border-b last:border-0">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.status === "completed" ? "bg-emerald-400" : t.priority === "urgent" ? "bg-red-400" : "bg-amber-400"}`} />
                  <span className={t.status === "completed" ? "line-through text-gray-400" : "text-gray-700"}>{t.title}</span>
                </div>
              )) : <p className="text-xs text-gray-400 text-center py-2">No tasks</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Send Message Modal */}
      <SendMessageModal
        open={sendMsgOpen}
        onClose={() => setSendMsgOpen(false)}
        lead={lead}
        relatedType="lead"
        relatedId={id}
        relatedName={`${lead.client_first_name} ${lead.client_last_name}`}
      />

      {/* Mark Lost Dialog */}
      <Dialog open={lostDialog} onOpenChange={setLostDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark Lead as Lost</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Lost Reason *</Label>
              <Select value={lostReason} onValueChange={setLostReason}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select reason" /></SelectTrigger>
                <SelectContent>
                  {LOST_REASONS.map(r => <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Additional Notes</Label>
              <Input value={lostDetail} onChange={e => setLostDetail(e.target.value)} placeholder="Optional details..." className="mt-1" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setLostDialog(false)}>Cancel</Button>
              <Button onClick={markLost} disabled={!lostReason} className="bg-red-600 hover:bg-red-700">Mark Lost</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}