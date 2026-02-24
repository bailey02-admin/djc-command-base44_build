import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QuoteAPI } from "../components/api/secureApi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FileText, Loader2, Pencil, Trash2, Send, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import EmptyState from "../components/common/EmptyState";
import ConfirmDialog from "../components/common/ConfirmDialog";
import QuoteBuilderModal from "../components/quotes/QuoteBuilderModal";

const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-50 text-blue-700",
  viewed: "bg-violet-50 text-violet-700",
  accepted: "bg-emerald-50 text-emerald-700",
  declined: "bg-red-50 text-red-700",
  expired: "bg-amber-50 text-amber-700",
};

export default function Quotes() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [actioning, setActioning] = useState(null);
  const queryClient = useQueryClient();

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["quotes"],
    queryFn: () => QuoteAPI.list({}, "-created_date", 300),
  });

  const filtered = quotes.filter(q => {
    const matchSearch = !search || q.contact_name?.toLowerCase().includes(search.toLowerCase()) || q.package_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || q.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openNew = () => { setEditingQuote(null); setBuilderOpen(true); };
  const openEdit = (q) => { setEditingQuote(q); setBuilderOpen(true); };

  const handleDelete = async () => {
    setDeleting(true);
    await QuoteAPI.delete(confirmDelete.id);
    toast.success("Quote deleted.");
    setDeleting(false);
    setConfirmDelete(null);
    queryClient.invalidateQueries(["quotes"]);
  };

  const handleAction = async (quote, action) => {
    setActioning(quote.id + action);
    try {
      if (action === "send") await QuoteAPI.send(quote.id);
      if (action === "accept") await QuoteAPI.accept(quote.id);
      if (action === "decline") await QuoteAPI.decline(quote.id);
      toast.success(`Quote ${action}ed.`);
      queryClient.invalidateQueries(["quotes"]);
    } finally { setActioning(null); }
  };

  const totalAccepted = quotes.filter(q => q.status === "accepted").reduce((s, q) => s + (q.total_amount || 0), 0);
  const totalPending  = quotes.filter(q => ["sent","draft"].includes(q.status)).reduce((s, q) => s + (q.total_amount || 0), 0);

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Quotes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{quotes.length} total · ${totalAccepted.toLocaleString()} accepted · ${totalPending.toLocaleString()} pending</p>
        </div>
        <Button onClick={openNew} className="bg-gradient-to-r from-violet-600 to-indigo-600 text-sm h-9">
          <Plus className="w-4 h-4 mr-1.5" /> New Quote
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search by contact or package..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm bg-white" />
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
        <EmptyState icon={FileText} title="No quotes found" description="Create your first quote from a lead or here." actionLabel="New Quote" onAction={openNew} />
      ) : (
        <Card className="border-0 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="text-xs font-semibold">Contact</TableHead>
                <TableHead className="text-xs font-semibold">Package</TableHead>
                <TableHead className="text-xs font-semibold">Total</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold">Created</TableHead>
                <TableHead className="text-xs font-semibold">Sent</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(q => (
                <TableRow key={q.id} className="hover:bg-gray-50/60">
                  <TableCell>
                    <div className="font-medium text-sm">{q.contact_name || "—"}</div>
                    {q.lead_id && (
                      <Link to={createPageUrl("LeadDetail") + `?id=${q.lead_id}`} className="text-xs text-violet-600 hover:underline">View Lead</Link>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-gray-700">{q.package_name}</TableCell>
                  <TableCell className="text-sm font-bold">${(q.total_amount || 0).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="secondary" className={`text-[10px] capitalize ${STATUS_COLORS[q.status]}`}>{q.status}</Badge></TableCell>
                  <TableCell className="text-xs text-gray-400">{q.created_date ? format(new Date(q.created_date), "MMM d, yyyy") : "—"}</TableCell>
                  <TableCell className="text-xs text-gray-400">{q.sent_date ? format(new Date(q.sent_date), "MMM d") : "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {q.status === "draft" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-blue-600 border-blue-200"
                          disabled={actioning === q.id + "send"} onClick={() => handleAction(q, "send")}>
                          <Send className="w-3 h-3 mr-1" />Send
                        </Button>
                      )}
                      {q.status === "sent" && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-emerald-600 border-emerald-200"
                            disabled={actioning === q.id + "accept"} onClick={() => handleAction(q, "accept")}>
                            <CheckCircle2 className="w-3 h-3 mr-1" />Accept
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-red-500 border-red-200"
                            disabled={actioning === q.id + "decline"} onClick={() => handleAction(q, "decline")}>
                            <XCircle className="w-3 h-3 mr-1" />Decline
                          </Button>
                        </>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(q)}>
                        <Pencil className="w-3.5 h-3.5 text-gray-400" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => setConfirmDelete(q)}>
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

      <QuoteBuilderModal open={builderOpen} onClose={() => setBuilderOpen(false)} quote={editingQuote} onSaved={() => queryClient.invalidateQueries(["quotes"])} />

      <ConfirmDialog open={!!confirmDelete} onCancel={() => setConfirmDelete(null)} onConfirm={handleDelete} loading={deleting} title="Delete Quote?" description="This quote will be permanently removed." confirmLabel="Delete" />
    </div>
  );
}