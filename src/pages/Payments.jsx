import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PaymentAPI } from "../components/api/secureApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, DollarSign, Loader2, Save } from "lucide-react";
import { format } from "date-fns";
import StatCard from "../components/dashboard/StatCard";

const statusColors = {
  pending: "bg-yellow-50 text-yellow-700",
  paid: "bg-emerald-50 text-emerald-700",
  overdue: "bg-red-50 text-red-700",
  waived: "bg-gray-100 text-gray-600",
  refunded: "bg-blue-50 text-blue-700",
};

export default function Payments() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ event_id: "", contact_name: "", amount: "", payment_type: "deposit", due_date: "", status: "pending", payment_method: "credit_card", notes: "" });

  const { data: payments = [] } = useQuery({
    queryKey: ["all-payments"],
    queryFn: () => base44.entities.Payment.list("-created_date", 200),
  });

  const filtered = payments.filter(p => {
    const matchSearch = !search || p.contact_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPaid = payments.filter(p => p.status === "paid").reduce((s, p) => s + (p.amount || 0), 0);
  const totalPending = payments.filter(p => p.status === "pending").reduce((s, p) => s + (p.amount || 0), 0);
  const totalOverdue = payments.filter(p => p.status === "overdue").reduce((s, p) => s + (p.amount || 0), 0);

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.Payment.create({ ...form, amount: Number(form.amount) });
    setForm({ event_id: "", contact_name: "", amount: "", payment_type: "deposit", due_date: "", status: "pending", payment_method: "credit_card", notes: "" });
    setSaving(false);
    setDialogOpen(false);
    queryClient.invalidateQueries(["all-payments"]);
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Payments</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 text-sm h-9"><Plus className="w-4 h-4 mr-1.5" /> Record Payment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-xs">Contact Name</Label><Input value={form.contact_name} onChange={e => setForm({...form, contact_name: e.target.value})} className="mt-1" /></div>
                <div><Label className="text-xs">Amount *</Label><Input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="mt-1" /></div>
                <div><Label className="text-xs">Type</Label>
                  <Select value={form.payment_type} onValueChange={v => setForm({...form, payment_type: v})}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["deposit","installment","final_balance","refund","additional"].map(t => (
                        <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} className="mt-1" /></div>
                <div><Label className="text-xs">Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["pending","paid","overdue","waived","refunded"].map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Method</Label>
                  <Select value={form.payment_method} onValueChange={v => setForm({...form, payment_method: v})}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["credit_card","check","cash","bank_transfer","paypal","venmo","other"].map(m => (
                        <SelectItem key={m} value={m}>{m.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving || !form.amount} className="w-full bg-violet-600 hover:bg-violet-700">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Collected" value={`$${totalPaid.toLocaleString()}`} icon={DollarSign} color="emerald" />
        <StatCard title="Pending" value={`$${totalPending.toLocaleString()}`} icon={DollarSign} color="amber" />
        <StatCard title="Overdue" value={`$${totalOverdue.toLocaleString()}`} icon={DollarSign} color="rose" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm bg-white" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {Object.keys(statusColors).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/80">
              <TableHead className="text-xs font-semibold">Contact</TableHead>
              <TableHead className="text-xs font-semibold">Type</TableHead>
              <TableHead className="text-xs font-semibold">Amount</TableHead>
              <TableHead className="text-xs font-semibold">Due Date</TableHead>
              <TableHead className="text-xs font-semibold">Status</TableHead>
              <TableHead className="text-xs font-semibold">Method</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(p => (
              <TableRow key={p.id}>
                <TableCell className="text-sm font-medium">{p.contact_name || "—"}</TableCell>
                <TableCell className="text-sm text-gray-500 capitalize">{p.payment_type?.replace(/_/g, " ")}</TableCell>
                <TableCell className="text-sm font-bold">${p.amount?.toLocaleString()}</TableCell>
                <TableCell className="text-sm text-gray-500">{p.due_date ? format(new Date(p.due_date), "MMM d, yyyy") : "—"}</TableCell>
                <TableCell><Badge variant="secondary" className={`text-[10px] ${statusColors[p.status]}`}>{p.status}</Badge></TableCell>
                <TableCell className="text-sm text-gray-500 capitalize">{p.payment_method?.replace(/_/g, " ") || "—"}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-gray-400 text-sm">No payments found.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}