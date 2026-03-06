import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Pencil, Trash2, Search, FileText, Share2 } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

const ENTITY_LABELS = { events: "Events", leads: "Leads", payments: "Payments" };
const ENTITY_COLORS = {
  events:   "bg-violet-50 text-violet-700 border-violet-200",
  leads:    "bg-sky-50 text-sky-700 border-sky-200",
  payments: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function Reports() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["report-definitions"],
    queryFn: () => base44.functions.invoke("getReportDefinitions", {}).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.functions.invoke("deleteReportDefinition", { id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["report-definitions"] }),
  });

  const reports = (data?.reports || []).filter(r => {
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase());
    const matchEntity = !entityFilter || r.entity_key === entityFilter;
    return matchSearch && matchEntity;
  });

  const handleRun = (report) => {
    navigate(createPageUrl(`ReportBuilder?id=${report.id}`));
  };

  const handleEdit = (report) => {
    navigate(createPageUrl(`ReportBuilder?id=${report.id}`));
  };

  const handleNew = () => {
    navigate(createPageUrl("ReportBuilder"));
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Build, run, and save custom reports</p>
        </div>
        <Button onClick={handleNew} className="bg-violet-600 hover:bg-violet-700 gap-2">
          <Plus className="w-4 h-4" /> New Report
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            className="pl-9 w-64"
            placeholder="Search reports…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {["", "events", "leads", "payments"].map(k => (
            <button
              key={k}
              onClick={() => setEntityFilter(k)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                entityFilter === k
                  ? "bg-violet-600 text-white border-violet-600"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {k ? ENTITY_LABELS[k] : "All"}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-24 border-2 border-dashed border-gray-200 rounded-xl">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No saved reports yet</p>
          <p className="text-sm text-gray-400 mt-1">Click "New Report" to build your first report.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <div
              key={r.id}
              className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4 hover:border-violet-300 hover:shadow-sm transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900 text-sm">{r.name}</span>
                  <Badge className={`text-xs border ${ENTITY_COLORS[r.entity_key]}`}>
                    {ENTITY_LABELS[r.entity_key]}
                  </Badge>
                  {r.is_shared && (
                    <Badge className="text-xs border bg-amber-50 text-amber-700 border-amber-200 gap-1">
                      <Share2 className="w-3 h-3" /> Shared
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {r.columns?.length || 0} columns
                  {r.created_date ? ` · Created ${format(new Date(r.created_date), "MMM d, yyyy")}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleRun(r)}>
                  <Play className="w-3.5 h-3.5" /> Run
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleEdit(r)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  size="sm" variant="ghost"
                  className="text-red-400 hover:text-red-600 hover:bg-red-50"
                  onClick={() => { if (confirm("Delete this report?")) deleteMutation.mutate(r.id); }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}