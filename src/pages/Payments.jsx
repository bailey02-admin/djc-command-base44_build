import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PaymentAPI } from "../components/api/secureApi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, DollarSign, Loader2, Save, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import StatCard from "../components/dashboard/StatCard";
import ConfirmDialog from "../components/common/ConfirmDialog";
import EmptyState from "../components/common/EmptyState";

const statusColors = {
  pending: "bg-yellow-50 text-yellow-700",
  paid: "bg-emerald-50 text-emerald-700",
  overdue: "bg-red-50 text-red-700",
  waived: "bg-gray-100 text-gray-600",
  refunded: "bg-blue-50 text-blue-700",
};

const EMPTY = { event_id: "", contact_name: "", amount: "", payment_type: "deposit", due_date: "", paid_date: "", status: "pending", payment_method: "credit_card", transaction_reference: "", notes: "" };

export default function Payments() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const queryClient = useQueryClient();

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["all-payments"],
    queryFn: () => PaymentAPI.list(300),
  });

  const filtered = payments.filter(p => {
    const matchSearch = !search || p.contact_name?.toLowerCase().includes(search.toLowerCase()) || p.transaction_reference?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchType = typeFilter === "all" || p.payment_type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const realPayments = payments.filter(p => (p.amount || 0) > 0);
  const totalPaid    = realPayments.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const totalPending = realPayments.filter(p => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  const totalOverdue = realPayments.filter(p => p.status === "overdue").reduce((s, p) => s + p.amount, 0);

  const openNew = () => { setEditingId(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (p) => { setEditingId(p.id); setForm({ ...EMPTY, ...p, amount: p.amount?.toString() || "" }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.amount || isNaN(Number(form.amount))) return toast.error("A valid amount is required.");
    setSaving(true);
    const payload = { ...form, amount: Number(form.amount) };
    if (editingId) {
      await PaymentAPI.update(editingId, payload);
      toast.success("Payment updated.");
    } else {
      await PaymentAPI.create(payload);
      toast.success("Payment recorded.");
    }
    setSaving(false);
    setDialogOpen(false);
    queryClient.invalidateQueries(["all-payments"]);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await PaymentAPI.delete(confirmDelete.id);
    toast.success("Payment deleted.");
    setDeleting(false);
    setConfirmDelete(null);
    queryClient.invalidateQueries(["all-payments"]);
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Payments</h1>
        <Button onClick={openNew} className="bg-gradient-to-r from-violet-600 to-indigo-600 text-sm h-9">
          <Plus className="w-4 h-4 mr-1.5" /> Record Payment
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Collected" value={`$${totalPaid.toLocaleString()}`} icon={DollarSign} color="emerald" />
        <StatCard title="Pending" value={`$${totalPending.toLocaleString()}`} icon={DollarSign} color="amber" />
        <StatCard title="Overdue" value={`$${totalOverdue.toLocaleString()}`} icon={DollarSign} color="rose" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search by contact or reference..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm bg-white" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.keys(statusColors).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36 h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {["deposit","installment","final_balance","refund","additional"].map(t => (
              <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={DollarSign} title="No payments found" description={search ? "Try a different search." : "Record your first payment."} actionLabel={!search ? "Record Payment" : undefined} onAction={!search ? openNew : undefined} />
      ) : (
        <Card className="border-0 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="text-xs font-semibold">Contact</TableHead>
                <TableHead className="text-xs font-semibold">Type</TableHead>
                <TableHead className="text-xs font-semibold">Amount</TableHead>
                <TableHead className="text-xs font-semibold">Due Date</TableHead>
                <TableHead className="text-xs font-semibold">Paid Date</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold">Method</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => (
                <TableRow key={p.id} className="hover:bg-gray-50/60">
                  <TableCell className="text-sm font-medium">{p.contact_name || "—"}</TableCell>
                  <TableCell className="text-sm text-gray-500 capitalize">{p.payment_type?.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-sm font-bold">
                    {(p.amount || 0) === 0
                      ? <span className="text-amber-600 text-xs font-medium">$0 — needs update</span>
                      : `$${p.amount.toLocaleString()}`}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">{p.due_date ? format(new Date(p.due_date), "MMM d, yyyy") : "—"}</TableCell>
                  <TableCell className="text-sm text-gray-500">{p.paid_date ? format(new Date(p.paid_date), "MMM d, yyyy") : "—"}</TableCell>
                  <TableCell><Badge variant="secondary" className={`text-[10px] ${statusColors[p.status]}`}>{p.status}</Badge></TableCell>
                  <TableCell className="text-sm text-gray-500 capitalize">{p.payment_method?.replace(/_/g, " ") || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}>
                        <Pencil className="w-3.5 h-3.5 text-gray-400" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => setConfirmDelete(p)}>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? "Edit Payment" : "Record Payment"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Contact Name</Label><Input value={form.contact_name} onChange={e => setForm({...form, contact_name: e.target.value})} className="mt-1" /></div>
              <div><Label className="text-xs">Amount *</Label><Input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="mt-1" placeholder="0.00" /></div>
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
              <div><Label className="text-xs">Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} className="mt-1" /></div>
              <div><Label className="text-xs">Paid Date</Label><Input type="date" value={form.paid_date} onChange={e => setForm({...form, paid_date: e.target.value})} className="mt-1" /></div>
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
              <div><Label className="text-xs">Transaction Ref</Label><Input value={form.transaction_reference} onChange={e => setForm({...form, transaction_reference: e.target.value})} className="mt-1" placeholder="optional" /></div>
            </div>
            <div><Label className="text-xs">Notes</Label><Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="mt-1" /></div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !form.amount} className="bg-violet-600 hover:bg-violet-700">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                {editingId ? "Update" : "Save"}
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
        title="Delete Payment?"
        description={`This payment record will be permanently removed.`}
        confirmLabel="Delete"
      />
    </div>
  );
}