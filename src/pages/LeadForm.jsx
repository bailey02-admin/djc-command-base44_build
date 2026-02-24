import React, { useState, useEffect } from "react";
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
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { onNewLead } from "../components/crm/automations";

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
};

export default function LeadForm() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [showAttribution, setShowAttribution] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const editId = params.get("id");
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (editId) {
      base44.entities.Lead.list().then(leads => {
        const l = leads.find(x => x.id === editId);
        if (l) setForm(prev => ({ ...prev, ...l, guest_count: l.guest_count?.toString() || "" }));
      });
    } else {
      setForm(prev => ({ ...prev, inquiry_date: new Date().toISOString() }));
    }
  }, [editId]);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = {
      ...form,
      guest_count: form.guest_count ? Number(form.guest_count) : undefined,
      inquiry_date: form.inquiry_date || new Date().toISOString(),
      sla_status: "on_time",
    };
    if (editId) {
      await base44.entities.Lead.update(editId, data);
    } else {
      const lead = await base44.entities.Lead.create(data);
      await onNewLead(lead);
    }
    navigate(createPageUrl("Leads"));
  };

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <Link to={createPageUrl("Leads")} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Leads
      </Link>
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-lg">{editId ? "Edit Lead" : "New Lead"}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
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
                <div><Label className="text-xs">Source Detail</Label><Input value={form.source_detail} onChange={e => set("source_detail", e.target.value)} placeholder="e.g. referral name, vendor" className="mt-1" /></div>
                <div><Label className="text-xs">Assigned Rep (email)</Label><Input value={form.assigned_rep} onChange={e => set("assigned_rep", e.target.value)} className="mt-1" /></div>
              </div>
            </div>

            {/* Attribution toggle */}
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