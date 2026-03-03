import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LeadAPI, EventAPI, TaskAPI, PaymentAPI } from "../components/api/secureApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Users, CalendarDays, DollarSign, TrendingUp,
  Plus, ArrowRight, ClipboardList, AlertTriangle, Clock, CheckCircle2
} from "lucide-react";
import StatCard from "../components/dashboard/StatCard";
import RecentLeads from "../components/dashboard/RecentLeads";
import UpcomingEvents from "../components/dashboard/UpcomingEvents";
import TaskList from "../components/dashboard/TaskList";
import { differenceInDays, isToday, format } from "date-fns";
import { calculateReadinessScore } from "../components/crm/pipeline";

export default function Dashboard() {
  const queryClient = useQueryClient();

  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: () => LeadAPI.list({}, "-created_date", 50),
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => EventAPI.list({}, "-event_date", 50).then(r => Array.isArray(r) ? r : (r?.events ?? [])),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => TaskAPI.list({ status: "pending" }, "-due_date", 20),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: () => PaymentAPI.list(100),
  });

  const [user, setUser] = useState(null);
  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const activeLeads = leads.filter(l => !["booked", "lost", "ghosted", "disqualified"].includes(l.status));
  const bookedEvents = events.filter(e => e.event_date && new Date(e.event_date) >= new Date());
  const totalRevenue = payments.filter(p => p.status === "paid").reduce((sum, p) => sum + (p.amount || 0), 0);
  const bookingRate = leads.length > 0 ? Math.round((leads.filter(l => l.status === "booked").length / leads.length) * 100) : 0;

  // SLA breach alerts — leads with no first response & inquiry > 60 min ago
  const slaBreaches = leads.filter(l =>
    !l.first_response_date &&
    l.inquiry_date &&
    !["lost","ghosted","disqualified","booked"].includes(l.pipeline_stage) &&
    (Date.now() - new Date(l.inquiry_date).getTime()) > 60 * 60 * 1000
  );

  // At-risk events — next 14 days, readiness < 80%
  const atRiskEvents = bookedEvents
    .map(e => ({ ...e, days: differenceInDays(new Date(e.event_date), new Date()), score: calculateReadinessScore(e) }))
    .filter(e => e.days <= 14 && e.days >= 0 && e.score < 80)
    .sort((a, b) => a.days - b.days);

  // Tasks due today
  const tasksDueToday = tasks.filter(t => t.due_date && isToday(new Date(t.due_date)));

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {user
  ? `Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, ${user.full_name?.split(" ")[0] || "there"}: "Dashboard"}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{format(new Date(), "EEEE, MMMM d")} · DJ Command CRM</p>
        </div>
        <div className="flex gap-2">
          <Link to={createPageUrl("LeadForm")}>
            <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/20 text-sm h-9">
              <Plus className="w-4 h-4 mr-1.5" />
              New Lead
            </Button>
          </Link>
        </div>
      </div>

      {/* Alert bar */}
      {(slaBreaches.length > 0 || atRiskEvents.length > 0 || tasksDueToday.length > 0) && (
        <div className="space-y-2">
          {slaBreaches.length > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-100 text-sm">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="font-medium text-red-700">{slaBreaches.length} lead{slaBreaches.length > 1 ? "s" : ""} with missed SLA</span>
              <div className="flex gap-1.5 flex-wrap ml-2">
                {slaBreaches.slice(0,3).map(l => (
                  <Link key={l.id} to={createPageUrl("LeadDetail") + `?id=${l.id}`}>
                    <Badge className="text-[10px] bg-red-100 text-red-700 hover:bg-red-200 cursor-pointer border-0">{l.client_first_name} {l.client_last_name}</Badge>
                  </Link>
                ))}
              </div>
              {slaBreaches.length > 3 && <span className="text-red-400 text-xs ml-1">+{slaBreaches.length - 3} more</span>}
            </div>
          )}
          {atRiskEvents.length > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100 text-sm">
              <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <span className="font-medium text-amber-700">{atRiskEvents.length} event{atRiskEvents.length > 1 ? "s" : ""} at risk in next 14 days</span>
              <div className="flex gap-1.5 flex-wrap ml-2">
                {atRiskEvents.slice(0,3).map(e => (
                  <Link key={e.id} to={createPageUrl("EventDetail") + `?id=${e.id}`}>
                    <Badge className="text-[10px] bg-amber-100 text-amber-700 hover:bg-amber-200 cursor-pointer border-0">{e.event_name} · {e.days}d</Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {tasksDueToday.length > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-50 border border-violet-100 text-sm">
              <CheckCircle2 className="w-4 h-4 text-violet-500 flex-shrink-0" />
              <span className="font-medium text-violet-700">{tasksDueToday.length} task{tasksDueToday.length > 1 ? "s" : ""} due today</span>
              <Link to={createPageUrl("Tasks")} className="text-xs text-violet-600 hover:underline ml-auto">View →</Link>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Leads" value={activeLeads.length} icon={Users} color="violet" subtitle="In pipeline" />
        <StatCard title="Upcoming Events" value={bookedEvents.length} icon={CalendarDays} color="emerald" subtitle="Booked" />
        <StatCard title="Revenue Collected" value={`$${totalRevenue.toLocaleString()}`} icon={DollarSign} color="amber" subtitle="Payments received" />
        <StatCard title="Close Rate" value={`${bookingRate}%`} icon={TrendingUp} color="blue" subtitle="Lead → Booked" trend={bookingRate > 25 ? { value: bookingRate, isPositive: true, label: "conversion" } : undefined} />
      </div>

      {/* Main content grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Leads */}
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">Recent Leads</CardTitle>
            <Link to={createPageUrl("Leads")} className="text-xs text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent>
            <RecentLeads leads={leads} />
          </CardContent>
        </Card>

        {/* Tasks */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">My Tasks</CardTitle>
            <Link to={createPageUrl("Tasks")} className="text-xs text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent>
            <TaskList tasks={tasks} onUpdate={() => queryClient.invalidateQueries(["tasks"])} />
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Events */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold">Upcoming Events</CardTitle>
          <Link to={createPageUrl("Events")} className="text-xs text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <UpcomingEvents events={bookedEvents} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}