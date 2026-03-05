import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useStatusSettings } from "@/components/hooks/useStatusSettings";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EventAPI } from "@/components/api/secureApi";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, differenceInDays } from "date-fns";
import {
  ArrowLeft, Edit, CalendarDays, MapPin, Music, Clock,
  DollarSign, Loader2, AlertTriangle, Send, History, ExternalLink,
  Layers, Phone, Mail, User, Building2, CheckCircle2, XCircle,
  FileText, Printer, Plus
} from "lucide-react";
import ReadinessPanel from "@/components/events/ReadinessPanel";
import FinalizationChecklist from "@/components/events/FinalizationChecklist";
import StaffAssignmentCard from "@/components/events/StaffAssignmentCard";
import ChangeHistoryPanel from "@/components/events/ChangeHistoryPanel";
import EventNextBestAction from "@/components/events/EventNextBestAction";
import ActivityFeed from "@/components/leads/ActivityFeed";
import SendMessageModal from "@/components/communication/SendMessageModal";
import { calculateReadinessScore } from "@/components/crm/pipeline";
import { trackEventChanges } from "@/components/crm/changeTracker";

// Status options/colors now come from useStatusSettings hook (loaded in component)

function InfoRow({ label, value, mono, className }) {
  if (!value && value !== 0) return null;
  return (
    <div className={className}>
      <span className="text-gray-400 text-xs block">{label}</span>
      <p className={`font-medium mt-0.5 text-sm ${mono ? "font-mono text-[11px] text-gray-500 select-all" : ""}`}>{value}</p>
    </div>
  );
}

function BoolBadge({ label, value }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {value
        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        : <XCircle className="w-3.5 h-3.5 text-gray-200" />}
      <span className={value ? "text-emerald-700" : "text-gray-400"}>{label}</span>
    </div>
  );
}

export default function EventDetail() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const queryClient = useQueryClient();
  const [sendMsgOpen, setSendMsgOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [impersonating, setImpersonating] = useState(false);
  const [impersonateError, setImpersonateError] = useState(null);
  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const { statusColor, statusLabel, statusOptions } = useStatusSettings();

  const canImpersonate = user && ["admin","city_manager","office_finalizer"].includes(user.role);
  const canSeeFinance = user && ["admin","city_manager","sales_manager","finance"].includes(user.role);
  const canEditEvent = user && ["admin","city_manager","sales_manager","office_finalizer"].includes(user.role);
  const canManageStaff = user && ["admin","city_manager","sales_manager"].includes(user.role);

  const handleViewAsClient = async () => {
    setImpersonating(true); setImpersonateError(null);
    try {
      const res = await base44.functions.invoke("createImpersonationSession", { event_id: id });
      if (res.data?.ok && res.data?.redirect_url) window.open(res.data.redirect_url, "_blank");
      else setImpersonateError(res.data?.error || "Failed to create session");
    } catch (e) { setImpersonateError(e?.response?.data?.error || "Not authorized"); }
    finally { setImpersonating(false); }
  };

  const { data: bundle, isLoading } = useQuery({
    queryKey: ["event-bundle", id],
    queryFn: () => EventAPI.getDetailBundle(id),
    enabled: !!id,
  });

  const event = bundle?.event;
  const contact = bundle?.contact || null;
  const activities = bundle?.activities || [];
  const musicSelections = bundle?.musicSelections || [];
  const timeline = bundle?.timeline || [];
  const payments = bundle?.payments || [];
  const tasks = bundle?.tasks || [];
  const paymentsSummary = bundle?.payments_summary || null;
  const leadSummary = bundle?.lead_summary || null;
  const quoteSummary = bundle?.quote_summary || null;

  // Compute balance from payments or summary
  const totalFee = event?.total_fee ?? event?.package_price ?? 0;
  const amountPaid = paymentsSummary?.amount_paid_total
    ?? payments.filter(p => p.status === "paid").reduce((s, p) => s + (p.amount || 0), 0);
  const balanceDue = Math.max(0, totalFee - amountPaid);

  const updateEvent = async (field, value) => {
    await trackEventChanges(event, { [field]: value }, user?.email || "");
    await EventAPI.update(id, { [field]: value });
    queryClient.invalidateQueries(["event-bundle", id]);
    queryClient.invalidateQueries(["change-history", id]);
  };

  const updateReadinessItem = async (key, value) => {
    const update = { [key]: value };
    const updatedEvent = { ...event, ...update };
    const newScore = calculateReadinessScore(updatedEvent);
    await trackEventChanges(event, update, user?.email || "");
    await EventAPI.toggleReadiness(id, { ...update, readiness_score: newScore });
    queryClient.invalidateQueries(["event-bundle", id]);
    queryClient.invalidateQueries(["change-history", id]);
  };

  const markDJReviewed = async () => {
    await EventAPI.markDJReviewed(id);
    queryClient.invalidateQueries(["event-bundle", id]);
  };

  if (isLoading || !bundle) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-violet-600" /></div>;
  if (!event) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Event not found or access denied.</div>;

  const daysUntil = event.event_date ? differenceInDays(new Date(event.event_date), new Date()) : null;
  const readiness = calculateReadinessScore(event);

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-5">
      <Link to={createPageUrl("Events")} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to Events
      </Link>

      {/* Warning banner */}
      {event.client_changed_after_review && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="font-medium">Client edited details after DJ review.</span>
          <span className="text-amber-700">Re-brief the DJ and confirm all changes.</span>
          <Button size="sm" variant="outline" onClick={markDJReviewed} className="ml-auto border-amber-400 text-amber-700 hover:bg-amber-100 text-xs">
            Mark Reviewed Again
          </Button>
        </div>
      )}

      {/* ─── Sticky Header ─── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{event.event_name}</h1>
              <Badge variant="outline" className={`text-xs ${statusColor(event.status)}`}>
                {statusLabel(event.status)}
                {event.city ? ` – ${event.city}` : ""}
              </Badge>
              {daysUntil !== null && (
                <Badge variant="outline" className={`text-xs ${daysUntil <= 7 ? "border-red-200 text-red-600" : daysUntil <= 30 ? "border-amber-200 text-amber-700" : "border-gray-200 text-gray-500"}`}>
                  {daysUntil === 0 ? "Today!" : daysUntil < 0 ? `${Math.abs(daysUntil)}d ago` : `${daysUntil}d`}
                </Badge>
              )}
              <Badge variant="outline" className={`text-xs ${readiness >= 80 ? "border-emerald-200 text-emerald-700" : readiness >= 50 ? "border-amber-200 text-amber-700" : "border-red-200 text-red-600"}`}>
                {readiness}% Ready
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-1.5 text-sm text-gray-500 flex-wrap">
              {event.event_date && <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />{format(new Date(event.event_date), "EEEE, MMMM d, yyyy")}</span>}
              {event.venue_name && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{event.venue_name}</span>}
              {event.start_time && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{event.start_time}{event.end_time ? ` – ${event.end_time}` : ""}</span>}
            </div>
          </div>

          {/* CTAs */}
          <div className="flex gap-2 flex-wrap shrink-0">
            {canEditEvent && (
              <Link to={createPageUrl("EventForm") + `?id=${event.id}`}>
                <Button variant="outline" size="sm"><Edit className="w-4 h-4 mr-1" />Edit</Button>
              </Link>
            )}
            <Button variant="outline" size="sm" onClick={() => setSendMsgOpen(true)}>
              <Send className="w-4 h-4 mr-1" />Message
            </Button>
            <Link to={createPageUrl("StaffPlanningHub") + `?event_id=${id}`}>
              <Button variant="outline" size="sm" className="border-violet-200 text-violet-700 hover:bg-violet-50">
                <Layers className="w-3.5 h-3.5 mr-1" /> Planning
              </Button>
            </Link>
            {!event.client_changed_after_review && (
              <Button variant="outline" size="sm" onClick={markDJReviewed} className="border-violet-200 text-violet-700 hover:bg-violet-50 text-xs">
                ✅ DJ Reviewed
              </Button>
            )}
            {canImpersonate && event.contact_id && (
              <Button variant="outline" size="sm" onClick={handleViewAsClient} disabled={impersonating}
                className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs gap-1">
                {impersonating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                View as Client
              </Button>
            )}
            {impersonateError && <span className="text-xs text-red-600 self-center">⚠ {impersonateError}</span>}
            {/* Status quick-change */}
            <Select value={event.status} onValueChange={v => updateEvent("status", v)}>
              <SelectTrigger className="w-48 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusOptions.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-white border flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="client">Client</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="finalization">Finalization</TabsTrigger>
          <TabsTrigger value="music">Music ({musicSelections.length})</TabsTrigger>
          <TabsTrigger value="timeline">Timeline ({timeline.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity ({activities.length})</TabsTrigger>
          <TabsTrigger value="history"><History className="w-3 h-3 mr-1" />Changes</TabsTrigger>
        </TabsList>

        {/* ─── Overview ─── */}
         <TabsContent value="overview">
           <div className="grid lg:grid-cols-3 gap-5">
             <div className="lg:col-span-2 space-y-4">

               {/* Lead & Salesperson */}
               {leadSummary && (
                 <Card className="border-0 shadow-sm">
                   <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><User className="w-4 h-4 text-violet-500" />Lead & Salesperson</CardTitle></CardHeader>
                   <CardContent>
                     <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                       <InfoRow label="Client" value={leadSummary.client_name} />
                       <InfoRow label="Salesperson" value={leadSummary.assigned_rep ? (leadSummary.assigned_rep.includes("@") ? leadSummary.assigned_rep.split("@")[0] : leadSummary.assigned_rep) : "—"} />
                       <InfoRow label="Inquiry Source" value={leadSummary.lead_source ? leadSummary.lead_source.replace(/_/g, " ") : "—"} className="capitalize" />
                       <InfoRow label="Inquiry Date" value={leadSummary.inquiry_date ? format(new Date(leadSummary.inquiry_date), "MMM d, yyyy") : "—"} />
                     </div>
                   </CardContent>
                 </Card>
               )}

               {/* Quote Summary */}
               {quoteSummary && (
                 <Card className="border-0 shadow-sm">
                   <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-violet-500" />Quote Summary</CardTitle></CardHeader>
                   <CardContent>
                     <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                       <InfoRow label="Status" value={quoteSummary.status?.replace(/_/g, " ")} className="capitalize" />
                       <InfoRow label="Total Amount" value={quoteSummary.total_amount ? `$${quoteSummary.total_amount.toLocaleString()}` : "—"} />
                       <InfoRow label="Valid Until" value={quoteSummary.valid_until ? format(new Date(quoteSummary.valid_until), "MMM d, yyyy") : "—"} />
                     </div>
                   </CardContent>
                 </Card>
               )}

               {/* A) Event Summary */}
               <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><CalendarDays className="w-4 h-4 text-violet-500" />Event Summary</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                    <InfoRow label="Event ID" value={event.event_id || event.id} mono />
                    <InfoRow label="Lead ID" value={event.lead_id} mono />
                    <InfoRow label="Type" value={event.event_type?.replace(/_/g, " ")} className="capitalize" />
                    <InfoRow label="Date" value={event.event_date ? format(new Date(event.event_date), "MMM d, yyyy") : null} />
                    <InfoRow label="Setup Time" value={event.setup_time} />
                    <InfoRow label="Start Time" value={event.start_time} />
                    <InfoRow label="End Time" value={event.end_time} />
                    <InfoRow label="Guest Count" value={event.guest_count} />
                    <InfoRow label="City" value={event.city} />
                    <InfoRow label="Package" value={event.package_name} />
                    <InfoRow label="Final Call Date" value={event.final_call_date} />
                    <InfoRow label="Booked Date" value={event.booked_date} />
                  </div>
                </CardContent>
              </Card>

              {/* C) Venue */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Building2 className="w-4 h-4 text-violet-500" />Venue</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <InfoRow label="Reception Venue" value={event.venue_name} />
                    <InfoRow label="Ceremony Venue" value={event.ceremony_venue} />
                    <InfoRow label="Load-in Notes" value={event.load_in_notes} />
                    <InfoRow label="Equipment Notes" value={event.equipment_notes} />
                  </div>
                  {event.venue_name && (
                    <a href={`https://maps.google.com/?q=${encodeURIComponent(event.venue_name)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                      <MapPin className="w-3 h-3" /> Directions
                    </a>
                  )}
                </CardContent>
              </Card>

              {/* G) Notes */}
              {(event.internal_notes || event.client_notes) && (
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Notes</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {event.internal_notes && (
                      <div className="bg-amber-50 rounded-lg p-3 border-l-4 border-amber-400">
                        <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">Internal Notes</p>
                        <p className="text-sm text-gray-700">{event.internal_notes}</p>
                      </div>
                    )}
                    {event.client_notes && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Client Notes</p>
                        <p className="text-sm text-gray-700">{event.client_notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* I) Planning Hub links */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Layers className="w-4 h-4 text-violet-500" />Planning Hub</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Link to={createPageUrl("StaffPlanningHub") + `?event_id=${id}`}>
                      <Button variant="outline" size="sm" className="text-xs">Planning Hub</Button>
                    </Link>
                    <Link to={createPageUrl("StaffMusicManager") + `?event_id=${id}`}>
                      <Button variant="outline" size="sm" className="text-xs">Music Manager</Button>
                    </Link>
                    <Link to={createPageUrl("StaffTimelineManager") + `?event_id=${id}`}>
                      <Button variant="outline" size="sm" className="text-xs">Timeline Manager</Button>
                    </Link>
                    <Link to={createPageUrl("StaffPrint") + `?event_id=${id}`}>
                      <Button variant="outline" size="sm" className="text-xs gap-1"><Printer className="w-3 h-3" />Print Sheet</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right sidebar */}
            <div className="space-y-4">
              <EventNextBestAction event={event} tasks={tasks} />
              {canManageStaff && (
                <StaffAssignmentCard event={event} onSaved={() => queryClient.invalidateQueries(["event-bundle", id])} />
              )}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Readiness</CardTitle></CardHeader>
                <CardContent>
                  <ReadinessPanel event={event} onToggle={updateReadinessItem} />
                </CardContent>
              </Card>
              {/* Checklist booleans quick-view */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Checklist</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      ["Contract Signed", event.contract_signed],
                      ["Deposit Paid", event.deposit_paid],
                      ["Balance Paid", event.balance_paid],
                      ["Planning Done", event.planning_complete],
                      ["Timeline Done", event.timeline_complete],
                      ["Music Done", event.music_complete],
                      ["Final Call", event.final_call_completed],
                      ["DJ Briefed", event.dj_briefed],
                    ].map(([label, val]) => <BoolBadge key={label} label={label} value={val} />)}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ─── Client Tab ─── */}
        <TabsContent value="client">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="w-4 h-4 text-violet-500" />Client / Contact
                {contact && <span className="text-[10px] font-normal text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">Contact Linked</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                <InfoRow label="Name" value={contact ? `${contact.first_name} ${contact.last_name}` : (event.contact_name || null)} />
                <InfoRow label="Email" value={contact?.email || event.contact_email} />
                <InfoRow label="Phone" value={contact?.phone || event.contact_phone} />
                <InfoRow label="Secondary Phone" value={contact?.secondary_phone} />
                <InfoRow label="Preferred Contact" value={contact?.preferred_contact_method} />
                {contact?.id && <InfoRow label="Contact ID" value={contact.id} mono />}
              </div>
              {contact?.email && (
                <div className="flex gap-2 mt-4">
                  <a href={`mailto:${contact.email}`}>
                    <Button variant="outline" size="sm" className="text-xs gap-1"><Mail className="w-3 h-3" />Email</Button>
                  </a>
                  {(contact?.phone || event.contact_phone) && (
                    <a href={`tel:${contact?.phone || event.contact_phone}`}>
                      <Button variant="outline" size="sm" className="text-xs gap-1"><Phone className="w-3 h-3" />Call</Button>
                    </a>
                  )}
                </div>
              )}
              {canImpersonate && event.contact_id && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Client Portal</p>
                  <Button variant="outline" size="sm" onClick={handleViewAsClient} disabled={impersonating}
                    className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs gap-1">
                    {impersonating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                    View as Client
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Financial Tab ─── */}
        <TabsContent value="financial">
          <div className="space-y-4">
            {canSeeFinance ? (
              <>
                {/* Financial Snapshot Card */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2"><DollarSign className="w-4 h-4 text-violet-500" />Financial Snapshot</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm mb-4">
                      <InfoRow label="Package Name" value={event.package_name} />
                      <InfoRow label="Total Fee" value={event.total_fee ? `$${event.total_fee.toLocaleString()}` : "—"} />
                      <InfoRow label="Discount Amount" value={event.discount_amount ? `$${event.discount_amount.toLocaleString()}` : "—"} />
                      <InfoRow label="Discount Reason" value={event.discount_reason} />
                      <InfoRow label="Tax Amount" value={event.tax_amount ? `$${event.tax_amount.toLocaleString()}` : "—"} />
                      {event.add_ons && event.add_ons.length > 0 && (
                        <InfoRow label="Add-ons" value={`${event.add_ons.length} item(s)`} />
                      )}
                    </div>
                    {event.add_ons && event.add_ons.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Add-ons</p>
                        <div className="space-y-1">
                          {event.add_ons.map((addon, idx) => (
                            <div key={idx} className="text-xs text-gray-600 flex justify-between">
                              <span>{addon.name}</span>
                              <span className="text-gray-400">
                                {addon.qty ? `x${addon.qty}` : ""} 
                                {addon.amount ? ` – $${(addon.amount * (addon.qty || 1)).toLocaleString()}` : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Summary card */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2"><DollarSign className="w-4 h-4 text-violet-500" />Payment Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-400 mb-1">Total Fee</p>
                        <p className="text-lg font-bold text-gray-900">{totalFee ? `$${totalFee.toLocaleString()}` : "—"}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-400 mb-1">Amount Paid</p>
                        <p className="text-lg font-bold text-emerald-700">${amountPaid.toLocaleString()}</p>
                      </div>
                      <div className={`rounded-lg p-3 ${balanceDue > 0 ? "bg-rose-50" : "bg-emerald-50"}`}>
                        <p className="text-xs text-gray-400 mb-1">Balance Due</p>
                        <p className={`text-lg font-bold ${balanceDue > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                          ${balanceDue.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {/* Payment ledger */}
                    {payments.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead><tr className="text-left text-xs text-gray-400 border-b">
                          <th className="pb-2 font-medium">Type</th>
                          <th className="pb-2 font-medium">Amount</th>
                          <th className="pb-2 font-medium">Due</th>
                          <th className="pb-2 font-medium">Paid</th>
                          <th className="pb-2 font-medium">Status</th>
                          <th className="pb-2 font-medium">Method</th>
                        </tr></thead>
                        <tbody className="divide-y divide-gray-50">
                          {payments.map(p => (
                            <tr key={p.id}>
                              <td className="py-2.5 capitalize text-gray-700">{p.payment_type?.replace(/_/g, " ")}</td>
                              <td className="py-2.5 font-semibold">${p.amount?.toLocaleString()}</td>
                              <td className="py-2.5 text-gray-400 text-xs">{p.due_date ? format(new Date(p.due_date), "MMM d, yy") : "—"}</td>
                              <td className="py-2.5 text-gray-400 text-xs">{p.paid_date ? format(new Date(p.paid_date), "MMM d, yy") : "—"}</td>
                              <td className="py-2.5">
                                <Badge variant="secondary" className={`text-[10px] ${
                                  p.status === "paid" ? "bg-emerald-50 text-emerald-700" :
                                  p.status === "overdue" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                                  {p.status}
                                </Badge>
                              </td>
                              <td className="py-2.5 text-gray-400 text-xs capitalize">{p.payment_method?.replace(/_/g, " ") || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : paymentsSummary ? (
                      <p className="text-xs text-gray-400 text-center py-4">Payment summary only (access-limited)</p>
                    ) : (
                      <p className="text-center py-6 text-gray-400 text-sm">No payments recorded.</p>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-12 text-center text-gray-400 text-sm">
                  Financial details are restricted for your role.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ─── Finalization Tab ─── */}
        <TabsContent value="finalization">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <FinalizationChecklist event={event} onToggle={updateReadinessItem} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Music Tab ─── */}
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

        {/* ─── Timeline Tab ─── */}
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
                <div className="space-y-0">
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

        {/* ─── Activity Tab ─── */}
        <TabsContent value="activity">
          <ActivityFeed
            activities={activities}
            relatedId={id}
            relatedName={event.event_name}
            relatedType="event"
            queryKey="event-activities"
          />
        </TabsContent>

        {/* ─── Change History Tab ─── */}
        <TabsContent value="history">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Change History</CardTitle></CardHeader>
            <CardContent><ChangeHistoryPanel eventId={id} /></CardContent>
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