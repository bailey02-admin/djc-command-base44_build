import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LeadAPI } from "../components/api/secureApi";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, LayoutGrid, List, Filter } from "lucide-react";
import LeadPipelineKanban from "../components/leads/LeadPipelineKanban";
import LeadTable from "../components/leads/LeadTable";

export default function Leads() {
  const [view, setView] = useState("kanban");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const queryClient = useQueryClient();

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", statusFilter, cityFilter],
    queryFn: () => LeadAPI.list(
      {
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(cityFilter !== "all" ? { city: cityFilter } : {}),
      },
      "-created_date",
      200
    ),
    keepPreviousData: true,
  });

  const cities = [...new Set(leads.map(l => l.city).filter(Boolean))];

  const filteredLeads = leads.filter(lead => {
    const matchSearch = !search ||
      `${lead.client_first_name} ${lead.client_last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      lead.email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || lead.status === statusFilter;
    const matchCity = cityFilter === "all" || lead.city === cityFilter;
    return matchSearch && matchStatus && matchCity;
  });

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Lead Pipeline</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filteredLeads.length} leads in pipeline</p>
        </div>
        <Link to={createPageUrl("LeadForm")}>
          <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/20 text-sm h-9">
            <Plus className="w-4 h-4 mr-1.5" />
            New Lead
          </Button>
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm bg-white"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-9 text-sm bg-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="qualified">Qualified</SelectItem>
            <SelectItem value="proposal_sent">Proposal Sent</SelectItem>
            <SelectItem value="booked">Booked</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>
        {cities.length > 0 && (
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-36 h-9 text-sm bg-white">
              <SelectValue placeholder="City" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="ml-auto">
          <Tabs value={view} onValueChange={setView}>
            <TabsList className="h-9 bg-white border">
              <TabsTrigger value="kanban" className="text-xs px-3">
                <LayoutGrid className="w-3.5 h-3.5 mr-1" />
                Pipeline
              </TabsTrigger>
              <TabsTrigger value="table" className="text-xs px-3">
                <List className="w-3.5 h-3.5 mr-1" />
                Table
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content */}
      {view === "kanban" ? (
        <LeadPipelineKanban
          leads={filteredLeads}
          onRefresh={() => queryClient.invalidateQueries(["leads"])}
        />
      ) : (
        <LeadTable leads={filteredLeads} />
      )}
    </div>
  );
}