import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit, Copy, EyeOff, Eye, LayoutList } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const EVENT_TYPE_OPTIONS = ["wedding","corporate","school_dance","private_party","birthday","anniversary","mitzvah","quinceañera","holiday_party","other"];
const MANAGER_ROLES = new Set(["admin","city_manager","office_finalizer","sales_manager"]);

export default function TimelineTemplates() {
  const qc = useQueryClient();
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [timelineTypeFilter, setTimelineTypeFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const isManager = MANAGER_ROLES.has(currentUser?.role);

  const { data, isLoading } = useQuery({
    queryKey: ["timeline-templates", eventTypeFilter, timelineTypeFilter],
    queryFn: async () => {
      const r = await base44.functions.invoke("getTimelineTemplates", {
        event_type: eventTypeFilter || undefined,
        timeline_type: timelineTypeFilter || undefined,
        active_only: false,
      });
      return r.data;
    },
    staleTime: 30_000,
  });

  const templates = data?.templates || [];

  const handleDuplicate = async (t) => {
    try {
      const detailRes = await base44.functions.invoke("getTimelineTemplateDetail", { template_id: t.id });
      const { items } = detailRes.data;
      await base44.functions.invoke("saveTimelineTemplate", {
        action: "create",
        template: { ...t, id: undefined, name: `${t.name} (Copy)` },
        items,
      });
      qc.invalidateQueries(["timeline-templates"]);
      toast.success("Template duplicated");
    } catch (e) {
      toast.error(e.message || "Duplicate failed");
    }
  };

  const handleDeactivate = async (t) => {
    try {
      await base44.functions.invoke("deleteTimelineTemplate", { template_id: t.id });
      qc.invalidateQueries(["timeline-templates"]);
      toast.success(t.is_active ? "Template deactivated" : "Template reactivated");
    } catch (e) {
      toast.error(e.message || "Action failed");
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Timeline Templates</h1>
          <p className="text-sm text-gray-500 mt-0.5">Reusable timeline structures by event type</p>
        </div>
        {isManager && (
          <Link to={createPageUrl("TimelineTemplateBuilder") + "?action=new"}>
            <Button className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
              <Plus className="w-4 h-4" /> New Template
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="All Event Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>All Event Types</SelectItem>
            {EVENT_TYPE_OPTIONS.map(t => (
              <SelectItem key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={timelineTypeFilter} onValueChange={setTimelineTypeFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>All Types</SelectItem>
            <SelectItem value="PRIMARY">Primary</SelectItem>
            <SelectItem value="SECONDARY">Secondary</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
        ) : templates.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <LayoutList className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No templates yet. Create one to get started.</p>
          </div>
        ) : (
          templates.map(t => (
            <div key={t.id} className={`bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center gap-4 ${!t.is_active ? "opacity-50" : ""}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900 text-sm">{t.name}</span>
                  {!t.is_active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                  <Badge className="text-[10px] bg-violet-50 text-violet-700 border-0">
                    {t.timeline_type}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {t.event_type?.replace(/_/g, " ")}
                  </Badge>
                </div>
                {t.header_title && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{t.header_title}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isManager && (
                  <>
                    <Link to={createPageUrl("TimelineTemplateBuilder") + `?template_id=${t.id}`}>
                      <Button variant="outline" size="sm" className="gap-1 h-8 text-xs">
                        <Edit className="w-3 h-3" /> Edit
                      </Button>
                    </Link>
                    <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => handleDuplicate(t)} title="Duplicate">
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => handleDeactivate(t)}
                      title={t.is_active ? "Deactivate" : "Reactivate"}>
                      <EyeOff className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}