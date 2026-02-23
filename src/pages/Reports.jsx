import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, CalendarDays, DollarSign, TrendingUp, BarChart3, PieChart } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RPieChart, Pie, Cell, Legend } from "recharts";
import StatCard from "../components/dashboard/StatCard";

const COLORS = ["#8b5cf6", "#6366f1", "#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#a855f7", "#14b8a6"];

export default function Reports() {
  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: () => base44.entities.Lead.list("-created_date", 500),
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.Event.list("-event_date", 500),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["all-payments"],
    queryFn: () => base44.entities.Payment.list("-created_date", 500),
  });

  // Lead source breakdown
  const sourceData = Object.entries(
    leads.reduce((acc, l) => { acc[l.lead_source || "unknown"] = (acc[l.lead_source || "unknown"] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name: name.replace(/_/g, " "), value })).sort((a, b) => b.value - a.value);

  // Lead status breakdown
  const statusData = Object.entries(
    leads.reduce((acc, l) => { acc[l.status || "unknown"] = (acc[l.status || "unknown"] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));

  // Event type breakdown
  const eventTypeData = Object.entries(
    events.reduce((acc, e) => { acc[e.event_type || "unknown"] = (acc[e.event_type || "unknown"] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name: name.replace(/_/g, " "), value })).sort((a, b) => b.value - a.value);

  // City breakdown
  const cityData = Object.entries(
    leads.reduce((acc, l) => { if (l.city) acc[l.city] = (acc[l.city] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // Lost reasons
  const lostReasons = Object.entries(
    leads.filter(l => l.status === "lost" && l.lost_reason).reduce((acc, l) => { acc[l.lost_reason] = (acc[l.lost_reason] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name: name.replace(/_/g, " "), value })).sort((a, b) => b.value - a.value);

  const totalRevenue = payments.filter(p => p.status === "paid").reduce((s, p) => s + (p.amount || 0), 0);
  const bookingRate = leads.length > 0 ? Math.round((leads.filter(l => l.status === "booked").length / leads.length) * 100) : 0;
  const avgBookingValue = events.filter(e => e.package_price).length > 0
    ? Math.round(events.filter(e => e.package_price).reduce((s, e) => s + e.package_price, 0) / events.filter(e => e.package_price).length)
    : 0;

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Business analytics and performance metrics</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Leads" value={leads.length} icon={Users} color="violet" />
        <StatCard title="Total Events" value={events.length} icon={CalendarDays} color="emerald" />
        <StatCard title="Revenue" value={`$${totalRevenue.toLocaleString()}`} icon={DollarSign} color="amber" />
        <StatCard title="Close Rate" value={`${bookingRate}%`} icon={TrendingUp} color="blue" subtitle={`Avg value: $${avgBookingValue.toLocaleString()}`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Lead Sources */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Lead Sources</CardTitle></CardHeader>
          <CardContent>
            {sourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={sourceData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center py-10 text-gray-400 text-sm">No data yet</p>}
          </CardContent>
        </Card>

        {/* Lead Status */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Lead Pipeline Status</CardTitle></CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <RPieChart>
                  <Pie data={statusData} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label={{ fontSize: 10 }}>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </RPieChart>
              </ResponsiveContainer>
            ) : <p className="text-center py-10 text-gray-400 text-sm">No data yet</p>}
          </CardContent>
        </Card>

        {/* Events by Type */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Events by Type</CardTitle></CardHeader>
          <CardContent>
            {eventTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <RPieChart>
                  <Pie data={eventTypeData} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label={{ fontSize: 10 }}>
                    {eventTypeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </RPieChart>
              </ResponsiveContainer>
            ) : <p className="text-center py-10 text-gray-400 text-sm">No data yet</p>}
          </CardContent>
        </Card>

        {/* By City */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Leads by City</CardTitle></CardHeader>
          <CardContent>
            {cityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={cityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center py-10 text-gray-400 text-sm">No data yet</p>}
          </CardContent>
        </Card>
      </div>

      {/* Lost Reasons */}
      {lostReasons.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Lost Reasons</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {lostReasons.map(r => (
                <div key={r.name} className="p-3 rounded-lg bg-red-50/50 text-center">
                  <p className="text-2xl font-bold text-red-600">{r.value}</p>
                  <p className="text-xs text-red-400 capitalize mt-1">{r.name}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}