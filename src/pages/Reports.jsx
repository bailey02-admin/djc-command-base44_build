import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, CalendarDays, DollarSign, TrendingUp, AlertTriangle, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { differenceInDays, format } from "date-fns";
import StatCard from "../components/dashboard/StatCard";
import { calculateReadinessScore, PIPELINE_STAGES } from "../components/crm/pipeline";

const COLORS = ["#8b5cf6","#6366f1","#3b82f6","#06b6d4","#10b981","#f59e0b","#ef4444","#ec4899","#a855f7","#14b8a6"];

export default function Reports() {
  const [cityFilter, setCityFilter] = useState("all");

  const { data: leads = [] } = useQuery({ queryKey: ["leads"], queryFn: () => base44.entities.Lead.list("-created_date", 500) });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-event_date", 500) });
  const { data: payments = [] } = useQuery({ queryKey: ["all-payments"], queryFn: () => base44.entities.Payment.list("-created_date", 500) });

  const cities = [...new Set([...leads.map(l => l.city), ...events.map(e => e.city)].filter(Boolean))];
  const fl = cityFilter === "all" ? leads : leads.filter(l => l.city === cityFilter);
  const fe = cityFilter === "all" ? events : events.filter(e => e.city === cityFilter);

  const totalRevenue = payments.filter(p => p.status === "paid").reduce((s, p) => s + (p.amount || 0), 0);
  const bookingRate = fl.length > 0 ? Math.round((fl.filter(l => l.status === "booked").length / fl.length) * 100) : 0;
  const avgBookingValue = fe.filter(e => e.package_price).length > 0
    ? Math.round(fe.filter(e => e.package_price).reduce((s, e) => s + e.package_price, 0) / fe.filter(e => e.package_price).length) : 0;
  const slaBreaches = fl.filter(l => l.sla_status === "missed").length;

  // SLA performance
  const slaData = [
    { name: "On Time", value: fl.filter(l => l.sla_status === "on_time").length, color: "#10b981" },
    { name: "Warning", value: fl.filter(l => l.sla_status === "warning").length, color: "#f59e0b" },
    { name: "Missed", value: fl.filter(l => l.sla_status === "missed").length, color: "#ef4444" },
  ].filter(d => d.value > 0);

  // Lead source funnel (show booking rate per source)
  const sourceBookings = Object.entries(
    fl.reduce((acc, l) => {
      const src = l.lead_source || "unknown";
      if (!acc[src]) acc[src] = { total: 0, booked: 0 };
      acc[src].total++;
      if (l.status === "booked") acc[src].booked++;
      return acc;
    }, {})
  ).map(([name, d]) => ({ name: name.replace(/_/g, " "), total: d.total, booked: d.booked, rate: Math.round((d.booked / d.total) * 100) }))
   .sort((a, b) => b.total - a.total);

  // Pipeline stage distribution
  const pipelineData = PIPELINE_STAGES.map(s => ({
    name: s.label,
    value: fl.filter(l => l.pipeline_stage === s.key).length,
  })).filter(d => d.value > 0);

  // Events with low readiness + upcoming
  const upcomingAtRisk = fe
    .filter(e => e.event_date && differenceInDays(new Date(e.event_date), new Date()) <= 30 && differenceInDays(new Date(e.event_date), new Date()) >= 0)
    .map(e => ({ ...e, score: calculateReadinessScore(e), days: differenceInDays(new Date(e.event_date), new Date()) }))
    .filter(e => e.score < 80)
    .sort((a, b) => a.days - b.days);

  // Avg response time
  const respondedLeads = fl.filter(l => l.sla_minutes_elapsed !== null && l.sla_minutes_elapsed !== undefined);
  const avgResponse = respondedLeads.length > 0
    ? Math.round(respondedLeads.reduce((s, l) => s + l.sla_minutes_elapsed, 0) / respondedLeads.length) : null;

  // Lost reasons
  const lostReasons = Object.entries(
    fl.filter(l => l.status === "lost" && l.lost_reason).reduce((acc, l) => { acc[l.lost_reason] = (acc[l.lost_reason] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name: name.replace(/_/g, " "), value })).sort((a, b) => b.value - a.value);

  // City comparison
  const cityData = cities.map(city => ({
    name: city,
    leads: leads.filter(l => l.city === city).length,
    booked: leads.filter(l => l.city === city && l.status === "booked").length,
    revenue: payments.filter(p => {
      const ev = events.find(e => e.id === p.event_id);
      return ev?.city === city && p.status === "paid";
    }).reduce((s, p) => s + (p.amount || 0), 0),
  }));

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Business analytics and performance metrics</p>
        </div>
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-36 h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Leads" value={fl.length} icon={Users} color="violet" />
        <StatCard title="Close Rate" value={`${bookingRate}%`} icon={TrendingUp} color="emerald" subtitle={`Avg value: $${avgBookingValue.toLocaleString()}`} />
        <StatCard title="Revenue" value={`$${totalRevenue.toLocaleString()}`} icon={DollarSign} color="amber" />
        <StatCard title="SLA Breaches" value={slaBreaches} icon={Clock} color="rose" subtitle={avgResponse !== null ? `Avg ${avgResponse}m` : ""} />
      </div>

      <Tabs defaultValue="sales">
        <TabsList className="bg-white border">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="attribution">Attribution</TabsTrigger>
          <TabsTrigger value="cities">By City</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="mt-6 space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Pipeline Stage Distribution</CardTitle></CardHeader>
              <CardContent>
                {pipelineData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={pipelineData} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8b5cf6" radius={[0,4,4,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-center py-10 text-gray-400 text-sm">No data</p>}
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">SLA Performance</CardTitle></CardHeader>
              <CardContent>
                {slaData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={slaData} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label={{ fontSize: 11 }}>
                        {slaData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-center py-10 text-gray-400 text-sm">No SLA data yet</p>}
              </CardContent>
            </Card>
            {lostReasons.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Lost Reasons</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    {lostReasons.map(r => (
                      <div key={r.name} className="p-3 rounded-lg bg-red-50/60 text-center">
                        <p className="text-xl font-bold text-red-600">{r.value}</p>
                        <p className="text-[10px] text-red-400 capitalize mt-1">{r.name}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="operations" className="mt-6 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Events At Risk (next 30 days, &lt;80% ready)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingAtRisk.length > 0 ? (
                <div className="space-y-2">
                  {upcomingAtRisk.map(e => (
                    <div key={e.id} className="flex items-center justify-between p-3 rounded-lg bg-amber-50/60 border border-amber-100 text-sm">
                      <div>
                        <p className="font-medium">{e.event_name}</p>
                        <p className="text-xs text-gray-500">{format(new Date(e.event_date), "MMM d")} · {e.city}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-amber-600 font-medium">{e.days}d away</span>
                        <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">{e.score}% ready</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-center py-8 text-emerald-600 text-sm">✓ All upcoming events are on track!</p>}
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-3 gap-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-5 text-center">
                <p className="text-3xl font-bold text-violet-600">{fe.filter(e => !e.assigned_dj).length}</p>
                <p className="text-sm text-gray-500 mt-1">Events without DJ assigned</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-5 text-center">
                <p className="text-3xl font-bold text-amber-600">{fe.filter(e => !e.planning_complete).length}</p>
                <p className="text-sm text-gray-500 mt-1">Planning forms incomplete</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-5 text-center">
                <p className="text-3xl font-bold text-red-600">{fl.filter(l => l.sla_status === "missed").length}</p>
                <p className="text-sm text-gray-500 mt-1">Missed SLA leads</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="attribution" className="mt-6 space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Lead Source Performance (Volume + Close Rate)</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-gray-500 uppercase tracking-wider">
                    <th className="text-left py-2">Source</th>
                    <th className="text-right py-2">Leads</th>
                    <th className="text-right py-2">Booked</th>
                    <th className="text-right py-2">Close Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceBookings.map(row => (
                    <tr key={row.name} className="border-b last:border-0">
                      <td className="py-2 font-medium capitalize">{row.name}</td>
                      <td className="py-2 text-right">{row.total}</td>
                      <td className="py-2 text-right text-emerald-600 font-medium">{row.booked}</td>
                      <td className="py-2 text-right">
                        <Badge variant="secondary" className={`text-xs ${row.rate >= 30 ? "bg-emerald-50 text-emerald-700" : row.rate >= 15 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                          {row.rate}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cities" className="mt-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">City Performance Comparison</CardTitle></CardHeader>
            <CardContent>
              {cityData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={cityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="left" dataKey="leads" name="Leads" fill="#8b5cf6" radius={[4,4,0,0]} />
                    <Bar yAxisId="left" dataKey="booked" name="Booked" fill="#10b981" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-center py-10 text-gray-400 text-sm">No city data</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}