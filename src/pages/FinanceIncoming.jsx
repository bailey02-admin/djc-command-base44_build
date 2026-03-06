import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, DollarSign, TrendingUp, CalendarDays, ArrowRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import FinanceDatePresets, { DATE_PRESETS } from "../components/finance/FinanceDatePresets";
import { exportToCsv } from "../components/finance/exportCsv";
import StatCard from "../components/dashboard/StatCard";

const CITIES = ["TUL", "DFW", "HOU", "SAT", "KC", "STL", "INDY", "NASH", "DEN", "ATL"];

function getInitialDates() {
  const preset = DATE_PRESETS.find(p => p.label === "This Year");
  return preset ? preset.get() : { date_from: "2024-01-01", date_to: "2024-12-31" };
}

export default function FinanceIncoming() {
  const initial = getInitialDates();
  const navigate = useNavigate();

  const [dateFrom, setDateFrom] = useState(initial.date_from);
  const [dateTo, setDateTo] = useState(initial.date_to);
  const [activePreset, setActivePreset] = useState("This Year");
  const [city, setCity] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["finance-by-month", dateFrom, dateTo, city],
    queryFn: async () => {
      const res = await base44.functions.invoke("getFinancePaymentsByMonth", {
        date_from: dateFrom,
        date_to: dateTo,
        city: city !== "all" ? city : undefined,
      });
      return res.data;
    },
  });

  const months = data?.months || [];
  const grandTotal = months.reduce((s, m) => s + m.total_amount, 0);
  const grandCount = months.reduce((s, m) => s + m.payment_count, 0);
  const avgPerMonth = months.length > 0 ? grandTotal / months.length : 0;

  const handlePreset = (label, range) => {
    setActivePreset(label);
    setDateFrom(range.date_from);
    setDateTo(range.date_to);
  };

  const drillDown = (monthStr) => {
    // monthStr is "YYYY-MM", navigate to payments filtered to that month
    const from = `${monthStr}-01`;
    // Last day of month
    const d = new Date(monthStr + "-01");
    d.setMonth(d.getMonth() + 1);
    d.setDate(d.getDate() - 1);
    const to = d.toISOString().slice(0, 10);
    const url = createPageUrl("FinancePayments") + `?date_from=${from}&date_to=${to}&preset=custom`;
    navigate(url);
  };

  const handleExport = () => {
    const rows = months.map(m => ({
      month: m.month,
      month_label: formatMonth(m.month),
      payment_count: m.payment_count,
      total_amount: m.total_amount.toFixed(2),
    }));
    exportToCsv(`finance_incoming_by_month_${dateFrom}_${dateTo}.csv`, rows);
  };

  const formatMonth = (monthStr) => {
    try { return format(parseISO(monthStr + "-01"), "MMMM yyyy"); }
    catch { return monthStr; }
  };

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Finance — Incoming by Month</h1>
          <p className="text-sm text-gray-500 mt-0.5">Monthly rollup of paid payments. Click a row to drill into individual payments.</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="gap-2 h-9 text-sm" disabled={months.length === 0}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Total Collected" value={`$${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} icon={DollarSign} color="emerald" />
        <StatCard title="Total Payments" value={grandCount.toLocaleString()} icon={CalendarDays} color="violet" />
        <StatCard title="Avg / Month" value={`$${avgPerMonth.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} icon={TrendingUp} color="amber" />
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm p-4 space-y-3">
        <FinanceDatePresets active={activePreset} onSelect={handlePreset} />
        <div className="flex flex-wrap gap-3 items-center">
          <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setActivePreset("custom"); }}
            className="h-9 text-sm w-40 bg-white" />
          <span className="text-gray-400 text-sm">to</span>
          <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setActivePreset("custom"); }}
            className="h-9 text-sm w-40 bg-white" />

          <Select value={city} onValueChange={setCity}>
            <SelectTrigger className="w-36 h-9 text-sm bg-white"><SelectValue placeholder="All Cities" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>
      ) : months.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-gray-400 gap-2">
          <TrendingUp className="w-8 h-8 opacity-30" />
          <p className="text-sm">No paid payments found in this date range.</p>
        </div>
      ) : (
        <Card className="border-0 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="text-xs font-semibold">Month</TableHead>
                <TableHead className="text-xs font-semibold text-right">Payments</TableHead>
                <TableHead className="text-xs font-semibold text-right">Total Collected</TableHead>
                <TableHead className="text-xs font-semibold text-right">Avg / Payment</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map(m => (
                <TableRow key={m.month}
                  className="hover:bg-violet-50/40 cursor-pointer transition-colors"
                  onClick={() => drillDown(m.month)}
                >
                  <TableCell className="text-sm font-semibold text-gray-800">
                    {formatMonth(m.month)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600 text-right">{m.payment_count}</TableCell>
                  <TableCell className="text-sm font-bold text-emerald-700 text-right">
                    ${m.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500 text-right">
                    ${m.payment_count > 0
                      ? (m.total_amount / m.payment_count).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                      : "0"}
                  </TableCell>
                  <TableCell>
                    <ArrowRight className="w-4 h-4 text-gray-300" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Grand total row */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/60">
            <span className="text-sm font-semibold text-gray-700">Grand Total</span>
            <div className="flex items-center gap-8 text-sm">
              <span className="text-gray-600">{grandCount} payments</span>
              <span className="font-bold text-emerald-700 text-base">
                ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}