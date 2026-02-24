import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ContractAPI } from "../components/api/secureApi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FileSignature, Loader2, Pencil, Trash2, Send, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import EmptyState from "../components/common/EmptyState";
import ConfirmDialog from "../components/common/ConfirmDialog";
import ContractFormModal from "../components/contracts/ContractFormModal";

const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-50 text-blue-700",
  viewed: "bg-violet-50 text-violet-700",
  signed: "bg-emerald-50 text-emerald-700",
  voided: "bg-red-50 text-red-700",
};

export default function Contracts() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [signDialog, setSignDialog] = useState(null);
  const [signerName, setSignerName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [actioning, setActioning] = useState(null);
  const queryClient = useQueryClient();

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["contracts"],
    queryFn: () => ContractAPI.list({}, "-created_date", 300),
  });

  const filtered = contracts.filter(c => {
    const matchSearch = !search || c.contact_name?.toLowerCase().includes(search.toLowerCase()) || c.contact_email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openNew = () => { setEditingContract(null); setFormOpen(true); };
  const openEdit = (c) => { setEditingContract(c); setFormOpen(true); };

  const handleDelete = async () => {
    setDeleting(true);
    await ContractAPI.delete(confirmDelete.id);
    toast.success("Contract deleted.");
    setDeleting(false);
    setConfirmDelete(null);
    queryClient.invalidateQueries(["contracts"]);
  };

  const handleSend = async (contract) => {
    setActioning(contract.id + "send");
    await ContractAPI.send(contract.id);
    toast.success("Contract marked as sent.");
    setActioning(null);
    queryClient.invalidateQueries(["contracts"]);
  };

  const handleSign = async () => {
    setActioning(signDialog.id + "sign");
    await ContractAPI.sign(signDialog.id, signerName || signDialog.contact_name);
    toast.success("Contract marked as signed. Event updated.");
    setActioning(null);
    setSignDialog(null);
    setSignerName("");
    queryClient.invalidateQueries(["contracts"]);
  };

  const handleVoid = async (contract) => {
    setActioning(contract.id + "void");
    await ContractAPI.void(contract.id);
    toast.success("Contract voided.");
    setActioning(null);
    queryClient.invalidateQueries(["contracts"]);
  };

  const signed = contracts.filter(c => c.status === "signed");
  const pending = contracts.filter(c => ["sent","draft"].includes(c.status));

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Contracts</h1>
          <p className="text-sm text-gray-500 mt-0.5">{contracts.length} total · {signed.length} signed · {pending.length} pending</p>
        </div>
        <Button onClick={openNew} className="bg-gradient-to-r from-violet-600 to-indigo-600 text-sm h-9">
          <Plus className="w-4 h-4 mr-1.5" /> New Contract
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search by contact..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm bg-white" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.keys(STATUS_COLORS).map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={FileSignature} title="No contracts found" description="Create a contract linked to an event." actionLabel="New Contract" onAction={openNew} />
      ) : (
        <Card className="border-0 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="text-xs font-semibold">Contact</TableHead>
                <TableHead className="text-xs font-semibold">Event</TableHead>
                <TableHead className="text-xs font-semibold">Amount</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold">Sent</TableHead>
                <TableHead className="text-xs font-semibold">Signed</TableHead>
                <TableHead className="w-52" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.id} className="hover:bg-gray-50/60">
                  <TableCell>
                    <div className="font-medium text-sm">{c.contact_name}</div>
                    {c.contact_email && <div className="text-xs text-gray-400">{c.contact_email}</div>}
                  </TableCell>
                  <TableCell>
                    {c.event_id ? (
                      <Link to={createPageUrl("EventDetail") + `?id=${c.event_id}`} className="text-xs text-violet-600 hover:underline">View Event</Link>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-sm font-bold">${(c.contract_amount || 0).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="secondary" className={`text-[10px] capitalize ${STATUS_COLORS[c.status]}`}>{c.status}</Badge></TableCell>
                  <TableCell className="text-xs text-gray-400">{c.sent_date ? format(new Date(c.sent_date), "MMM d") : "—"}</TableCell>
                  <TableCell className="text-xs text-gray-500 font-medium">{c.signed_date ? format(new Date(c.signed_date), "MMM d, yyyy") : "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 flex-wrap">
                      {c.status === "draft" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-blue-600 border-blue-200"
                          disabled={actioning === c.id + "send"} onClick={() => handleSend(c)}>
                          <Send className="w-3 h-3 mr-1" />Send
                        </Button>
                      )}
                      {c.status === "sent" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-emerald-600 border-emerald-200"
                          onClick={() => { setSignDialog(c); setSignerName(c.contact_name || ""); }}>
                          <CheckCircle2 className="w-3 h-3 mr-1" />Mark Signed
                        </Button>
                      )}
                      {["draft","sent"].includes(c.status) && (
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-red-500 border-red-200"
                          disabled={actioning === c.id + "void"} onClick={() => handleVoid(c)}>
                          <XCircle className="w-3 h-3 mr-1" />Void
                        </Button>
                      )}
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

      <ContractFormModal open={formOpen} onClose={() => setFormOpen(false)} contract={editingContract} onSaved={() => queryClient.invalidateQueries(["contracts"])} />

      {/* Sign dialog */}
      <Dialog open={!!signDialog} onOpenChange={() => setSignDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Mark as Signed</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Signer Name</Label>
              <Input value={signerName} onChange={e => setSignerName(e.target.value)} className="mt-1" placeholder="Full name of signer" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setSignDialog(null)}>Cancel</Button>
              <Button onClick={handleSign} disabled={!signerName || actioning} className="bg-emerald-600 hover:bg-emerald-700">
                {actioning ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                Confirm Signed
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!confirmDelete} onCancel={() => setConfirmDelete(null)} onConfirm={handleDelete} loading={deleting} title="Delete Contract?" description="This contract will be permanently removed." confirmLabel="Delete" />
    </div>
  );
}