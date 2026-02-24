import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, MapPin, Phone, Mail, Users, Clock, Loader2, Save, Pencil, Trash2, Building2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "../components/common/ConfirmDialog";
import EmptyState from "../components/common/EmptyState";

const EMPTY = {
  name: "", address: "", city: "", contact_name: "", contact_phone: "", contact_email: "",
  load_in_instructions: "", parking_notes: "", sound_restrictions: "", curfew_time: "",
  setup_notes: "", has_ceremony_space: false, has_reception_space: true, capacity: "", notes: ""
};

export default function Venues() {
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailVenue, setDetailVenue] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const queryClient = useQueryClient();

  const { data: venues = [], isLoading } = useQuery({
    queryKey: ["venues"],
    queryFn: () => base44.entities.Venue.list("name", 200),
  });

  const cities = [...new Set(venues.map(v => v.city).filter(Boolean))].sort();

  let filtered = venues.filter(v => {
    const matchSearch = !search || v.name?.toLowerCase().includes(search.toLowerCase()) || v.city?.toLowerCase().includes(search.toLowerCase());
    const matchCity = cityFilter === "all" || v.city === cityFilter;
    return matchSearch && matchCity;
  });
  if (sortBy === "name") filtered = [...filtered].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  if (sortBy === "city") filtered = [...filtered].sort((a, b) => (a.city || "").localeCompare(b.city || ""));

  const openNew = () => { setEditingId(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (v, e) => { e.stopPropagation(); setEditingId(v.id); setForm({ ...EMPTY, ...v, capacity: v.capacity || "" }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.name || !form.city) return toast.error("Name and city are required.");
    setSaving(true);
    const payload = { ...form, capacity: form.capacity ? Number(form.capacity) : undefined };
    if (editingId) {
      await base44.entities.Venue.update(editingId, payload);
      toast.success("Venue updated.");
    } else {
      await base44.entities.Venue.create(payload);
      toast.success("Venue added.");
    }
    setSaving(false);
    setDialogOpen(false);
    queryClient.invalidateQueries(["venues"]);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await base44.entities.Venue.delete(confirmDelete.id);
    toast.success(`"${confirmDelete.name}" deleted.`);
    setDeleting(false);
    setConfirmDelete(null);
    if (detailVenue?.id === confirmDelete.id) setDetailVenue(null);
    queryClient.invalidateQueries(["venues"]);
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Venues</h1>
          <p className="text-sm text-gray-500 mt-0.5">{venues.length} venues</p>
        </div>
        <Button onClick={openNew} className="bg-gradient-to-r from-violet-600 to-indigo-600 text-sm h-9">
          <Plus className="w-4 h-4 mr-1.5" /> Add Venue
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search venues..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm bg-white" />
        </div>
        {cities.length > 0 && (
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-36 h-9 text-sm bg-white"><SelectValue placeholder="City" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-32 h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Sort: Name</SelectItem>
            <SelectItem value="city">Sort: City</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Building2} title="No venues found" description={search ? "Try a different search term." : "Add your first venue to get started."} actionLabel={!search ? "Add Venue" : undefined} onAction={!search ? openNew : undefined} />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(v => (
            <Card key={v.id} className="border-0 shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={() => setDetailVenue(v)}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-900 text-sm leading-tight">{v.name}</h3>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={e => openEdit(v, e)}>
                      <Pencil className="w-3 h-3 text-gray-400" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={e => { e.stopPropagation(); setConfirmDelete(v); }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 space-y-1.5 text-xs text-gray-500">
                  {v.address && <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate">{v.address}</span></div>}
                  <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{v.city}</div>
                  {v.capacity && <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />Cap: {v.capacity}</div>}
                  {v.curfew_time && <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Curfew: {v.curfew_time}</div>}
                  {v.contact_name && <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{v.contact_name}</div>}
                </div>
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {v.has_ceremony_space && <Badge variant="secondary" className="text-[10px]">Ceremony</Badge>}
                  {v.has_reception_space && <Badge variant="secondary" className="text-[10px]">Reception</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Edit Venue" : "New Venue"}</DialogTitle></DialogHeader>
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
            <div><Label className="text-xs">Parking Notes</Label><Textarea value={form.parking_notes} onChange={e => setForm({...form, parking_notes: e.target.value})} rows={2} className="mt-1" /></div>
            <div><Label className="text-xs">General Notes</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="mt-1" /></div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !form.name || !form.city} className="bg-violet-600 hover:bg-violet-700">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                {editingId ? "Update Venue" : "Save Venue"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Drawer */}
      <Dialog open={!!detailVenue} onOpenChange={v => !v && setDetailVenue(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          {detailVenue && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">{detailVenue.name}</DialogTitle>
                <p className="text-sm text-gray-500">{detailVenue.city}</p>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  {detailVenue.address && <InfoRow label="Address" value={detailVenue.address} className="col-span-2" />}
                  {detailVenue.capacity && <InfoRow label="Capacity" value={detailVenue.capacity} />}
                  {detailVenue.curfew_time && <InfoRow label="Curfew" value={detailVenue.curfew_time} />}
                  {detailVenue.contact_name && <InfoRow label="Contact" value={detailVenue.contact_name} />}
                  {detailVenue.contact_phone && <InfoRow label="Phone" value={detailVenue.contact_phone} />}
                  {detailVenue.contact_email && <InfoRow label="Email" value={detailVenue.contact_email} className="col-span-2" />}
                </div>
                {detailVenue.load_in_instructions && <InfoBlock label="Load-in Instructions" value={detailVenue.load_in_instructions} />}
                {detailVenue.sound_restrictions && <InfoBlock label="Sound Restrictions" value={detailVenue.sound_restrictions} />}
                {detailVenue.parking_notes && <InfoBlock label="Parking Notes" value={detailVenue.parking_notes} />}
                {detailVenue.notes && <InfoBlock label="Notes" value={detailVenue.notes} />}
                <div className="flex gap-2 pt-2 border-t">
                  <Button className="flex-1 bg-violet-600 hover:bg-violet-700" onClick={e => { openEdit(detailVenue, e); setDetailVenue(null); }}>
                    <Pencil className="w-4 h-4 mr-1.5" />Edit
                  </Button>
                  <Button variant="outline" className="text-red-600 hover:text-red-700 hover:border-red-300" onClick={() => { setConfirmDelete(detailVenue); setDetailVenue(null); }}>
                    <Trash2 className="w-4 h-4 mr-1.5" />Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Venue?"
        description={`"${confirmDelete?.name}" will be permanently removed.`}
        confirmLabel="Delete Venue"
      />
    </div>
  );
}

function InfoRow({ label, value, className = "" }) {
  return (
    <div className={className}>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-800 mt-0.5">{value}</p>
    </div>
  );
}

function InfoBlock({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-md p-2.5">{value}</p>
    </div>
  );
}