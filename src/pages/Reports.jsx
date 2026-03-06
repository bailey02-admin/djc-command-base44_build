import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Pencil, Trash2, Search, FileText, Share2, Lock, Globe } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import ShareModal from "@/components/reports/ShareModal";

const ENTITY_LABELS = { events: "Events", leads: "Leads", payments: "Payments" };
const ENTITY_COLORS = {
  events:   "bg-violet-50 text-violet-700 border-violet-200",
  leads:    "bg-sky-50 text-sky-700 border-sky-200",
  payments: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const VISIBILITY_BADGE = {
  private: { label: "Private", icon: Lock,    cls: "bg-gray-50 text-gray-500 border-gray-200" },
  org:     { label: "Org",     icon: Globe,   cls: "bg-blue-50 text-blue-600 border-blue-200" },
  shared:  { label: "Shared",  icon: Share2,  cls: "bg-amber-50 text-amber-700 border-amber-200" },
};

const MANAGER_ROLES = new Set(['admin', 'city_manager', 'sales_manager', 'production_manager', 'office_finalizer', 'finance']);

export default function Reports() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [shareTarget, setShareTarget] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["report-definitions"],
    queryFn: () => base44.functions.invoke("getReportDefinitions", {}).then(r => r.data),
  });

  // Detect current user's role
  const { data: meData } = useQuery({
    queryKey: ["rbac-me"],
    queryFn: () => base44.functions.invoke("rbacDebug", {}).then(r => r.data),
  });
  const myRole = meData?.custom_role;
  const isManager = MANAGER_ROLES.has(myRole);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.functions.invoke("deleteReportDefinition", { id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["report-definitions"] }),
  });

  const shareMutation = useMutation({
    mutationFn: ({ id, ...payload }) => base44.functions.invoke("saveReportDefinition", { id, ...payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-definitions"] });
      setShareTarget(null);
    },
  });

  const reports = (data?.reports || []).filter(r => {
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase());
    const matchEntity = !entityFilter || r.entity_key === entityFilter;
    return matchSearch && matchEntity;
  });

  const handleShareSave = async (shareData) => {
    const r = shareTarget;
    await shareMutation.mutateAsync({
      id: r.id,
      name: r.name,
      entity_key: r.entity_key,
      columns: r.columns,
      filters: r.filters,
      sort: r.sort,
      limit: r.limit,
      ...shareData,
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Build, run, and save custom reports</p>
        </div>
        {isManager && (
          <Button onClick={() => navigate(createPageUrl("ReportBuilder"))} className="bg-violet-600 hover:bg-violet-700 gap-2">
            <Plus className="w-4 h-4" /> New Report
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input className="pl-9 w-64" placeholder="Search reports…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {["", "events", "leads", "payments"].map(k => (
            <button
              key={k}
              onClick={() => setEntityFilter(k)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                entityFilter === k ? "bg-violet-600 text-white border-violet-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
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
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-24 border-2 border-dashed border-gray-200 rounded-xl">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No saved reports yet</p>
          {isManager && <p className="text-sm text-gray-400 mt-1">Click "New Report" to build your first report.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => {
            const perms = r._perms || {};
            const vis = VISIBILITY_BADGE[r.visibility || "private"];
            const VisIcon = vis.icon;
            return (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4 hover:border-violet-300 hover:shadow-sm transition-all">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{r.name}</span>
                    <Badge className={`text-xs border ${ENTITY_COLORS[r.entity_key]}`}>{ENTITY_LABELS[r.entity_key]}</Badge>
                    <Badge className={`text-xs border gap-1 ${vis.cls}`}>
                      <VisIcon className="w-3 h-3" /> {vis.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {r.columns?.length || 0} columns
                    {r.created_date ? ` · Created ${format(new Date(r.created_date), "MMM d, yyyy")}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate(createPageUrl(`ReportBuilder?id=${r.id}`))}>
                    <Play className="w-3.5 h-3.5" /> Run
                  </Button>
                  {perms.can_share && (
                    <Button size="sm" variant="ghost" onClick={() => setShareTarget(r)}>
                      <Share2 className="w-4 h-4" />
                    </Button>
                  )}
                  {perms.can_edit && (
                    <Button size="sm" variant="ghost" onClick={() => navigate(createPageUrl(`ReportBuilder?id=${r.id}`))}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                  {perms.can_delete && (
                    <Button
                      size="sm" variant="ghost"
                      className="text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => { if (confirm("Delete this report?")) deleteMutation.mutate(r.id); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {shareTarget && (
        <ShareModal
          report={shareTarget}
          open={!!shareTarget}
          onClose={() => setShareTarget(null)}
          onSave={handleShareSave}
        />
      )}
    </div>
  );
}