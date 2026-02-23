import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, MapPin, Phone, Mail, Users, Clock, Loader2, Save } from "lucide-react";

export default function Venues() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "", address: "", city: "", contact_name: "", contact_phone: "", contact_email: "",
    load_in_instructions: "", parking_notes: "", sound_restrictions: "", curfew_time: "",
    setup_notes: "", has_ceremony_space: false, has_reception_space: true, capacity: "", notes: ""
  });

  const { data: venues = [] } = useQuery({
    queryKey: ["venues"],
    queryFn: () => base44.entities.Venue.list("name", 200),
  });

  const filtered = venues.filter(v => !search || v.name?.toLowerCase().includes(search.toLowerCase()) || v.city?.toLowerCase().includes(search.toLowerCase()));

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.Venue.create({ ...form, capacity: form.capacity ? Number(form.capacity) : undefined });
    setForm({ name: "", address: "", city: "", contact_name: "", contact_phone: "", contact_email: "", load_in_instructions: "", parking_notes: "", sound_restrictions: "", curfew_time: "", setup_notes: "", has_ceremony_space: false, has_reception_space: true, capacity: "", notes: "" });
    setSaving(false);
    setDialogOpen(false);
    queryClient.invalidateQueries(["venues"]);
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Venues</h1>
          <p className="text-sm text-gray-500 mt-0.5">{venues.length} venues</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 text-sm h-9">
              <Plus className="w-4 h-4 mr-1.5" /> Add Venue
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New Venue</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><Label className="text-xs">Name *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="mt-1" /></div>
                <div className="col-span-2"><Label className="text-xs">Address</Label><Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="mt-1" /></div>
                <div><Label className="text-xs">City *</Label><Input value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="mt-1" /></div>
                <div><Label className="text-xs">Capacity</Label><Input type="number" value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} className="mt-1" /></div>
                <div><Label className="text-xs">Contact Name</Label><Input value={form.contact_name} onChange={e => setForm({...form, contact_name: e.target.value})} className="mt-1" /></div>
                <div><Label className="text-xs">Contact Phone</Label><Input value={form.contact_phone} onChange={e => setForm({...form, contact_phone: e.target.value})} className="mt-1" /></div>
                <div><Label className="text-xs">Contact Email</Label><Input value={form.contact_email} onChange={e => setForm({...form, contact_email: e.target.value})} className="mt-1" /></div>
                <div><Label className="text-xs">Curfew Time</Label><Input value={form.curfew_time} onChange={e => setForm({...form, curfew_time: e.target.value})} placeholder="11:00 PM" className="mt-1" /></div>
              </div>
              <div className="flex gap-6">
                <div className="flex items-center gap-2"><Switch checked={form.has_ceremony_space} onCheckedChange={v => setForm({...form, has_ceremony_space: v})} /><Label className="text-xs">Ceremony</Label></div>
                <div className="flex items-center gap-2"><Switch checked={form.has_reception_space} onCheckedChange={v => setForm({...form, has_reception_space: v})} /><Label className="text-xs">Reception</Label></div>
              </div>
              <div><Label className="text-xs">Load-in Instructions</Label><Textarea value={form.load_in_instructions} onChange={e => setForm({...form, load_in_instructions: e.target.value})} rows={2} className="mt-1" /></div>
              <div><Label className="text-xs">Sound Restrictions</Label><Textarea value={form.sound_restrictions} onChange={e => setForm({...form, sound_restrictions: e.target.value})} rows={2} className="mt-1" /></div>
              <Button onClick={handleSave} disabled={saving || !form.name || !form.city} className="w-full bg-violet-600 hover:bg-violet-700">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Save Venue
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search venues..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm bg-white" />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(v => (
          <Card key={v.id} className="border-0 shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-5">
              <h3 className="font-semibold text-gray-900">{v.name}</h3>
              <div className="mt-2 space-y-1.5 text-xs text-gray-500">
                {v.address && <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 flex-shrink-0" />{v.address}</div>}
                <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{v.city}</div>
                {v.capacity && <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />Capacity: {v.capacity}</div>}
                {v.curfew_time && <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Curfew: {v.curfew_time}</div>}
              </div>
              <div className="flex gap-1.5 mt-3">
                {v.has_ceremony_space && <Badge variant="secondary" className="text-[10px]">Ceremony</Badge>}
                {v.has_reception_space && <Badge variant="secondary" className="text-[10px]">Reception</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <div className="col-span-full text-center py-16 text-gray-400 text-sm">No venues found.</div>}
      </div>
    </div>
  );
}