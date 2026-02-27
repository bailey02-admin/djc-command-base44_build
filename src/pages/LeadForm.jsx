import React, { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { LeadAPI } from "../components/api/secureApi";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Loader2, Phone } from "lucide-react";
import { onNewLead } from "../components/crm/automations";
import DuplicateWarning from "../components/leads/DuplicateWarning";
import { useLabels, LEAD_STATUSES } from "../components/crm/labelMap";

const EVENT_TYPES = ["wedding","corporate","school_dance","private_party","birthday","anniversary","mitzvah","quinceañera","holiday_party","other"];
const LEAD_SOURCES = ["website","google_ads","meta_ads","referral","bridal_show","the_knot","weddingwire","yelp","phone_call","walk_in","vendor_referral","repeat_client","other"];
const BUDGETS = ["under_500","500_1000","1000_1500","1500_2000","2000_3000","3000_plus","not_specified"];
const PRIORITIES = ["low","medium","high","urgent"];

const EMPTY = {
  client_first_name: "", client_last_name: "", partner_first_name: "", partner_last_name: "",
  email: "", phone: "", event_date: "", event_type: "wedding", city: "", venue_name: "",
  budget_range: "not_specified", guest_count: "", lead_source: "", source_detail: "",
  utm_source: "", utm_medium: "", utm_campaign: "", utm_content: "", utm_term: "",
  gclid: "", fbclid: "", landing_page_url: "",
  priority: "medium", assigned_rep: "", notes: "",
  preferred_contact_method: "any", inquiry_date: "",
  lead_status: "web_lead", do_not_call: false, x_date_followup_at: "",
};

export default function LeadForm() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [showAttribution, setShowAttribution] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const editId = params.get("id");
  const [form, setForm] = useState(EMPTY);
  const [duplicates, setDuplicates] = useState([]);
  const [dupRisk, setDupRisk] = useState("none");
  const [dupDismissed, setDupDismissed] = useState(false);
  const [linkedDuplicateOf, setLinkedDuplicateOf] = useState(null);
  const dupCheckTimer = useRef(null);
  const { label, optionsFor } = useLabels();

  useEffect(() => {
    if (editId) {
      LeadAPI.get(editId).then(l => {
        if (l) setForm(prev => ({ ...prev, ...l, guest_count: l.guest_count?.toString() || "" }));
      });
    } else {
      setForm(prev => ({ ...prev, inquiry_date: new Date().toISOString() }));
    }
  }, [editId]);

  const checkDuplicates = useCallback((nextForm) => {
    if (editId) return;
    if (!nextForm.email && !nextForm.phone) return;
    clearTimeout(dupCheckTimer.current);
    dupCheckTimer.current = setTimeout(async () => {
      const r = await base44.functions.invoke("checkDuplicateLeads", {
        email: nextForm.email, phone: nextForm.phone,
        event_date: nextForm.event_date,
        client_first_name: nextForm.client_first_name,
        client_last_name: nextForm.client_last_name,
      });
      const data = r.data || {};
      setDuplicates(data.duplicates || []);
      setDupRisk(data.risk || "none");
      setDupDismissed(false);
    }, 600);
  }, [editId]);

  const set = (field, value) => {
    const next = { ...form, [field]: value };
    setForm(next);
    if (["email","phone","event_date","client_first_name","client_last_name"].includes(field)) {
      checkDuplicates(next);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.lead_status === "x_dated" && !form.x_date_followup_at) {
      alert("X Dated leads require a follow-up date.");
      return;
    }
    setSaving(true);
    const data = {
      ...form,
      guest_count: form.guest_count ? Number(form.guest_count) : undefined,
      inquiry_date: form.inquiry_date || new Date().toISOString(),
      sla_status: "on_time",
    };
    if (editId) {
      await LeadAPI.update(editId, data);
    } else {
      const payload = { ...data };
      if (linkedDuplicateOf) payload.duplicate_of = linkedDuplicateOf;
      const lead = await LeadAPI.create(payload);
      await onNewLead(lead);
    }
    navigate(createPageUrl("Leads"));
  };

  const leadStatusOptions = optionsFor("lead_status");

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <Link to={createPageUrl("Leads")} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Leads
      </Link>
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{editId ? "Edit Lead" : "New Lead"}</CardTitle>
            {form.do_not_call && (
              <Badge className="bg-red-100 text-red-700 border-red-200 gap-1">
                <Phone className="w-3 h-3" /> DO NOT CALL
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {!editId && !dupDismissed && dupRisk !== "none" && (
              <DuplicateWarning
                duplicates={duplicates} risk={dupRisk}
                onDismiss={() => setDupDismissed(true)}
                onLinkDuplicate={(id) => { setLinkedDuplicateOf(id); setDupDismissed(true); }}
              />
            )}
            {linkedDuplicateOf && (
              <div className="text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded px-3 py-2 flex items-center justify-between">
                <span>Will be saved as duplicate of lead <code className="font-mono">{linkedDuplicateOf}</code></span>
                <button type="button" onClick={() => setLinkedDuplicateOf(null)} className="ml-2 opacity-60 hover:opacity-100">×</button>
              </div>
            )}

            {/* DJEP Lead Status + Flags */}
            <div className="bg-gray-50/80 rounded-lg p-4 border">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Lead Status & Flags</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Lead Status *</Label>
                  <Select value={form.lead_status} onValueChange={v => set("lead_status", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {leadStatusOptions.map(o => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {form.lead_status === "x_dated" && (
                  <div>
                    <Label className="text-xs">X-Date Follow-up *</Label>
                    <Input type="date" value={form.x_date_followup_at} onChange={e => set("x_date_followup_at", e.target.value)} required className="mt-1" />
                  </div>
                )}
                <div className="flex items-center gap-3 pt-4">
                  <Switch checked={form.do_not_call} onCheckedChange={v => set("do_not_call", v)} id="do_not_call" />
                  <Label htmlFor="do_not_call" className="text-xs font-medium text-red-600 cursor-pointer">DO NOT CALL</Label>
                </div>
              </div>
            </div>

            {/* Client Info */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Client Info</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-xs">First Name *</Label><Input value={form.client_first_name} onChange={e => set("client_first_name", e.target.value)} required className="mt-1" /></div>
                <div><Label className="text-xs">Last Name</Label><Input value={form.client_last_name} onChange={e => set("client_last_name", e.target.value)} className="mt-1" /></div>
                <div><Label className="text-xs">Partner First</Label><Input value={form.partner_first_name} onChange={e => set("partner_first_name", e.target.value)} className="mt-1" /></div>
                <div><Label className="text-xs">Partner Last</Label><Input value={form.partner_last_name} onChange={e => set("partner_last_name", e.target.value)} className="mt-1" /></div>
                <div><Label className="text-xs">Email *</Label><Input type="email" value={form.email} onChange={e => set("email", e.target.value)} required className="mt-1" /></div>
                <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={e => set("phone", e.target.value)} className="mt-1" /></div>
                <div>
                  <Label className="text-xs">Preferred Contact</Label>
                  <Select value={form.preferred_contact_method} onValueChange={v => set("preferred_contact_method", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["phone","email","text","any"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Priority</Label>
                  <Select value={form.priority} onValueChange={v => set("priority", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Event Info */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Event Info</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Event Type *</Label>
                  <Select value={form.event_type} onValueChange={v => set("event_type", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Event Date</Label><Input type="date" value={form.event_date} onChange={e => set("event_date", e.target.value)} className="mt-1" /></div>
                <div><Label className="text-xs">City</Label><Input value={form.city} onChange={e => set("city", e.target.value)} className="mt-1" /></div>
                <div><Label className="text-xs">Venue</Label><Input value={form.venue_name} onChange={e => set("venue_name", e.target.value)} className="mt-1" /></div>
                <div>
                  <Label className="text-xs">Budget Range</Label>
                  <Select value={form.budget_range} onValueChange={v => set("budget_range", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BUDGETS.map(b => <SelectItem key={b} value={b}>{b.replace(/_/g, " - $")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Guest Count</Label><Input type="number" value={form.guest_count} onChange={e => set("guest_count", e.target.value)} className="mt-1" /></div>
              </div>
            </div>

            {/* Source & Assignment */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Source & Assignment</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Lead Source</Label>
                  <Select value={form.lead_source} onValueChange={v => set("lead_source", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select source" /></SelectTrigger>
                    <SelectContent>
                      {LEAD_SOURCES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Source Detail</Label><Input value={form.source_detail} onChange={e => set("source_detail", e.target.value)} placeholder="e.g. referral name" className="mt-1" /></div>
                <div><Label className="text-xs">Assigned Rep (email)</Label><Input value={form.assigned_rep} onChange={e => set("assigned_rep", e.target.value)} className="mt-1" /></div>
              </div>
            </div>

            {/* Attribution */}
            <div>
              <button type="button" onClick={() => setShowAttribution(!showAttribution)} className="text-xs text-violet-600 hover:text-violet-800 font-medium">
                {showAttribution ? "▼ Hide" : "▶ Show"} UTM / Attribution Fields
              </button>
              {showAttribution && (
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div><Label className="text-xs">UTM Source</Label><Input value={form.utm_source} onChange={e => set("utm_source", e.target.value)} className="mt-1" /></div>
                  <div><Label className="text-xs">UTM Medium</Label><Input value={form.utm_medium} onChange={e => set("utm_medium", e.target.value)} className="mt-1" /></div>
                  <div><Label className="text-xs">UTM Campaign</Label><Input value={form.utm_campaign} onChange={e => set("utm_campaign", e.target.value)} className="mt-1" /></div>
                  <div><Label className="text-xs">UTM Content</Label><Input value={form.utm_content} onChange={e => set("utm_content", e.target.value)} className="mt-1" /></div>
                  <div><Label className="text-xs">UTM Term</Label><Input value={form.utm_term} onChange={e => set("utm_term", e.target.value)} className="mt-1" /></div>
                  <div><Label className="text-xs">GCLID</Label><Input value={form.gclid} onChange={e => set("gclid", e.target.value)} className="mt-1 font-mono text-xs" /></div>
                  <div><Label className="text-xs">FBCLID</Label><Input value={form.fbclid} onChange={e => set("fbclid", e.target.value)} className="mt-1 font-mono text-xs" /></div>
                  <div><Label className="text-xs">Landing Page URL</Label><Input value={form.landing_page_url} onChange={e => set("landing_page_url", e.target.value)} className="mt-1 text-xs" /></div>
                </div>
              )}
            </div>

            <div><Label className="text-xs">Notes</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} className="mt-1" /></div>

            <div className="flex justify-end gap-3 pt-4">
              <Link to={createPageUrl("Leads")}><Button type="button" variant="outline">Cancel</Button></Link>
              <Button type="submit" disabled={saving} className="bg-gradient-to-r from-violet-600 to-indigo-600">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
                {editId ? "Update" : "Create"} Lead
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}