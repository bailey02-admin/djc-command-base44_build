import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Mail, Phone, Pencil, Trash2, Users, Loader2, Save, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "../components/common/ConfirmDialog";
import EmptyState from "../components/common/EmptyState";

const ROLES = ["bride","groom","couple","parent","planner","corporate_contact","other"];
const EMPTY = { first_name: "", last_name: "", email: "", phone: "", secondary_phone: "", role: "couple", city: "", address: "", notes: "" };

export default function Contacts() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 300),
  });

  const cities = [...new Set(contacts.map(c => c.city).filter(Boolean))].sort();

  const filtered = contacts.filter(c => {
    const matchSearch = !search || `${c.first_name} ${c.last_name} ${c.email} ${c.phone}`.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || c.role === roleFilter;
    const matchCity = cityFilter === "all" || c.city === cityFilter;
    return matchSearch && matchRole && matchCity;
  });

  const openNew = () => { setEditingId(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (c) => { setEditingId(c.id); setForm({ ...EMPTY, ...c }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.first_name || !form.email) return toast.error("First name and email are required.");
    setSaving(true);
    if (editingId) {
      await base44.entities.Contact.update(editingId, form);
      toast.success("Contact updated.");
    } else {
      await base44.entities.Contact.create(form);
      toast.success("Contact created.");
    }
    setSaving(false);
    setDialogOpen(false);
    queryClient.invalidateQueries(["contacts"]);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await base44.entities.Contact.delete(confirmDelete.id);
    toast.success(`"${confirmDelete.first_name} ${confirmDelete.last_name}" deleted.`);
    setDeleting(false);
    setConfirmDelete(null);
    queryClient.invalidateQueries(["contacts"]);
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Contacts</h1>
          <p className="text-sm text-gray-500 mt-0.5">{contacts.length} contacts</p>
        </div>
        <Button onClick={openNew} className="bg-gradient-to-r from-violet-600 to-indigo-600 text-sm h-9">
          <Plus className="w-4 h-4 mr-1.5" /> Add Contact
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search by name, email, phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm bg-white" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40 h-9 text-sm bg-white"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ROLES.map(r => <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>)}
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
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="No contacts found" description={search ? "Try a different search." : "Add your first contact."} actionLabel={!search ? "Add Contact" : undefined} onAction={!search ? openNew : undefined} />
      ) : (
        <Card className="border-0 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="text-xs font-semibold">Name</TableHead>
                <TableHead className="text-xs font-semibold">Email</TableHead>
                <TableHead className="text-xs font-semibold">Phone</TableHead>
                <TableHead className="text-xs font-semibold">Role</TableHead>
                <TableHead className="text-xs font-semibold">City</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.id} className="hover:bg-gray-50/60">
                  <TableCell className="text-sm font-medium">{c.first_name} {c.last_name}</TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {c.email ? <a href={`mailto:${c.email}`} className="hover:text-violet-600 hover:underline">{c.email}</a> : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">{c.phone || "—"}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px] capitalize">{c.role?.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell className="text-sm text-gray-500">{c.city || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link to={createPageUrl("ContactDetail") + `?id=${c.id}`}>
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="View detail">
                          <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                        </Button>
                      </Link>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}>
                        <Pencil className="w-3.5 h-3.5 text-gray-400" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => setConfirmDelete(c)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingId ? "Edit Contact" : "New Contact"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">First Name *</Label><Input value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} className="mt-1" /></div>
              <div><Label className="text-xs">Last Name</Label><Input value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} className="mt-1" /></div>
              <div><Label className="text-xs">Email *</Label><Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="mt-1" /></div>
              <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="mt-1" /></div>
              <div><Label className="text-xs">Secondary Phone</Label><Input value={form.secondary_phone} onChange={e => setForm({...form, secondary_phone: e.target.value})} className="mt-1" /></div>
              <div><Label className="text-xs">Role</Label>
                <Select value={form.role} onValueChange={v => setForm({...form, role: v})}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">City</Label><Input value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="mt-1" /></div>
              <div><Label className="text-xs">Address</Label><Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="mt-1" /></div>
            </div>
            <div><Label className="text-xs">Notes</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="mt-1" /></div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !form.first_name || !form.email} className="bg-violet-600 hover:bg-violet-700">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                {editingId ? "Update" : "Save Contact"}
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
        title="Delete Contact?"
        description={`"${confirmDelete?.first_name} ${confirmDelete?.last_name}" will be permanently removed.`}
        confirmLabel="Delete Contact"
      />
    </div>
  );
}