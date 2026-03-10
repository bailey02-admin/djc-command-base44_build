/**
 * FinanceIncoming — Finance dashboard page.
 * RBAC: admin, finance, city_manager (enforced by RouteGuard + backend)
 * Data: getFinancePayments (list) + getFinancePaymentsByMonth (monthly chart)
 */
import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Loader2, Search, Download, TrendingUp, DollarSign, Calendar, CheckCircle2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import FinanceDatePresets from "@/components/finance/FinanceDatePresets";
import { exportToCsv } from "@/components/finance/exportCsv";

const CITIES = ["TUL", "DFW", "HOU", "SAT", "KC", "STL", "INDY", "NASH", "DEN", "ATL"];

const STATUS_COLORS = {
  paid:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  overdue: "bg-red-50 text-red-700 border-red-200",
  waived:  "bg-gray-50 text-gray-500 border-gray-200",
};

export default function FinanceIncoming() {
  const currentYear = new Date().getFullYear();

  // ── Filters ────────────────────────────────────────────────────────────
  const [city, setCity]               = useState("all");
  const [paymentStatus, setStatus]    = useState("all");
  const [search, setSearch]           = useState("");
  const [activePreset, setPreset]     = useState("This Month");
  const [dateRange, setDateRange]     = useState(() => {
    const now = new Date();
    return {
      date_from: format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd"),
      date_to:   format(new Date(now.getFullYear(), now.getMonth() + 1, 0), "yyyy-MM-dd"),
    };
  });
  const [year, setYear]               = useState(currentYear);
  const [skip, setSkip]               = useState(0);
  const LIMIT = 50;

  const handlePreset = (label, range) => {
    setPreset(label);
    setDateRange(range);
    setSkip(0);
  };

  // ── Queries ────────────────────────────────────────────────────────────
  const paymentsQuery = useQuery({
    queryKey: ["finance-payments", city, paymentStatus, dateRange, search, skip],
    queryFn: () =>
      base44.functions.invoke("getFinancePayments", {
        city: city !== "all" ? city : undefined,
        status: paymentStatus !== "all" ? paymentStatus : undefined,
        date_from: dateRange.date_from,
        date_to: dateRange.date_to,
        search: search || undefined,
        limit: LIMIT,
        skip,
      }).then((r) => r.data),
    keepPreviousData: true,
  });

  const monthlyQuery = useQuery({
    queryKey: ["finance-monthly", year, city],
    queryFn: () =>
      base44.functions.invoke("getFinancePaymentsByMonth", {
        year,
        city: city !== "all" ? city : undefined,
      }).then((r) => r.data),
  });

  const payments = paymentsQuery.data?.payments || [];
  const total    = paymentsQuery.data?.total || 0;
  const monthly  = monthlyQuery.data;
  const totals   = monthly?.totals;
  const months   = (monthly?.months || []).map((m) => ({
    ...m,
    label: format(new Date(m.month + "-15"), "MMM"),
  }));

  // ── Summary cards ──────────────────────────────────────────────────────
  const summaryCards = [
    {
      label: "Total Collected",
      value: totals ? `$${totals.total_paid.toLocaleString()}` : "—",
      icon: DollarSign,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Scheduled (Due)",
      value: totals ? `$${totals.scheduled_amount.toLocaleString()}` : "—",
      icon: Calendar,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Events with Payments",
      value: totals ? totals.event_count.toLocaleString() : "—",
      icon: CheckCircle2,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      label: "Final Payments",
      value: totals ? `$${totals.final_total.toLocaleString()}` : "—",
      icon: TrendingUp,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
  ];

  const handleExport = () => {
    exportToCsv("finance_payments.csv", payments.map((p) => ({
      event_name: p.event_name || "",
      contact_name: p.contact_name || "",
      city: p.city || "",
      type: p.payment_type || "",
      amount: p.amount || 0,
      status: p.status || "",
      method: p.payment_method || "",
      due_date: p.due_date || "",
      paid_date: p.paid_date || "",
    })));
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Finance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Incoming payments and monthly revenue</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 self-start">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200/80 p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Date presets */}
          <FinanceDatePresets active={activePreset} onSelect={handlePreset} />
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={city} onValueChange={(v) => { setCity(v); setSkip(0); }}>
            <SelectTrigger className="w-32 h-9 text-sm"><SelectValue placeholder="All Cities" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={paymentStatus} onValueChange={(v) => { setStatus(v); setSkip(0); }}>
            <SelectTrigger className="w-36 h-9 text-sm"><SelectValue placeholder="All Statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="waived">Waived</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search event, contact…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSkip(0); }}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <Card key={card.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center flex-shrink-0`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-400 truncate">{card.label}</p>
                <p className="text-lg font-bold text-gray-900">
                  {monthlyQuery.isLoading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : card.value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Monthly chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Monthly Income — {year}</CardTitle>
          <div className="flex gap-1.5">
            {[currentYear - 1, currentYear].map((y) => (
              <Button
                key={y}
                size="sm"
                variant={year === y ? "default" : "outline"}
                className={`h-7 text-xs px-2.5 ${year === y ? "bg-violet-600 hover:bg-violet-700" : ""}`}
                onClick={() => setYear(y)}
              >{y}</Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {monthlyQuery.isLoading ? (
            <div className="h-48 flex items-center justify-center text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={months} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
                <Bar dataKey="total_paid" name="Collected" fill="#7c3aed" radius={[3, 3, 0, 0]} />
                <Bar dataKey="scheduled_amount" name="Scheduled" fill="#ddd6fe" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Payments table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            Payments
            {!paymentsQuery.isLoading && <span className="text-gray-400 font-normal ml-2">({total} total)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {paymentsQuery.isLoading ? (
            <div className="py-16 flex items-center justify-center text-gray-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading payments…
            </div>
          ) : payments.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">No payments match your filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50/80 text-left text-xs text-gray-400">
                    <th className="px-4 py-2.5 font-semibold">Event</th>
                    <th className="px-4 py-2.5 font-semibold">Contact</th>
                    <th className="px-4 py-2.5 font-semibold">City</th>
                    <th className="px-4 py-2.5 font-semibold">Type</th>
                    <th className="px-4 py-2.5 font-semibold">Amount</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                    <th className="px-4 py-2.5 font-semibold">Method</th>
                    <th className="px-4 py-2.5 font-semibold">Due</th>
                    <th className="px-4 py-2.5 font-semibold">Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-[180px] truncate">{p.event_name || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{p.contact_name || "—"}</td>
                      <td className="px-4 py-3 text-gray-500">{p.city || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 capitalize">{p.payment_type?.replace(/_/g, " ") || "—"}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">${(p.amount || 0).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[p.status] || "bg-gray-50 text-gray-500"}`}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-500 capitalize text-xs">{p.payment_method?.replace(/_/g, " ") || "—"}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{p.due_date ? format(new Date(p.due_date), "MMM d, yy") : "—"}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{p.paid_date ? format(new Date(p.paid_date), "MMM d, yy") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {total > LIMIT && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-500">
              <span>Showing {skip + 1}–{Math.min(skip + LIMIT, total)} of {total}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - LIMIT))}>Previous</Button>
                <Button variant="outline" size="sm" disabled={skip + LIMIT >= total} onClick={() => setSkip(skip + LIMIT)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}