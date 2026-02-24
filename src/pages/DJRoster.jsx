import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, User, Phone, Mail, MapPin, Pencil, Trash2, ExternalLink, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "../components/common/ConfirmDialog";
import EmptyState from "../components/common/EmptyState";

const EMPTY = { name: "", email: "", phone: "", city: "", additional_cities: [], role: "dj", is_active: true, notes: "", linked_user_email: "" };
const roleLabel = { dj: "DJ", mc: "MC", dj_mc: "DJ + MC" };
const roleColors = { dj: "bg-violet-50 text-violet-700", mc: "bg-blue-50 text-blue-700", dj_mc: "bg-indigo-50 text-indigo-700" };

export default function DJRoster() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();

  const { data: djs = [], isLoading } = useQuery({
    queryKey: ["dj-roster"],
    queryFn: () => base44.entities.DJProfile.list("name", 200),
  });

  const cities = [...new Set(djs.map(d => d.city).filter(Boolean))].sort();

  const filtered = djs.filter(dj => {
    const matchSearch = !search || `${dj.name} ${dj.city} ${dj.email}`.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || dj.role === roleFilter;
    const matchCity = cityFilter === "all" || dj.city === cityFilter;
    const matchActive = showInactive || dj.is_active !== false;
    return matchSearch && matchRole && matchCity && matchActive;
  });

  const openNew = () => { setEditing(null); setForm(EMPTY); setShowDialog(true); };
  const openEdit = (dj) => { setEditing(dj); setForm({ ...EMPTY, ...dj }); setShowDialog(true); };

  const handleSave = async () => {
    if (!form.name) return toast.error("Name is required.");
    setSaving(true);
    if (editing) {
      await base44.entities.DJProfile.update(editing.id, form);
      toast.success("DJ profile updated.");
    } else {
      await base44.entities.DJProfile.create(form);
      toast.success("DJ added to roster.");
    }
    setSaving(false);
    setShowDialog(false);
    queryClient.invalidateQueries(["dj-roster"]);
  };

  const handleToggleActive = async (dj) => {
    await base44.entities.DJProfile.update(dj.id, { is_active: !dj.is_active });
    toast.success(dj.is_active ? `${dj.name} deactivated.` : `${dj.name} activated.`);
    queryClient.invalidateQueries(["dj-roster"]);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await base44.entities.DJProfile.delete(confirmDelete.id);
    toast.success(`"${confirmDelete.name}" removed from roster.`);
    setDeleting(false);
    setConfirmDelete(null);
    queryClient.invalidateQueries(["dj-roster"]);
  };

  const activeDJs = djs.filter(d => d.is_active !== false).length;

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">DJ Roster</h1>
          <p className="text-sm text-gray-500 mt-0.5">{activeDJs} active · {djs.length} total</p>
        </div>
        <Button onClick={openNew} className="bg-gradient-to-r from-violet-600 to-indigo-600 text-sm h-9">
          <Plus className="w-4 h-4 mr-1.5" /> Add DJ
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search DJs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-32 h-9 text-sm bg-white"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="dj">DJ</SelectItem>
            <SelectItem value="mc">MC</SelectItem>
            <SelectItem value="dj_mc">DJ + MC</SelectItem>
          </SelectContent>
        </Select>
        {cities.length > 0 && (
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-36 h-9 text-sm bg-white"><SelectValue placeholder="City" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer ml-auto">
          <Switch checked={showInactive} onCheckedChange={setShowInactive} className="scale-75" />
          Show inactive
        </label>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={User} title="No DJs found" description={djs.length === 0 ? "Add your first DJ to build the roster." : "Try adjusting filters."} actionLabel={djs.length === 0 ? "Add DJ" : undefined} onAction={djs.length === 0 ? openNew : undefined} />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(dj => (
            <Card key={dj.id} className={`border-0 shadow-sm transition-all hover:shadow-md ${dj.is_active === false ? "opacity-60" : ""}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{dj.name}</p>
                      <Badge variant="secondary" className={`text-[10px] mt-0.5 ${roleColors[dj.role]}`}>{roleLabel[dj.role] || dj.role}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Switch checked={dj.is_active !== false} onCheckedChange={() => handleToggleActive(dj)} className="scale-75" />
                    <Link to={createPageUrl("DJDetail") + `?id=${dj.id}`}>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="View profile">
                        <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                      </Button>
                    </Link>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(dj)}>
                      <Pencil className="w-3.5 h-3.5 text-gray-400" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => setConfirmDelete(dj)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-gray-500">
                  {dj.city && <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{dj.city}</div>}
                  {dj.phone && <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{dj.phone}</div>}
                  {dj.email && <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate">{dj.email}</span></div>}
                  {dj.notes && <p className="text-gray-400 text-[11px] mt-2 italic">{dj.notes}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit DJ Profile" : "Add DJ to Roster"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Name *</Label>
                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Phone</Label>
                <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Home City</Label>
                <Input value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Role</Label>
                <Select value={form.role} onValueChange={v => setForm({...form, role: v})}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dj">DJ</SelectItem>
                    <SelectItem value="mc">MC</SelectItem>
                    <SelectItem value="dj_mc">DJ + MC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">CRM User Email (optional – links login)</Label>
              <Input value={form.linked_user_email} onChange={e => setForm({...form, linked_user_email: e.target.value})} className="mt-1" placeholder="dj@yourcompany.com" />
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="mt-1" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm({...form, is_active: v})} />
              <Label className="text-xs">Active</Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !form.name} className="bg-violet-600 hover:bg-violet-700">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                {editing ? "Update" : "Add to Roster"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Remove from Roster?"
        description={`"${confirmDelete?.name}" will be permanently removed.`}
        confirmLabel="Remove DJ"
      />
    </div>
  );
}