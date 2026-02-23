import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function LeadForm() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const editId = params.get("id");
  const [form, setForm] = useState({
    client_first_name: "", client_last_name: "", partner_first_name: "", partner_last_name: "",
    email: "", phone: "", event_date: "", event_type: "wedding", city: "", venue_name: "",
    budget_range: "not_specified", guest_count: "", lead_source: "website", source_detail: "",
    notes: "", priority: "medium", assigned_rep: "",
  });

  useEffect(() => {
    if (editId) {
      base44.entities.Lead.list().then(leads => {
        const lead = leads.find(l => l.id === editId);
        if (lead) setForm(prev => ({ ...prev, ...lead }));
      });
    }
  }, [editId]);

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = { ...form, guest_count: form.guest_count ? Number(form.guest_count) : undefined };
    if (!data.inquiry_date && !editId) data.inquiry_date = new Date().toISOString();
    if (editId) {
      await base44.entities.Lead.update(editId, data);
    } else {
      await base44.entities.Lead.create(data);
    }
    navigate(createPageUrl("Leads"));
  };

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <Link to={createPageUrl("Leads")} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Leads
      </Link>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">{editId ? "Edit Lead" : "New Lead"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Client Info */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Client Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-xs">First Name *</Label><Input value={form.client_first_name} onChange={e => handleChange("client_first_name", e.target.value)} required className="mt-1" /></div>
                <div><Label className="text-xs">Last Name</Label><Input value={form.client_last_name} onChange={e => handleChange("client_last_name", e.target.value)} className="mt-1" /></div>
                <div><Label className="text-xs">Partner First Name</Label><Input value={form.partner_first_name} onChange={e => handleChange("partner_first_name", e.target.value)} className="mt-1" /></div>
                <div><Label className="text-xs">Partner Last Name</Label><Input value={form.partner_last_name} onChange={e => handleChange("partner_last_name", e.target.value)} className="mt-1" /></div>
                <div><Label className="text-xs">Email *</Label><Input type="email" value={form.email} onChange={e => handleChange("email", e.target.value)} required className="mt-1" /></div>
                <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={e => handleChange("phone", e.target.value)} className="mt-1" /></div>
              </div>
            </div>

            {/* Event Info */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Event Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Event Type *</Label>
                  <Select value={form.event_type} onValueChange={v => handleChange("event_type", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["wedding","corporate","school_dance","private_party","birthday","anniversary","mitzvah","quinceañera","holiday_party","other"].map(t => (
                        <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Event Date</Label><Input type="date" value={form.event_date} onChange={e => handleChange("event_date", e.target.value)} className="mt-1" /></div>
                <div><Label className="text-xs">City / Market</Label><Input value={form.city} onChange={e => handleChange("city", e.target.value)} className="mt-1" /></div>
                <div><Label className="text-xs">Venue</Label><Input value={form.venue_name} onChange={e => handleChange("venue_name", e.target.value)} className="mt-1" /></div>
                <div><Label className="text-xs">Guest Count</Label><Input type="number" value={form.guest_count} onChange={e => handleChange("guest_count", e.target.value)} className="mt-1" /></div>
                <div>
                  <Label className="text-xs">Budget Range</Label>
                  <Select value={form.budget_range} onValueChange={v => handleChange("budget_range", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["under_500","500_1000","1000_1500","1500_2000","2000_3000","3000_plus","not_specified"].map(b => (
                        <SelectItem key={b} value={b}>{b === "not_specified" ? "Not Specified" : `$${b.replace(/_/g, " - $")}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Source & Assignment */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Source & Assignment</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Lead Source</Label>
                  <Select value={form.lead_source} onValueChange={v => handleChange("lead_source", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["website","google_ads","meta_ads","referral","bridal_show","the_knot","weddingwire","yelp","phone_call","walk_in","vendor_referral","repeat_client","other"].map(s => (
                        <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Source Detail / UTM</Label><Input value={form.source_detail} onChange={e => handleChange("source_detail", e.target.value)} className="mt-1" /></div>
                <div>
                  <Label className="text-xs">Priority</Label>
                  <Select value={form.priority} onValueChange={v => handleChange("priority", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Assigned Rep (email)</Label><Input value={form.assigned_rep} onChange={e => handleChange("assigned_rep", e.target.value)} className="mt-1" /></div>
              </div>
            </div>

            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={e => handleChange("notes", e.target.value)} rows={3} className="mt-1" />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Link to={createPageUrl("Leads")}><Button type="button" variant="outline">Cancel</Button></Link>
              <Button type="submit" disabled={saving} className="bg-gradient-to-r from-violet-600 to-indigo-600">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
                {editId ? "Update Lead" : "Create Lead"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}