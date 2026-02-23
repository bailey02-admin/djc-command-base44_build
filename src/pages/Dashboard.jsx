import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Users, CalendarDays, DollarSign, TrendingUp,
  Plus, ArrowRight, ClipboardList, Music
} from "lucide-react";
import StatCard from "../components/dashboard/StatCard";
import RecentLeads from "../components/dashboard/RecentLeads";
import UpcomingEvents from "../components/dashboard/UpcomingEvents";
import TaskList from "../components/dashboard/TaskList";

export default function Dashboard() {
  const queryClient = useQueryClient();

  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: () => base44.entities.Lead.list("-created_date", 50),
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.Event.list("-event_date", 50),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => base44.entities.Task.filter({ status: "pending" }, "-due_date", 20),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: () => base44.entities.Payment.list("-created_date", 100),
  });

  const activeLeads = leads.filter(l => !["booked", "lost", "ghosted", "disqualified"].includes(l.status));
  const bookedEvents = events.filter(e => e.event_date && new Date(e.event_date) >= new Date());
  const totalRevenue = payments.filter(p => p.status === "paid").reduce((sum, p) => sum + (p.amount || 0), 0);
  const bookingRate = leads.length > 0 ? Math.round((leads.filter(l => l.status === "booked").length / leads.length) * 100) : 0;

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Overview of your DJ business operations</p>
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

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Leads" value={activeLeads.length} icon={Users} color="violet" subtitle="In pipeline" />
        <StatCard title="Upcoming Events" value={bookedEvents.length} icon={CalendarDays} color="emerald" subtitle="Booked" />
        <StatCard title="Revenue Collected" value={`$${totalRevenue.toLocaleString()}`} icon={DollarSign} color="amber" subtitle="Payments received" />
        <StatCard title="Close Rate" value={`${bookingRate}%`} icon={TrendingUp} color="blue" subtitle="Lead → Booked" />
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