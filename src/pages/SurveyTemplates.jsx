import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus, Search, ClipboardList, Edit, ToggleLeft, ToggleRight,
  Copy, Star, Loader2, AlertCircle
} from "lucide-react";

const EVENT_TYPES = [
  "wedding","corporate","school_dance","private_party","birthday",
  "anniversary","mitzvah","quinceañera","holiday_party","other"
];

export default function SurveyTemplates() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterActive, setFilterActive] = useState("active");
  const [actionLoading, setActionLoading] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["survey-templates"],
    queryFn: async () => {
      const res = await base44.functions.invoke("getSurveyTemplates", {});
      return res.data?.templates || [];
    },
  });

  const templates = (data || []).filter(t => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase());
    const matchActive =
      filterActive === "all" ||
      (filterActive === "active" && t.is_active !== false) ||
      (filterActive === "inactive" && t.is_active === false);
    const matchType =
      filterType === "all" ||
      !t.applies_to_event_types?.length ||
      t.applies_to_event_types.includes(filterType);
    return matchSearch && matchActive && matchType;
  });

  const handleDeactivate = async (t) => {
    setActionLoading(t.id + "_toggle");
    await base44.functions.invoke("deleteSurveyTemplate", { template_id: t.id });
    queryClient.invalidateQueries(["survey-templates"]);
    setActionLoading(null);
  };

  const handleDuplicate = async (t) => {
    setActionLoading(t.id + "_dup");
    const detailRes = await base44.functions.invoke("getSurveyTemplateDetail", { template_id: t.id });
    const { questions = [] } = detailRes.data;
    await base44.functions.invoke("saveSurveyTemplate", {
      action: "create",
      template: {
        ...t,
        id: undefined,
        name: `${t.name} (Copy)`,
        is_active: true,
      },
      questions: questions.map(q => ({ ...q, id: undefined, template_id: undefined })),
    });
    queryClient.invalidateQueries(["survey-templates"]);
    setActionLoading(null);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-64 text-red-500 gap-2">
      <AlertCircle className="w-4 h-4" /> Failed to load templates.
    </div>
  );

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-violet-600" /> Survey Templates
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage post-event survey templates</p>
        </div>
        <Link to={createPageUrl("SurveyTemplateBuilder")}>
          <Button className="bg-violet-600 hover:bg-violet-700 gap-1.5">
            <Plus className="w-4 h-4" /> New Template
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search templates…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={filterActive} onValueChange={setFilterActive}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Event type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All event types</SelectItem>
            {EVENT_TYPES.map(t => (
              <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <ClipboardList className="w-10 h-10 text-gray-200 mx-auto" />
            <p className="text-gray-400 text-sm">No survey templates found.</p>
            <Link to={createPageUrl("SurveyTemplateBuilder")}>
              <Button variant="outline" size="sm"><Plus className="w-4 h-4 mr-1" />Create your first template</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map(t => (
            <Card key={t.id} className={`border shadow-sm transition-opacity ${t.is_active === false ? "opacity-60" : ""}`}>
              <CardContent className="p-4 flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 text-sm">{t.name}</h3>
                    <Badge variant="outline" className={t.is_active !== false ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-gray-200 text-gray-400"}>
                      {t.is_active !== false ? "Active" : "Inactive"}
                    </Badge>
                    {t.send_automatically && (
                      <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50 text-[10px]">Auto-send</Badge>
                    )}
                  </div>
                  {t.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{t.description}</p>}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {t.applies_to_event_types?.length > 0 && (
                      <span className="text-xs text-gray-500">
                        Types: {t.applies_to_event_types.map(e => e.replace(/_/g, " ")).join(", ")}
                      </span>
                    )}
                    {t.applies_to_cities?.length > 0 && (
                      <span className="text-xs text-gray-500">Cities: {t.applies_to_cities.join(", ")}</span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-amber-700">
                      <Star className="w-3 h-3" /> Threshold: {t.low_score_threshold ?? 7.0}/10
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => handleDuplicate(t)}
                    disabled={actionLoading === t.id + "_dup"}
                    className="text-xs gap-1"
                  >
                    {actionLoading === t.id + "_dup" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                    Duplicate
                  </Button>
                  {t.is_active !== false && (
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => handleDeactivate(t)}
                      disabled={actionLoading === t.id + "_toggle"}
                      className="text-xs gap-1 text-amber-600 hover:text-amber-800"
                    >
                      {actionLoading === t.id + "_toggle" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                      Deactivate
                    </Button>
                  )}
                  <Link to={createPageUrl("SurveyTemplateBuilder") + `?id=${t.id}`}>
                    <Button variant="outline" size="sm" className="text-xs gap-1">
                      <Edit className="w-3.5 h-3.5" /> Edit
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}