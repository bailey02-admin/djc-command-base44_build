import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, Download, ChevronLeft, ChevronRight, ExternalLink, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { createPageUrl } from "@/utils";
import FinanceDatePresets, { DATE_PRESETS } from "../components/finance/FinanceDatePresets";
import { exportToCsv } from "../components/finance/exportCsv";
import StatCard from "../components/dashboard/StatCard";

const CITIES = ["TUL", "DFW", "HOU", "SAT", "KC", "STL", "INDY", "NASH", "DEN", "ATL"];
const METHODS = ["credit_card", "check", "cash", "bank_transfer", "paypal", "venmo", "other"];
const PAGE_SIZE = 50;

const statusColors = {
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  overdue: "bg-red-50 text-red-700 border-red-200",
  waived: "bg-gray-100 text-gray-600 border-gray-200",
  refunded: "bg-blue-50 text-blue-700 border-blue-200",
};

function getInitialDates() {
  const urlParams = new URLSearchParams(window.location.search);
  const from = urlParams.get("date_from");
  const to = urlParams.get("date_to");
  if (from && to) return { date_from: from, date_to: to };
  const preset = DATE_PRESETS.find(p => p.label === "This Year");
  return preset ? preset.get() : { date_from: "2024-01-01", date_to: "2024-12-31" };
}

export default function FinancePayments() {
  const initial = getInitialDates();
  const urlParams = new URLSearchParams(window.location.search);

  const [dateFrom, setDateFrom] = useState(initial.date_from);
  const [dateTo, setDateTo] = useState(initial.date_to);
  const [activePreset, setActivePreset] = useState(urlParams.get("preset") || "This Year");
  const [city, setCity] = useState("all");
  const [method, setMethod] = useState("all");
  const [search, setSearch] = useState("");
  const [skip, setSkip] = useState(0);

  const queryKey = ["finance-payments", dateFrom, dateTo, city, method, search, skip];

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await base44.functions.invoke("getFinancePayments", {
        date_from: dateFrom,
        date_to: dateTo,
        city: city !== "all" ? city : undefined,
        method: method !== "all" ? method : undefined,
        search: search || undefined,
        limit: PAGE_SIZE,
        skip,
      });
      return res.data;
    },
    keepPreviousData: true,
  });

  const payments = data?.payments || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(skip / PAGE_SIZE) + 1;

  const totalAmount = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const paidAmount = payments.filter(p => p.status === "paid").reduce((s, p) => s + (p.amount || 0), 0);

  const handlePreset = (label, range) => {
    setActivePreset(label);
    setDateFrom(range.date_from);
    setDateTo(range.date_to);
    setSkip(0);
  };

  const handleExport = () => {
    const rows = payments.map(p => ({
      paid_date: p.paid_date || "",
      due_date: p.due_date || "",
      contact_name: p.contact_name || "",
      event_name: p.event_name || "",
      city: p.city || "",
      payment_type: p.payment_type || "",
      amount: p.amount || 0,
      status: p.status || "",
      payment_method: p.payment_method || "",
      transaction_reference: p.transaction_reference || "",
      notes: p.notes || "",
    }));
    exportToCsv(`finance_payments_${dateFrom}_${dateTo}.csv`, rows);
  };

  const openEvent = (eventId) => {
    if (!eventId) return;
    window.open(createPageUrl("EventDetail") + `?id=${eventId}`, "_blank");
  };

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Finance — Payments</h1>
          <p className="text-sm text-gray-500 mt-0.5">All recorded payments filtered by date, city, and method</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="gap-2 h-9 text-sm" disabled={payments.length === 0}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Matching Payments" value={total.toLocaleString()} icon={DollarSign} color="violet" />
        <StatCard title="This Page Total" value={`$${totalAmount.toLocaleString()}`} icon={DollarSign} color="amber" />
        <StatCard title="Paid (This Page)" value={`$${paidAmount.toLocaleString()}`} icon={DollarSign} color="emerald" />
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm p-4 space-y-3">
        <FinanceDatePresets active={activePreset} onSelect={handlePreset} />
        <div className="flex flex-wrap gap-3 items-center">
          <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setActivePreset("custom"); setSkip(0); }}
            className="h-9 text-sm w-40 bg-white" />
          <span className="text-gray-400 text-sm">to</span>
          <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setActivePreset("custom"); setSkip(0); }}
            className="h-9 text-sm w-40 bg-white" />

          <Select value={city} onValueChange={v => { setCity(v); setSkip(0); }}>
            <SelectTrigger className="w-36 h-9 text-sm bg-white"><SelectValue placeholder="All Cities" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={method} onValueChange={v => { setMethod(v); setSkip(0); }}>
            <SelectTrigger className="w-40 h-9 text-sm bg-white"><SelectValue placeholder="All Methods" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              {METHODS.map(m => <SelectItem key={m} value={m}>{m.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search contact, notes…" value={search}
              onChange={e => { setSearch(e.target.value); setSkip(0); }}
              className="pl-9 h-9 text-sm bg-white" />
          </div>
        </div>
      </Card>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>
      ) : payments.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-gray-400 gap-2">
          <DollarSign className="w-8 h-8 opacity-30" />
          <p className="text-sm">No payments found for the selected filters.</p>
        </div>
      ) : (
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <TableHead className="text-xs font-semibold">Paid Date</TableHead>
                  <TableHead className="text-xs font-semibold">Contact</TableHead>
                  <TableHead className="text-xs font-semibold">Event</TableHead>
                  <TableHead className="text-xs font-semibold">City</TableHead>
                  <TableHead className="text-xs font-semibold">Type</TableHead>
                  <TableHead className="text-xs font-semibold">Amount</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold">Method</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map(p => (
                  <TableRow key={p.id}
                    className="hover:bg-violet-50/40 cursor-pointer"
                    onClick={() => openEvent(p.event_id)}
                  >
                    <TableCell className="text-sm text-gray-600">
                      {p.paid_date ? format(new Date(p.paid_date), "MMM d, yyyy") : (p.due_date ? format(new Date(p.due_date), "MMM d, yyyy") : "—")}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-gray-800">{p.contact_name || "—"}</TableCell>
                    <TableCell className="text-sm text-gray-600 max-w-[160px] truncate">{p.event_name || "—"}</TableCell>
                    <TableCell className="text-sm text-gray-500">{p.city || "—"}</TableCell>
                    <TableCell className="text-sm text-gray-500 capitalize">{p.payment_type?.replace(/_/g, " ") || "—"}</TableCell>
                    <TableCell className="text-sm font-bold text-gray-800">${(p.amount || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] border ${statusColors[p.status] || ""}`}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500 capitalize">{p.payment_method?.replace(/_/g, " ") || "—"}</TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      {p.event_id && (
                        <button onClick={() => openEvent(p.event_id)} className="text-gray-300 hover:text-violet-500 transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of {total} payments
                {isFetching && <Loader2 className="inline w-3 h-3 ml-2 animate-spin text-violet-400" />}
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                  disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-gray-600">{currentPage} / {totalPages}</span>
                <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                  disabled={skip + PAGE_SIZE >= total} onClick={() => setSkip(skip + PAGE_SIZE)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}