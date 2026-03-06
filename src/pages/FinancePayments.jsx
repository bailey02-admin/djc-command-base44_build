import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Search, Download, ChevronLeft, ChevronRight, ExternalLink, DollarSign, TrendingUp, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { createPageUrl } from "@/utils";
import FinanceDatePresets, { DATE_PRESETS } from "../components/finance/FinanceDatePresets";
import { exportToCsv } from "../components/finance/exportCsv";
import StatCard from "../components/dashboard/StatCard";

const CITIES = ["TUL", "DFW", "HOU", "SAT", "KC", "STL", "INDY", "NASH", "DEN", "ATL"];
const METHODS = ["credit_card", "check", "cash", "bank_transfer", "paypal", "venmo", "other"];
const PAYMENT_STATUSES = ["pending", "paid", "overdue", "waived", "refunded"];
const EVENT_STATUSES = ["booked_pending", "booked", "planning_in_progress", "finalized", "completed", "cancelled", "postponed"];
const PAGE_SIZES = [25, 50, 100];

const statusColors = {
  pending:  "bg-yellow-50 text-yellow-700 border-yellow-200",
  paid:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  overdue:  "bg-red-50 text-red-700 border-red-200",
  waived:   "bg-gray-100 text-gray-600 border-gray-200",
  refunded: "bg-blue-50 text-blue-700 border-blue-200",
};

const eventStatusColors = {
  booked_pending:       "bg-sky-50 text-sky-700",
  booked:               "bg-violet-50 text-violet-700",
  planning_in_progress: "bg-amber-50 text-amber-700",
  finalized:            "bg-emerald-50 text-emerald-700",
  completed:            "bg-gray-100 text-gray-600",
  cancelled:            "bg-red-50 text-red-600",
  postponed:            "bg-orange-50 text-orange-700",
};

function getInitialDates() {
  const urlParams = new URLSearchParams(window.location.search);
  const from = urlParams.get("date_from");
  const to   = urlParams.get("date_to");
  if (from && to) return { date_from: from, date_to: to };
  const preset = DATE_PRESETS.find(p => p.label === "This Year");
  return preset ? preset.get() : { date_from: `${new Date().getFullYear()}-01-01`, date_to: `${new Date().getFullYear()}-12-31` };
}

export default function FinancePayments() {
  const initial = getInitialDates();
  const urlParams = new URLSearchParams(window.location.search);

  const [dateFrom, setDateFrom]       = useState(initial.date_from);
  const [dateTo, setDateTo]           = useState(initial.date_to);
  const [activePreset, setActivePreset] = useState(urlParams.get("preset") || "This Year");
  const [city, setCity]               = useState("all");
  const [method, setMethod]           = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [eventStatus, setEventStatus] = useState("all");
  const [balanceDueOnly, setBalanceDueOnly] = useState(false);
  const [search, setSearch]           = useState("");
  const [skip, setSkip]               = useState(0);
  const [pageSize, setPageSize]       = useState(50);

  // Reset to page 1 when any filter changes
  useEffect(() => { setSkip(0); }, [dateFrom, dateTo, city, method, paymentStatus, eventStatus, balanceDueOnly, search, pageSize]);

  const queryKey = ["finance-payments-v2", dateFrom, dateTo, city, method, paymentStatus, eventStatus, balanceDueOnly, search, skip, pageSize];

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await base44.functions.invoke("getFinancePayments", {
        date_from:        dateFrom,
        date_to:          dateTo,
        city:             city !== "all" ? city : undefined,
        method:           method !== "all" ? method : undefined,
        status:           paymentStatus !== "all" ? paymentStatus : undefined,
        event_status:     eventStatus !== "all" ? eventStatus : undefined,
        balance_due_only: balanceDueOnly || undefined,
        search:           search || undefined,
        limit:            pageSize,
        skip,
      });
      return res.data;
    },
    keepPreviousData: true,
  });

  const payments    = data?.payments || [];
  const total       = data?.total || 0;
  const totalPages  = Math.ceil(total / pageSize);
  const currentPage = Math.floor(skip / pageSize) + 1;

  const totalAmt  = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const paidAmt   = payments.filter(p => p.status === "paid").reduce((s, p) => s + (p.amount || 0), 0);
  const pendingAmt = payments.filter(p => p.status === "pending" || p.status === "overdue").reduce((s, p) => s + (p.amount || 0), 0);

  const handlePreset = (label, range) => {
    setActivePreset(label);
    setDateFrom(range.date_from);
    setDateTo(range.date_to);
  };

  const handleExport = () => {
    const rows = payments.map(p => ({
      paid_date:             p.paid_date || "",
      due_date:              p.due_date || "",
      event_date:            p.event_date || "",
      city:                  p.city || "",
      contact_name:          p.contact_name || "",
      event_name:            p.event_name || "",
      event_status:          p.event_status || "",
      payment_type:          p.payment_type || "",
      amount:                p.amount || 0,
      status:                p.status || "",
      payment_method:        p.payment_method || "",
      transaction_reference: p.transaction_reference || "",
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
          <p className="text-sm text-gray-500 mt-0.5">All payments across finance-visible events</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="gap-2 h-9 text-sm" disabled={payments.length === 0}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Matching Records" value={total.toLocaleString()} icon={DollarSign} color="violet" />
        <StatCard title="Paid (This Page)" value={`$${paidAmt.toLocaleString(undefined, { minimumFractionDigits: 0 })}`} icon={TrendingUp} color="emerald" />
        <StatCard title="Pending / Overdue" value={`$${pendingAmt.toLocaleString(undefined, { minimumFractionDigits: 0 })}`} icon={CreditCard} color="amber" />
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm p-4 space-y-3">
        <FinanceDatePresets active={activePreset} onSelect={handlePreset} />

        <div className="flex flex-wrap gap-3 items-center">
          <Input type="date" value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setActivePreset("custom"); }}
            className="h-9 text-sm w-40 bg-white" />
          <span className="text-gray-400 text-sm">to</span>
          <Input type="date" value={dateTo}
            onChange={e => { setDateTo(e.target.value); setActivePreset("custom"); }}
            className="h-9 text-sm w-40 bg-white" />

          <Select value={city} onValueChange={setCity}>
            <SelectTrigger className="w-32 h-9 text-sm bg-white"><SelectValue placeholder="All Cities" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={paymentStatus} onValueChange={setPaymentStatus}>
            <SelectTrigger className="w-36 h-9 text-sm bg-white"><SelectValue placeholder="Payment Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {PAYMENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="w-36 h-9 text-sm bg-white"><SelectValue placeholder="All Methods" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              {METHODS.map(m => <SelectItem key={m} value={m}>{m.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={eventStatus} onValueChange={setEventStatus}>
            <SelectTrigger className="w-44 h-9 text-sm bg-white"><SelectValue placeholder="Event Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Event Statuses</SelectItem>
              {EVENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search client, event, ref…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm bg-white" />
          </div>
        </div>

        {/* Balance due toggle + page size */}
        <div className="flex items-center gap-6 pt-1">
          <div className="flex items-center gap-2">
            <Switch id="balance-due" checked={balanceDueOnly} onCheckedChange={setBalanceDueOnly} />
            <Label htmlFor="balance-due" className="text-sm text-gray-600 cursor-pointer">Balance Due &gt; 0</Label>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-gray-400">Rows:</span>
            {PAGE_SIZES.map(ps => (
              <button key={ps} onClick={() => setPageSize(ps)}
                className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${pageSize === ps ? "bg-violet-600 text-white border-violet-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                {ps}
              </button>
            ))}
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
                  <TableHead className="text-xs font-semibold">Paid / Due</TableHead>
                  <TableHead className="text-xs font-semibold">Event Date</TableHead>
                  <TableHead className="text-xs font-semibold">City</TableHead>
                  <TableHead className="text-xs font-semibold">Client</TableHead>
                  <TableHead className="text-xs font-semibold">Event</TableHead>
                  <TableHead className="text-xs font-semibold">Event Status</TableHead>
                  <TableHead className="text-xs font-semibold">Amount</TableHead>
                  <TableHead className="text-xs font-semibold">Type</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold">Method</TableHead>
                  <TableHead className="text-xs font-semibold">Ref #</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map(p => (
                  <TableRow key={p.id}
                    className="hover:bg-violet-50/40 cursor-pointer"
                    onClick={() => openEvent(p.event_id)}
                  >
                    <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                      {p.paid_date
                        ? format(new Date(p.paid_date), "MMM d, yyyy")
                        : p.due_date ? format(new Date(p.due_date), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                      {p.event_date ? format(new Date(p.event_date), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500 font-medium">{p.city || "—"}</TableCell>
                    <TableCell className="text-sm font-medium text-gray-800">{p.contact_name || "—"}</TableCell>
                    <TableCell className="text-sm text-gray-600 max-w-[140px] truncate">{p.event_name || "—"}</TableCell>
                    <TableCell>
                      {p.event_status ? (
                        <Badge className={`text-[10px] border-0 ${eventStatusColors[p.event_status] || "bg-gray-100 text-gray-600"}`}>
                          {p.event_status.replace(/_/g, " ")}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-sm font-bold text-gray-900">
                      ${(p.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500 capitalize whitespace-nowrap">
                      {p.payment_type?.replace(/_/g, " ") || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] border ${statusColors[p.status] || "border-gray-200 text-gray-600"}`}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500 capitalize whitespace-nowrap">
                      {p.payment_method?.replace(/_/g, " ") || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-gray-400 font-mono max-w-[100px] truncate">
                      {p.transaction_reference || "—"}
                    </TableCell>
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/40">
            <p className="text-xs text-gray-500">
              {total === 0 ? "0" : `${skip + 1}–${Math.min(skip + pageSize, total)}`} of {total} payments
              {isFetching && <Loader2 className="inline w-3 h-3 ml-2 animate-spin text-violet-400" />}
              {data?._timing_ms && <span className="ml-2 text-gray-300">({data._timing_ms}ms)</span>}
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - pageSize))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs text-gray-600">{currentPage} / {totalPages || 1}</span>
              <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                disabled={skip + pageSize >= total} onClick={() => setSkip(skip + pageSize)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}