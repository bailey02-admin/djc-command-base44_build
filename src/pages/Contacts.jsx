import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ContactAPI } from "../components/api/secureApi";
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
import { Loader2, Plus, Search, Mail, Phone, MapPin, User, ExternalLink, Pencil, Trash2 } from "lucide-react";

const ROLES = ["bride", "groom", "couple", "parent", "planner", "corporate_contact", "other"];
const CONTACT_METHODS = ["phone", "email", "text", "any"];

const EMPTY = {
  first_name: "", last_name: "", email: "", phone: "", secondary_phone: "",
  role: "", preferred_contact_method: "any", city: "", address: "", notes: "", tags: [],
};

export default function Contacts() {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => ContactAPI.list({}, "-created_date", 200),
  });

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase();
    return !q || [c.first_name, c.last_name, c.email, c.phone, c.city].some(f => f?.toLowerCase().includes(q));
  });

  const openNew = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (c) => { setEditing(c); setForm({ ...EMPTY, ...c }); setShowModal(true); };

  const handleSave = async () => {
    setSaving(true);
    if (editing) {
      await ContactAPI.update(editing.id, form);
    } else {
      await ContactAPI.create(form);
    }
    qc.invalidateQueries({ queryKey: ["contacts"] });
    setSaving(false);
    setShowModal(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this contact?")) return;
    await ContactAPI.delete(id);
    qc.invalidateQueries({ queryKey: ["contacts"] });
  };

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-sm text-gray-500 mt-0.5">{contacts.length} total contacts</p>
        </div>
        <Button onClick={openNew} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
          <Plus className="w-4 h-4" /> Add Contact
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input className="pl-9" placeholder="Search by name, email, city…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">No contacts found.</div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(c => (
            <Card key={c.id} className="border-0 shadow-sm hover:shadow-md transition-shadow group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-violet-500" />
                    </div>
                    <div>
                      <Link to={createPageUrl("ContactDetail") + `?id=${c.id}`} className="font-semibold text-gray-900 hover:text-violet-600 transition-colors flex items-center gap-1 group/link">
                        {c.first_name} {c.last_name}
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                      </Link>
                      {c.role && <Badge variant="secondary" className="text-[10px] mt-0.5 capitalize">{c.role.replace(/_/g, " ")}</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  {c.email && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Mail className="w-3 h-3 flex-shrink-0" />
                      <a href={`mailto:${c.email}`} className="truncate hover:text-violet-600">{c.email}</a>
                    </div>
                  )}
                  {c.phone && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Phone className="w-3 h-3 flex-shrink-0" />
                      <a href={`tel:${c.phone}`} className="hover:text-violet-600">{c.phone}</a>
                    </div>
                  )}
                  {c.city && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <MapPin className="w-3 h-3 flex-shrink-0" />{c.city}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Contact" : "New Contact"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>First Name *</Label>
                <Input value={form.first_name} onChange={e => set("first_name", e.target.value)} placeholder="First name" />
              </div>
              <div className="space-y-1">
                <Label>Last Name</Label>
                <Input value={form.last_name} onChange={e => set("last_name", e.target.value)} placeholder="Last name" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@example.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="(555) 555-5555" />
              </div>
              <div className="space-y-1">
                <Label>Secondary Phone</Label>
                <Input value={form.secondary_phone} onChange={e => set("secondary_phone", e.target.value)} placeholder="(555) 555-5555" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={v => set("role", v)}>
                  <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Preferred Contact</Label>
                <Select value={form.preferred_contact_method} onValueChange={v => set("preferred_contact_method", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTACT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>City</Label>
                <Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="City" />
              </div>
              <div className="space-y-1">
                <Label>Address</Label>
                <Input value={form.address} onChange={e => set("address", e.target.value)} placeholder="Street address" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Notes…" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.first_name || !form.email} className="bg-violet-600 hover:bg-violet-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? "Save Changes" : "Create Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}