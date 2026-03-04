import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { EventAPI, EventOpsAPI } from "@/components/api/secureApi";
import { onEventBooked } from "@/components/crm/automations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useLabels, eventDisplayString } from "@/components/crm/labelMap";

const EVENT_TYPES = [
  "wedding","corporate","school_dance","private_party","birthday",
  "anniversary","mitzvah","quinceañera","holiday_party","other"
];
const CITIES = ["TUL","DFW","HOU","SAT","KC","STL","INDY","NASH","DEN","ATL"];
// STATUS_OPTIONS will be loaded from EventStatus settings at runtime
let STATUS_OPTIONS = [
  "booked_pending","booked","planning_in_progress","finalized",
  "completed","cancelled","postponed"
];

const EMPTY_FORM = {
  event_name: "", event_type: "wedding", event_date: "", start_time: "", end_time: "",
  setup_time: "", city: "", venue_name: "", venue_id: "", ceremony_venue: "", guest_count: "",
  // Contact
  contact_name: "", contact_email: "", contact_phone: "", contact_id: "",
  // Booking
  status: "booked_pending", lead_id: "", booked_date: "", final_call_date: "",
  // Package / fees
  package_name: "", package_price: "", total_fee: "",
  // Staff
  assigned_dj: "", assigned_dj_id: "", assigned_mc: "", assigned_mc_id: "",
  assigned_finalizer: "", assigned_city_manager: "",
  // Notes
  internal_notes: "", client_notes: "", equipment_notes: "", load_in_notes: "",
  // Booleans
  contract_signed: false, deposit_paid: false, balance_paid: false,
  planning_complete: false, timeline_complete: false, music_complete: false,
  final_call_completed: false, dj_briefed: false,
};

function Section({ title, children }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children, span2 }) {
  return (
    <div className={span2 ? "sm:col-span-2" : ""}>
      <Label className="text-xs text-gray-600">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export default function EventForm() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const editId = params.get("id");
  const [form, setForm] = useState(EMPTY_FORM);
  const [statusOptions, setStatusOptions] = useState(STATUS_OPTIONS);
  const [bookedStatuses, setBookedStatuses] = useState(new Set(["booked_pending","booked","planning_in_progress","finalized"]));
  const { optionsFor } = useLabels();

  useEffect(() => {
    // Load status settings
    base44.functions.invoke("getStatusSettings", {}).then(res => {
      const statuses = res.data?.statuses || [];
      setStatusOptions(statuses.map(s => s.key));

      // Load official_booked group to determine which statuses trigger booking logic
      const groups = res.data?.groups || [];
      const officialBookedGroup = groups.find(g => g.key === "official_booked");
      if (officialBookedGroup?.statuses) {
        setBookedStatuses(new Set(officialBookedGroup.statuses));
      }
    }).catch(err => console.warn("Failed to load status settings:", err));

    if (editId) {
      EventAPI.getDetailBundle(editId).then(bundle => {
        const ev = bundle?.event;
        if (ev) setForm({
          ...EMPTY_FORM, ...ev,
          guest_count: ev.guest_count?.toString() || "",
          package_price: ev.package_price?.toString() || "",
          total_fee: ev.total_fee?.toString() || "",
        });
      });
    }
  }, [editId]);

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = {
      ...form,
      guest_count:   form.guest_count   ? Number(form.guest_count)   : undefined,
      package_price: form.package_price ? Number(form.package_price) : undefined,
      total_fee:     form.total_fee     ? Number(form.total_fee)     : undefined,
    };
    if (editId) {
      await EventAPI.update(editId, data);
    } else {
      if (bookedStatuses.has(data.status)) {
        data.booked_date = data.booked_date || new Date().toISOString().split("T")[0];
      }
      const created = await EventAPI.create(data);
      if (created && bookedStatuses.has(created.status)) {
        await Promise.all([
          onEventBooked(created),
          EventOpsAPI.createPaymentSchedule(created.id),
        ]);
      }
    }
    navigate(createPageUrl("EventDetail") + `?id=${editId || "new"}`);
    navigate(-1);
  };

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-5">
      <Link to={createPageUrl("Events")} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to Events
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{editId ? "Edit Event" : "New Event"}</h1>
        {form.status && form.city && (
          <Badge className="bg-violet-50 text-violet-700 border-violet-200 text-xs">
            {eventDisplayString(form.status, form.city)}
          </Badge>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* 1. Client Information */}
        <Section title="Client Information">
          <Field label="Contact Name"><Input value={form.contact_name} onChange={e => set("contact_name", e.target.value)} /></Field>
          <Field label="Email"><Input type="email" value={form.contact_email} onChange={e => set("contact_email", e.target.value)} /></Field>
          <Field label="Phone"><Input value={form.contact_phone} onChange={e => set("contact_phone", e.target.value)} /></Field>
          <Field label="Contact ID (linked)"><Input value={form.contact_id} onChange={e => set("contact_id", e.target.value)} placeholder="leave blank to auto-link" /></Field>
        </Section>

        {/* 2. Event Information */}
        <Section title="Event Information">
          <Field label="Event Name *" span2><Input value={form.event_name} onChange={e => set("event_name", e.target.value)} required /></Field>
          <Field label="Event Type *">
            <Select value={form.event_type} onValueChange={v => set("event_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Event Date *"><Input type="date" value={form.event_date} onChange={e => set("event_date", e.target.value)} required /></Field>
          <Field label="Setup Time"><Input value={form.setup_time} onChange={e => set("setup_time", e.target.value)} placeholder="4:00 PM" /></Field>
          <Field label="Start Time"><Input value={form.start_time} onChange={e => set("start_time", e.target.value)} placeholder="6:00 PM" /></Field>
          <Field label="End Time"><Input value={form.end_time} onChange={e => set("end_time", e.target.value)} placeholder="11:00 PM" /></Field>
          <Field label="City *">
            <Select value={form.city} onValueChange={v => set("city", v)}>
              <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
              <SelectContent>{CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Guest Count"><Input type="number" value={form.guest_count} onChange={e => set("guest_count", e.target.value)} /></Field>
        </Section>

        {/* 3. Booking Information */}
        <Section title="Booking Information">
          <Field label="Status *">
             <Select value={form.status} onValueChange={v => set("status", v)}>
               <SelectTrigger><SelectValue /></SelectTrigger>
               <SelectContent>{statusOptions.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
             </Select>
           </Field>
          <Field label="Booked Date"><Input type="date" value={form.booked_date} onChange={e => set("booked_date", e.target.value)} /></Field>
          <Field label="Final Call Date"><Input type="date" value={form.final_call_date} onChange={e => set("final_call_date", e.target.value)} /></Field>
          <Field label="Lead ID"><Input value={form.lead_id} onChange={e => set("lead_id", e.target.value)} placeholder="linked lead" /></Field>
        </Section>

        {/* 4. Fees */}
        <Section title="Package & Fees">
          <Field label="Package Name"><Input value={form.package_name} onChange={e => set("package_name", e.target.value)} /></Field>
          <Field label="Package Price ($)"><Input type="number" value={form.package_price} onChange={e => set("package_price", e.target.value)} /></Field>
          <Field label="Total Fee ($)"><Input type="number" value={form.total_fee} onChange={e => set("total_fee", e.target.value)} placeholder="if different from package price" /></Field>
        </Section>

        {/* 5. Venue */}
        <Section title="Venue">
          <Field label="Reception Venue" span2><Input value={form.venue_name} onChange={e => set("venue_name", e.target.value)} /></Field>
          <Field label="Ceremony Venue" span2><Input value={form.ceremony_venue} onChange={e => set("ceremony_venue", e.target.value)} /></Field>
          <Field label="Load-in Notes" span2><Textarea value={form.load_in_notes} onChange={e => set("load_in_notes", e.target.value)} rows={2} /></Field>
          <Field label="Equipment Notes" span2><Textarea value={form.equipment_notes} onChange={e => set("equipment_notes", e.target.value)} rows={2} /></Field>
        </Section>

        {/* 6. Assigned Staff */}
        <Section title="Assigned Staff">
          <Field label="DJ Name"><Input value={form.assigned_dj} onChange={e => set("assigned_dj", e.target.value)} /></Field>
          <Field label="MC Name"><Input value={form.assigned_mc} onChange={e => set("assigned_mc", e.target.value)} /></Field>
          <Field label="Finalizer"><Input value={form.assigned_finalizer} onChange={e => set("assigned_finalizer", e.target.value)} /></Field>
          <Field label="City Manager"><Input value={form.assigned_city_manager} onChange={e => set("assigned_city_manager", e.target.value)} /></Field>
        </Section>

        {/* 7. Notes */}
        <Section title="Notes">
          <Field label="Internal Notes" span2><Textarea value={form.internal_notes} onChange={e => set("internal_notes", e.target.value)} rows={3} /></Field>
          <Field label="Client-Visible Notes" span2><Textarea value={form.client_notes} onChange={e => set("client_notes", e.target.value)} rows={2} /></Field>
        </Section>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-2">
          <Link to={createPageUrl("Events")}><Button type="button" variant="outline">Cancel</Button></Link>
          <Button type="submit" disabled={saving} className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
            {editId ? "Update" : "Create"} Event
          </Button>
        </div>
      </form>
    </div>
  );
}