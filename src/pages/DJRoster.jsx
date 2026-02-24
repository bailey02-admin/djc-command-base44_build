import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Search, Mail, Phone, MapPin, User, ExternalLink, Pencil, Trash2, Music2 } from "lucide-react";

const ROLES = [{ value: "dj", label: "DJ" }, { value: "mc", label: "MC" }, { value: "dj_mc", label: "DJ + MC" }];
const roleColors = { dj: "bg-violet-50 text-violet-700", mc: "bg-blue-50 text-blue-700", dj_mc: "bg-indigo-50 text-indigo-700" };

const EMPTY = {
  name: "", email: "", phone: "", city: "", additional_cities: [],
  role: "dj", is_active: true, notes: "", linked_user_email: "",
};

export default function DJRoster() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [additionalCitiesText, setAdditionalCitiesText] = useState("");
  const qc = useQueryClient();

  const { data: djs = [], isLoading } = useQuery({
    queryKey: ["dj-profiles"],
    queryFn: () => base44.entities.DJProfile.list("-created_date", 200),
  });

  const cities = [...new Set(djs.map(d => d.city).filter(Boolean))].sort();

  const filtered = djs.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !q || [d.name, d.email, d.city].some(f => f?.toLowerCase().includes(q));
    const matchRole = !roleFilter || d.role === roleFilter;
    const matchCity = !cityFilter || d.city === cityFilter;
    return matchSearch && matchRole && matchCity;
  });

  const active = filtered.filter(d => d.is_active !== false);
  const inactive = filtered.filter(d => d.is_active === false);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setAdditionalCitiesText("");
    setShowModal(true);
  };
  const openEdit = (d) => {
    setEditing(d);
    setForm({ ...EMPTY, ...d });
    setAdditionalCitiesText((d.additional_cities || []).join(", "));
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      ...form,
      additional_cities: additionalCitiesText ? additionalCitiesText.split(",").map(c => c.trim()).filter(Boolean) : [],
    };
    if (editing) {
      await base44.entities.DJProfile.update(editing.id, payload);
    } else {
      await base44.entities.DJProfile.create(payload);
    }
    qc.invalidateQueries({ queryKey: ["dj-profiles"] });
    setSaving(false);
    setShowModal(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this DJ profile?")) return;
    await base44.entities.DJProfile.delete(id);
    qc.invalidateQueries({ queryKey: ["dj-profiles"] });
  };

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const DJCard = ({ dj }) => (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
              <Music2 className="w-4 h-4 text-violet-500" />
            </div>
            <div>
              <Link to={createPageUrl("DJDetail") + `?id=${dj.id}`} className="font-semibold text-gray-900 hover:text-violet-600 transition-colors flex items-center gap-1 group/link">
                {dj.name}
                <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
              </Link>
              <div className="flex gap-1.5 mt-0.5 flex-wrap">
                <Badge variant="secondary" className={`text-[10px] ${roleColors[dj.role] || "bg-gray-100 text-gray-600"}`}>
                  {ROLES.find(r => r.value === dj.role)?.label || dj.role}
                </Badge>
                {dj.is_active === false && (
                  <Badge variant="secondary" className="text-[10px] bg-gray-100 text-gray-500">Inactive</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(dj)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => handleDelete(dj.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <div className="mt-3 space-y-1">
          {dj.email && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Mail className="w-3 h-3 flex-shrink-0" />
              <a href={`mailto:${dj.email}`} className="truncate hover:text-violet-600">{dj.email}</a>
            </div>
          )}
          {dj.phone && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Phone className="w-3 h-3 flex-shrink-0" />
              <a href={`tel:${dj.phone}`} className="hover:text-violet-600">{dj.phone}</a>
            </div>
          )}
          {dj.city && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              {dj.city}
              {dj.additional_cities?.length > 0 && <span className="text-gray-400">+ {dj.additional_cities.length} more</span>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">DJ Roster</h1>
          <p className="text-sm text-gray-500 mt-0.5">{active.length} active · {inactive.length} inactive</p>
        </div>
        <Button onClick={openNew} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
          <Plus className="w-4 h-4" /> Add DJ
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input className="pl-9" placeholder="Search by name, email, city…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-gray-600 focus:outline-none focus:ring-1 focus:ring-ring"
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
        >
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-gray-600 focus:outline-none focus:ring-1 focus:ring-ring"
          value={cityFilter}
          onChange={e => setCityFilter(e.target.value)}
        >
          <option value="">All Cities</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">No DJs found.</div>
      ) : (
        <>
          {active.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Active ({active.length})</h2>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {active.map(d => <DJCard key={d.id} dj={d} />)}
              </div>
            </div>
          )}
          {inactive.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Inactive ({inactive.length})</h2>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 opacity-60">
                {inactive.map(d => <DJCard key={d.id} dj={d} />)}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit DJ Profile" : "Add DJ to Roster"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="DJ Name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={v => set("role", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Home City</Label>
                <Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Chicago" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Additional Cities (comma-separated)</Label>
              <Input
                value={additionalCitiesText}
                onChange={e => setAdditionalCitiesText(e.target.value)}
                placeholder="Milwaukee, Madison, Rockford"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => set("phone", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Linked CRM User Email</Label>
              <Input value={form.linked_user_email} onChange={e => set("linked_user_email", e.target.value)} placeholder="dj@company.com" />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => set("is_active", v)} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name} className="bg-violet-600 hover:bg-violet-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? "Save Changes" : "Add DJ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}