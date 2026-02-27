import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { EventAPI, EventOpsAPI } from "../components/api/secureApi";
import { onEventBooked } from "../components/crm/automations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useLabels, eventDisplayString, CITIES, EVENT_STATUSES } from "../components/crm/labelMap";

const EVENT_TYPES = ["wedding","corporate","school_dance","private_party","birthday","anniversary","mitzvah","quinceañera","holiday_party","other"];
const BOOKED_STATUSES = new Set(["booked_pending","booked","planning_in_progress","finalized"]);

const EMPTY_FORM = {
  event_name: "", event_type: "wedding", event_date: "", start_time: "", end_time: "",
  city: "", venue_name: "", ceremony_venue: "", guest_count: "",
  contact_name: "", contact_email: "", contact_phone: "",
  package_name: "", package_price: "", status: "booked_pending",
  internal_notes: "", client_notes: "", equipment_notes: "", load_in_notes: "", setup_time: "",
};

export default function EventForm() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const editId = params.get("id");
  const [form, setForm] = useState(EMPTY_FORM);
  const { label, optionsFor } = useLabels();

  useEffect(() => {
    if (editId) {
      EventAPI.list({}, "-event_date", 200).then(events => {
        const ev = events.find(e => e.id === editId);
        if (ev) setForm(prev => ({
          ...prev, ...ev,
          guest_count: ev.guest_count?.toString() || "",
          package_price: ev.package_price?.toString() || "",
        }));
      });
    }
  }, [editId]);

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const data = {
      ...form,
      guest_count: form.guest_count ? Number(form.guest_count) : undefined,
      package_price: form.package_price ? Number(form.package_price) : undefined,
    };

    if (editId) {
      await EventAPI.update(editId, data);
    } else {
      if (BOOKED_STATUSES.has(data.status)) {
        data.booked_date = new Date().toISOString().split("T")[0];
      }
      const created = await EventAPI.create(data);
      if (created && BOOKED_STATUSES.has(created.status)) {
        await Promise.all([
          onEventBooked(created),
          EventOpsAPI.createPaymentSchedule(created.id),
        ]);
      }
    }

    navigate(createPageUrl("Events"));
  };

  const statusOptions = optionsFor("event_status");
  const cityOptions = optionsFor("city");

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <Link to={createPageUrl("Events")} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Events
      </Link>
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{editId ? "Edit Event" : "New Event"}</CardTitle>
            {form.status && form.city && (
              <Badge className="bg-violet-50 text-violet-700 border-violet-200 text-xs font-medium">
                {eventDisplayString(form.status, form.city)}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Event Info</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><Label className="text-xs">Event Name *</Label><Input value={form.event_name} onChange={e => handleChange("event_name", e.target.value)} required className="mt-1" /></div>
                <div>
                  <Label className="text-xs">Type *</Label>
                  <Select value={form.event_type} onValueChange={v => handleChange("event_type", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Date *</Label><Input type="date" value={form.event_date} onChange={e => handleChange("event_date", e.target.value)} required className="mt-1" /></div>
                <div><Label className="text-xs">Start Time</Label><Input value={form.start_time} onChange={e => handleChange("start_time", e.target.value)} placeholder="6:00 PM" className="mt-1" /></div>
                <div><Label className="text-xs">End Time</Label><Input value={form.end_time} onChange={e => handleChange("end_time", e.target.value)} placeholder="11:00 PM" className="mt-1" /></div>
                <div>
                  <Label className="text-xs">City</Label>
                  <Select value={form.city} onValueChange={v => handleChange("city", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select city" /></SelectTrigger>
                    <SelectContent>
                      {cityOptions.map(o => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Guest Count</Label><Input type="number" value={form.guest_count} onChange={e => handleChange("guest_count", e.target.value)} className="mt-1" /></div>
                <div><Label className="text-xs">Reception Venue</Label><Input value={form.venue_name} onChange={e => handleChange("venue_name", e.target.value)} className="mt-1" /></div>
                <div><Label className="text-xs">Ceremony Venue</Label><Input value={form.ceremony_venue} onChange={e => handleChange("ceremony_venue", e.target.value)} className="mt-1" /></div>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contact</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-xs">Contact Name</Label><Input value={form.contact_name} onChange={e => handleChange("contact_name", e.target.value)} className="mt-1" /></div>
                <div><Label className="text-xs">Email</Label><Input value={form.contact_email} onChange={e => handleChange("contact_email", e.target.value)} className="mt-1" /></div>
                <div><Label className="text-xs">Phone</Label><Input value={form.contact_phone} onChange={e => handleChange("contact_phone", e.target.value)} className="mt-1" /></div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={form.status} onValueChange={v => handleChange("status", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(o => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Package & Notes</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-xs">Package Name</Label><Input value={form.package_name} onChange={e => handleChange("package_name", e.target.value)} className="mt-1" /></div>
                <div><Label className="text-xs">Package Price</Label><Input type="number" value={form.package_price} onChange={e => handleChange("package_price", e.target.value)} className="mt-1" /></div>
                <div><Label className="text-xs">Setup Time</Label><Input value={form.setup_time} onChange={e => handleChange("setup_time", e.target.value)} placeholder="4:00 PM" className="mt-1" /></div>
                <div><Label className="text-xs">Equipment Notes</Label><Input value={form.equipment_notes} onChange={e => handleChange("equipment_notes", e.target.value)} className="mt-1" /></div>
              </div>
              <div className="mt-4"><Label className="text-xs">Internal Notes</Label><Textarea value={form.internal_notes} onChange={e => handleChange("internal_notes", e.target.value)} rows={2} className="mt-1" /></div>
              <div className="mt-4"><Label className="text-xs">Load-in Notes</Label><Textarea value={form.load_in_notes} onChange={e => handleChange("load_in_notes", e.target.value)} rows={2} className="mt-1" /></div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Link to={createPageUrl("Events")}><Button type="button" variant="outline">Cancel</Button></Link>
              <Button type="submit" disabled={saving} className="bg-gradient-to-r from-violet-600 to-indigo-600">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
                {editId ? "Update" : "Create"} Event
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}