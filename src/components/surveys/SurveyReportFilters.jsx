import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

const CITIES = ["TUL", "DFW", "HOU", "SAT", "KC", "STL", "INDY", "NASH", "DEN", "ATL"];

export default function SurveyReportFilters({ filters, onChange, djs = [], templates = [], showTemplateFilter = false, showTaskStatusFilter = false, showLowScoreToggle = false, showSearch = false }) {
  const set = (key, val) => onChange({ ...filters, [key]: val });
  const clear = () => onChange({ date_from: "", date_to: "", city: "", dj_id: "", template_id: "", low_score_only: false, task_status: "", search: "" });

  const hasFilters = filters.date_from || filters.date_to || filters.city || filters.dj_id || filters.template_id || filters.low_score_only || filters.task_status || filters.search;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {showSearch && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            className="pl-9 w-52"
            placeholder="Search…"
            value={filters.search || ""}
            onChange={e => set("search", e.target.value)}
          />
        </div>
      )}

      <Input
        type="date"
        className="w-36 text-sm"
        value={filters.date_from || ""}
        onChange={e => set("date_from", e.target.value)}
        placeholder="From"
      />
      <Input
        type="date"
        className="w-36 text-sm"
        value={filters.date_to || ""}
        onChange={e => set("date_to", e.target.value)}
        placeholder="To"
      />

      <Select value={filters.city || ""} onValueChange={v => set("city", v === "_all" ? "" : v)}>
        <SelectTrigger className="w-28 text-sm">
          <SelectValue placeholder="City" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">All Cities</SelectItem>
          {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>

      {djs.length > 0 && (
        <Select value={filters.dj_id || ""} onValueChange={v => set("dj_id", v === "_all" ? "" : v)}>
          <SelectTrigger className="w-44 text-sm">
            <SelectValue placeholder="All DJs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All DJs</SelectItem>
            {djs.map(dj => <SelectItem key={dj.id} value={dj.id}>{dj.stage_name || dj.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {showTemplateFilter && templates.length > 0 && (
        <Select value={filters.template_id || ""} onValueChange={v => set("template_id", v === "_all" ? "" : v)}>
          <SelectTrigger className="w-44 text-sm">
            <SelectValue placeholder="All Templates" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Templates</SelectItem>
            {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {showTaskStatusFilter && (
        <Select value={filters.task_status || ""} onValueChange={v => set("task_status", v === "_all" ? "" : v)}>
          <SelectTrigger className="w-36 text-sm">
            <SelectValue placeholder="Task Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Any Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="none">No Task</SelectItem>
          </SelectContent>
        </Select>
      )}

      {showLowScoreToggle && (
        <button
          onClick={() => set("low_score_only", !filters.low_score_only)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            filters.low_score_only
              ? "bg-red-50 text-red-700 border-red-300"
              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
          }`}
        >
          Low Score Only
        </button>
      )}

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clear} className="text-gray-400 hover:text-gray-600 gap-1 text-xs">
          <X className="w-3.5 h-3.5" /> Clear
        </Button>
      )}
    </div>
  );
}