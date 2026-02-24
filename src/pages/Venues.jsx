import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Search, MapPin, Phone, Mail, Building2, Pencil, Trash2, Users } from "lucide-react";

const EMPTY = {
  name: "", address: "", city: "", contact_name: "", contact_phone: "", contact_email: "",
  load_in_instructions: "", parking_notes: "", sound_restrictions: "", curfew_time: "",
  setup_notes: "", has_ceremony_space: false, has_reception_space: true, capacity: "", notes: "",
};

export default function Venues() {
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const { data: venues = [], isLoading } = useQuery({
    queryKey: ["venues"],
    queryFn: () => base44.entities.Venue.list("-created_date", 300),
  });

  const cities = [...new Set(venues.map(v => v.city).filter(Boolean))].sort();

  const filtered = venues.filter(v => {
    const q = search.toLowerCase();
    const matchSearch = !q || [v.name, v.city, v.address, v.contact_name].some(f => f?.toLowerCase().includes(q));
    const matchCity = !cityFilter || v.city === cityFilter;
    return matchSearch && matchCity;
  });

  const openNew = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (v) => { setEditing(v); setForm({ ...EMPTY, ...v }); setShowModal(true); };

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...form, capacity: form.capacity ? Number(form.capacity) : undefined };
    if (editing) {
      await base44.entities.Venue.update(editing.id, payload);
    } else {
      await base44.entities.Venue.create(payload);
    }
    qc.invalidateQueries({ queryKey: ["venues"] });
    setSaving(false);
    setShowModal(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this venue?")) return;
    await base44.entities.Venue.delete(id);
    qc.invalidateQueries({ queryKey: ["venues"] });
  };

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Venues</h1>
          <p className="text-sm text-gray-500 mt-0.5">{venues.length} venues in database</p>
        </div>
        <Button onClick={openNew} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
          <Plus className="w-4 h-4" /> Add Venue
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input className="pl-9" placeholder="Search venues…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-gray-600 focus:outline-none focus:ring-1 focus:ring-ring"
          value={cityFilter}
          onChange={e => setCityFilter(e.target.value)}
        >
          <option value="">All Cities</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">No venues found.</div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(v => (
            <Card key={v.id} className="border-0 shadow-sm hover:shadow-md transition-shadow group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 leading-tight">{v.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{v.city}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(v)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => handleDelete(v.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  {v.address && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <MapPin className="w-3 h-3 flex-shrink-0" />{v.address}
                    </div>
                  )}
                  {v.contact_name && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Mail className="w-3 h-3 flex-shrink-0" />{v.contact_name}
                      {v.contact_phone && <span>· {v.contact_phone}</span>}
                    </div>
                  )}
                  {v.capacity && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Users className="w-3 h-3 flex-shrink-0" />Capacity: {v.capacity}
                    </div>
                  )}
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {v.has_ceremony_space && <Badge variant="secondary" className="text-[10px] bg-purple-50 text-purple-700">Ceremony</Badge>}
                    {v.has_reception_space && <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700">Reception</Badge>}
                    {v.curfew_time && <Badge variant="outline" className="text-[10px]">Curfew {v.curfew_time}</Badge>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Venue" : "New Venue"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label>Venue Name *</Label>
                <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Grand Ballroom at…" />
              </div>
              <div className="space-y-1">
                <Label>City *</Label>
                <Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Chicago" />
              </div>
              <div className="space-y-1">
                <Label>Address</Label>
                <Input value={form.address} onChange={e => set("address", e.target.value)} placeholder="123 Main St" />
              </div>
            </div>
            <div className="border-t pt-3">
              <p className="text-sm font-medium text-gray-700 mb-2">Venue Contact</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Contact Name</Label>
                  <Input value={form.contact_name} onChange={e => set("contact_name", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input value={form.contact_phone} onChange={e => set("contact_phone", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input value={form.contact_email} onChange={e => set("contact_email", e.target.value)} />
                </div>
              </div>
            </div>
            <div className="border-t pt-3 grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Capacity</Label>
                <Input type="number" value={form.capacity} onChange={e => set("capacity", e.target.value)} placeholder="300" />
              </div>
              <div className="space-y-1">
                <Label>Curfew Time</Label>
                <Input value={form.curfew_time} onChange={e => set("curfew_time", e.target.value)} placeholder="11:00 PM" />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.has_ceremony_space} onCheckedChange={v => set("has_ceremony_space", v)} />
                <Label>Has Ceremony Space</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.has_reception_space} onCheckedChange={v => set("has_reception_space", v)} />
                <Label>Has Reception Space</Label>
              </div>
            </div>
            <div className="border-t pt-3 space-y-3">
              <div className="space-y-1">
                <Label>Load-In Instructions</Label>
                <Textarea value={form.load_in_instructions} onChange={e => set("load_in_instructions", e.target.value)} rows={2} />
              </div>
              <div className="space-y-1">
                <Label>Parking Notes</Label>
                <Textarea value={form.parking_notes} onChange={e => set("parking_notes", e.target.value)} rows={2} />
              </div>
              <div className="space-y-1">
                <Label>Sound Restrictions</Label>
                <Textarea value={form.sound_restrictions} onChange={e => set("sound_restrictions", e.target.value)} rows={2} />
              </div>
              <div className="space-y-1">
                <Label>Setup Notes</Label>
                <Textarea value={form.setup_notes} onChange={e => set("setup_notes", e.target.value)} rows={2} />
              </div>
              <div className="space-y-1">
                <Label>General Notes</Label>
                <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.city} className="bg-violet-600 hover:bg-violet-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? "Save Changes" : "Create Venue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}