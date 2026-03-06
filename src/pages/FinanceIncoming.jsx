/**
 * Finance — Income by Month (DJEP parity)
 *
 * Year selector, full column set:
 *   Month | Events | Event Income | Sched Count | Sched Amount | Final Count | Final Total | Total Paid
 * Click row → drill into FinancePayments filtered to that month
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, DollarSign, TrendingUp, CalendarDays, ArrowRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { exportToCsv } from "../components/finance/exportCsv";
import StatCard from "../components/dashboard/StatCard";

const CITIES = ["TUL", "DFW", "HOU", "SAT", "KC", "STL", "INDY", "NASH", "DEN", "ATL"];

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

function currentYear() { return new Date().getFullYear(); }

function buildYearOptions() {
  const cy = currentYear();
  return Array.from({ length: 5 }, (_, i) => cy - 2 + i); // -2 to +2
}

function fmt$(n) {
  return "$" + (n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatMonthLabel(monthStr) {
  try { return format(parseISO(monthStr + "-01"), "MMMM"); }
  catch { return monthStr; }
}

export default function FinanceIncoming() {
  const navigate = useNavigate();
  const [year, setYear]   = useState(String(currentYear()));
  const [city, setCity]   = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["finance-by-month-v2", year, city],
    queryFn: async () => {
      const res = await base44.functions.invoke("getFinancePaymentsByMonth", {
        year:  Number(year),
        city:  city !== "all" ? city : undefined,
      });
      return res.data;
    },
  });

  const months = data?.months || [];
  const totals = data?.totals || {};

  const handleExport = () => {
    const rows = months.map(m => ({
      month:            m.month,
      month_label:      formatMonthLabel(m.month),
      event_count:      m.event_count,
      event_income:     m.event_income.toFixed(2),
      scheduled_count:  m.scheduled_count,
      scheduled_amount: m.scheduled_amount.toFixed(2),
      final_count:      m.final_count,
      final_total:      m.final_total.toFixed(2),
      total_paid:       m.total_paid.toFixed(2),
    }));
    exportToCsv(`finance_income_${year}.csv`, rows);
  };

  const drillDown = (monthStr) => {
    const from = `${monthStr}-01`;
    const d = new Date(monthStr + "-01");
    d.setMonth(d.getMonth() + 1);
    d.setDate(d.getDate() - 1);
    const to = d.toISOString().slice(0, 10);
    navigate(createPageUrl("FinancePayments") + `?date_from=${from}&date_to=${to}&preset=custom`);
  };

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Finance — Income by Month</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Monthly breakdown — paid income, scheduled payments, and final payments. Click a row to drill in.
          </p>
        </div>
        <Button onClick={handleExport} variant="outline" className="gap-2 h-9 text-sm" disabled={months.length === 0}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Total Paid" value={fmt$(totals.total_paid)} icon={DollarSign} color="emerald" />
        <StatCard title="Scheduled" value={fmt$(totals.scheduled_amount)} icon={CalendarDays} color="amber" />
        <StatCard title="Final Payments" value={fmt$(totals.final_total)} icon={TrendingUp} color="violet" />
        <StatCard title="Events" value={(totals.event_count || 0).toLocaleString()} icon={CalendarDays} color="blue" />
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28 h-9 text-sm bg-white font-semibold"><SelectValue /></SelectTrigger>
            <SelectContent>
              {buildYearOptions().map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={city} onValueChange={setCity}>
            <SelectTrigger className="w-36 h-9 text-sm bg-white"><SelectValue placeholder="All Cities" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          {data?._timing_ms && (
            <span className="text-xs text-gray-300 ml-auto">{data._timing_ms}ms</span>
          )}
        </div>
      </Card>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>
      ) : (
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <TableHead className="text-xs font-semibold">Month</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Events</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Event Income</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Sched #</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Sched Amount</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Final #</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Final Total</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Total Paid</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {months.map((m, idx) => {
                  const isCurrentMonth = m.month === `${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
                  const hasData = m.event_income > 0 || m.scheduled_amount > 0 || m.event_count > 0;
                  return (
                    <TableRow key={m.month}
                      className={`transition-colors cursor-pointer ${hasData ? "hover:bg-violet-50/40" : "opacity-40"} ${isCurrentMonth ? "bg-violet-50/20" : ""}`}
                      onClick={() => hasData && drillDown(m.month)}
                    >
                      <TableCell className="text-sm font-semibold text-gray-800">
                        {MONTH_NAMES[idx]}
                        {isCurrentMonth && <span className="ml-2 text-[10px] bg-violet-100 text-violet-600 rounded-full px-1.5 py-0.5 font-normal">current</span>}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 text-right">{m.event_count || 0}</TableCell>
                      <TableCell className="text-sm font-semibold text-emerald-700 text-right">
                        {m.event_income > 0 ? fmt$(m.event_income) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500 text-right">{m.scheduled_count || 0}</TableCell>
                      <TableCell className="text-sm text-amber-700 text-right">
                        {m.scheduled_amount > 0 ? fmt$(m.scheduled_amount) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500 text-right">{m.final_count || 0}</TableCell>
                      <TableCell className="text-sm text-violet-700 text-right">
                        {m.final_total > 0 ? fmt$(m.final_total) : "—"}
                      </TableCell>
                      <TableCell className="text-sm font-bold text-gray-900 text-right">
                        {m.total_paid > 0 ? fmt$(m.total_paid) : "—"}
                      </TableCell>
                      <TableCell>
                        {hasData && <ArrowRight className="w-4 h-4 text-gray-300" />}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Totals row */}
          <div className="grid grid-cols-8 gap-0 px-4 py-3 border-t border-gray-200 bg-gray-50/80 text-sm font-semibold text-gray-700">
            <div>Annual Total</div>
            <div className="text-right">{totals.event_count || 0}</div>
            <div className="text-right text-emerald-700">{fmt$(totals.event_income)}</div>
            <div className="text-right">{totals.scheduled_count || 0}</div>
            <div className="text-right text-amber-700">{fmt$(totals.scheduled_amount)}</div>
            <div className="text-right">{totals.final_count || 0}</div>
            <div className="text-right text-violet-700">{fmt$(totals.final_total)}</div>
            <div className="text-right text-gray-900">{fmt$(totals.total_paid)}</div>
          </div>
        </Card>
      )}
    </div>
  );
}