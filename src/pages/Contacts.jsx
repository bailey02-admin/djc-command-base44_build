import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ContactAPI } from "../components/api/secureApi";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Search, Mail, Phone, MapPin, User, ExternalLink, Pencil, Trash2, ChevronUp, ChevronDown, ChevronsUpDown, ArrowRight } from "lucide-react";

const ROLES = ["bride", "groom", "couple", "parent", "planner", "corporate_contact", "other"];
const CONTACT_METHODS = ["phone", "email", "text", "any"];

const EMPTY = {
  first_name: "", last_name: "", email: "", phone: "", secondary_phone: "",
  organization_name: "", role: "", preferred_contact_method: "any", city: "", address: "", notes: "", tags: [],
};

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ChevronsUpDown className="w-3 h-3 text-gray-300" />;
  return sortDir === "asc" ? <ChevronUp className="w-3 h-3 text-violet-500" /> : <ChevronDown className="w-3 h-3 text-violet-500" />;
}

export default function Contacts() {
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("last_name");
  const [sortDir, setSortDir] = useState("asc");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => ContactAPI.list({}, "-created_date", 500),
  });

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const displayed = useMemo(() => {
    let list = contacts;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => [c.first_name, c.last_name, c.email, c.phone, c.city].some(f => f?.toLowerCase().includes(q)));
    }
    return [...list].sort((a, b) => {
      let av, bv;
      switch (sortCol) {
        case "name":  av = `${a.last_name} ${a.first_name}`; bv = `${b.last_name} ${b.first_name}`; break;
        case "city":  av = a.city || ""; bv = b.city || ""; break;
        case "email": av = a.email || ""; bv = b.email || ""; break;
        case "role":  av = a.role || ""; bv = b.role || ""; break;
        default:      av = ""; bv = "";
      }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [contacts, search, sortCol, sortDir]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (c, e) => { e.stopPropagation(); setEditing(c); setForm({ ...EMPTY, ...c }); setShowModal(true); };

  const handleSave = async () => {
    setSaving(true);
    if (editing) await ContactAPI.update(editing.id, form);
    else await ContactAPI.create(form);
    qc.invalidateQueries({ queryKey: ["contacts"] });
    setSaving(false); setShowModal(false);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this contact?")) return;
    await ContactAPI.delete(id);
    qc.invalidateQueries({ queryKey: ["contacts"] });
  };

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const thCls = "px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-800 whitespace-nowrap";

  return (
    <div className="p-4 lg:p-8 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-sm text-gray-500 mt-0.5">{contacts.length} total{displayed.length !== contacts.length ? ` · ${displayed.length} shown` : ""}</p>
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

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {[
                  { col: "name",  label: "Name" },
                  { col: "city",  label: "City" },
                  { col: "email", label: "Email" },
                  { col: "phone", label: "Phone" },
                  { col: "role",  label: "Role" },
                ].map(({ col, label }) => (
                  <th key={col} className={thCls} onClick={() => handleSort(col)}>
                    <span className="flex items-center gap-1">{label} <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} /></span>
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-3.5 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : displayed.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16 text-gray-400 text-sm">No contacts found.</td></tr>
              ) : displayed.map(c => (
                <tr
                  key={c.id}
                  className="border-b border-gray-50 hover:bg-violet-50/40 cursor-pointer transition-colors"
                  onClick={() => window.location.href = createPageUrl("ContactDetail") + `?id=${c.id}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
                        <User className="w-3.5 h-3.5 text-violet-500" />
                      </div>
                      <span className="font-medium text-gray-900">{c.first_name} {c.last_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm">{c.city || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 text-sm max-w-[200px] truncate">
                    {c.email ? <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} className="hover:text-violet-600">{c.email}</a> : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm whitespace-nowrap">
                    {c.phone ? <a href={`tel:${c.phone}`} onClick={e => e.stopPropagation()} className="hover:text-violet-600">{c.phone}</a> : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {c.role && <Badge variant="secondary" className="text-[10px] capitalize">{c.role.replace(/_/g, " ")}</Badge>}
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <Link to={createPageUrl("ContactDetail") + `?id=${c.id}`} onClick={e => e.stopPropagation()}>
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2 gap-1">Open <ArrowRight className="w-3 h-3" /></Button>
                      </Link>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => openEdit(c, e)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={(e) => handleDelete(c.id, e)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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