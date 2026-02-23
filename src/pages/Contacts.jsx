import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Mail, Phone, Loader2, Save } from "lucide-react";

export default function Contacts() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", role: "couple", city: "", notes: "" });
  const queryClient = useQueryClient();

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 200),
  });

  const filtered = contacts.filter(c =>
    !search || `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.Contact.create(form);
    setForm({ first_name: "", last_name: "", email: "", phone: "", role: "couple", city: "", notes: "" });
    setSaving(false);
    setDialogOpen(false);
    queryClient.invalidateQueries(["contacts"]);
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Contacts</h1>
          <p className="text-sm text-gray-500 mt-0.5">{contacts.length} contacts</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 text-sm h-9">
              <Plus className="w-4 h-4 mr-1.5" /> Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Contact</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-xs">First Name *</Label><Input value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} className="mt-1" /></div>
                <div><Label className="text-xs">Last Name</Label><Input value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} className="mt-1" /></div>
                <div><Label className="text-xs">Email *</Label><Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="mt-1" /></div>
                <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="mt-1" /></div>
                <div><Label className="text-xs">Role</Label>
                  <Select value={form.role} onValueChange={v => setForm({...form, role: v})}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["bride","groom","couple","parent","planner","corporate_contact","other"].map(r => (
                        <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">City</Label><Input value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="mt-1" /></div>
              </div>
              <Button onClick={handleSave} disabled={saving || !form.first_name || !form.email} className="w-full bg-violet-600 hover:bg-violet-700">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Save Contact
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm bg-white" />
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/80">
              <TableHead className="text-xs font-semibold">Name</TableHead>
              <TableHead className="text-xs font-semibold">Email</TableHead>
              <TableHead className="text-xs font-semibold">Phone</TableHead>
              <TableHead className="text-xs font-semibold">Role</TableHead>
              <TableHead className="text-xs font-semibold">City</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(c => (
              <TableRow key={c.id} className="hover:bg-gray-50/50">
                <TableCell className="text-sm font-medium">{c.first_name} {c.last_name}</TableCell>
                <TableCell className="text-sm text-gray-500">{c.email}</TableCell>
                <TableCell className="text-sm text-gray-500">{c.phone || "—"}</TableCell>
                <TableCell><Badge variant="secondary" className="text-[10px] capitalize">{c.role?.replace(/_/g, " ")}</Badge></TableCell>
                <TableCell className="text-sm text-gray-500">{c.city || "—"}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-10 text-gray-400 text-sm">No contacts found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}