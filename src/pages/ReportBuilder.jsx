import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Play, Save, Download, Trash2, ChevronLeft, Loader2, FileText,
  Settings2, Filter, SortAsc
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ColumnPicker from "@/components/reports/ColumnPicker";
import FiltersPanel from "@/components/reports/FiltersPanel";
import ResultsTable from "@/components/reports/ResultsTable";

// ── Allowlist mirrors backend ─────────────────────────────────────────────────
const COLUMNS_BY_ENTITY = {
  events: [
    { key: "event_date", label: "Event Date" },
    { key: "start_time", label: "Start Time" },
    { key: "city", label: "City" },
    { key: "status", label: "Status" },
    { key: "event_name", label: "Event Name" },
    { key: "event_type", label: "Event Type" },
    { key: "contact_name", label: "Contact Name" },
    { key: "contact_email", label: "Contact Email" },
    { key: "venue_name", label: "Venue" },
    { key: "assigned_dj", label: "Assigned DJ" },
    { key: "assigned_mc", label: "Assigned MC" },
    { key: "package_name", label: "Package" },
    { key: "package_price", label: "Package Price" },
    { key: "guest_count", label: "Guest Count" },
    { key: "planning_complete", label: "Planning Complete" },
    { key: "contract_signed", label: "Contract Signed" },
    { key: "deposit_paid", label: "Deposit Paid" },
    { key: "balance_paid", label: "Balance Paid" },
    { key: "readiness_score", label: "Readiness Score" },
  ],
  leads: [
    { key: "created_date", label: "Created Date" },
    { key: "city", label: "City" },
    { key: "lead_status", label: "Lead Status" },
    { key: "status", label: "CRM Status" },
    { key: "pipeline_stage", label: "Pipeline Stage" },
    { key: "client_first_name", label: "First Name" },
    { key: "client_last_name", label: "Last Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "event_type", label: "Event Type" },
    { key: "event_date", label: "Event Date" },
    { key: "lead_source", label: "Lead Source" },
    { key: "assigned_rep", label: "Assigned Rep" },
    { key: "quote_amount", label: "Quote Amount" },
    { key: "lost_reason", label: "Lost Reason" },
    { key: "priority", label: "Priority" },
  ],
  payments: [
    { key: "created_date", label: "Date Created" },
    { key: "paid_date", label: "Date Paid" },
    { key: "due_date", label: "Due Date" },
    { key: "amount", label: "Amount" },
    { key: "payment_type", label: "Payment Type" },
    { key: "payment_method", label: "Method" },
    { key: "status", label: "Status" },
    { key: "contact_name", label: "Contact" },
    { key: "transaction_reference", label: "Reference" },
    { key: "notes", label: "Notes" },
  ],
};

const LIMITS = [25, 50, 100, 500];
const ENTITY_LABELS = { events: "Events", leads: "Leads", payments: "Payments" };

function exportCSV(columns, rows) {
  const header = columns.map(c => c.label).join(",");
  const lines = rows.map(row =>
    columns.map(c => {
      const v = row[c.key];
      if (v === null || v === undefined) return "";
      const s = String(v).replace(/"/g, '""');
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
    }).join(",")
  );
  const csv = [header, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "report.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportBuilder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = new URLSearchParams(window.location.search);
  const reportId = params.get("id");

  // ── State ──────────────────────────────────────────────────────────────────
  const [name, setName] = useState("Untitled Report");
  const [entityKey, setEntityKey] = useState("events");
  const [selectedColumns, setSelectedColumns] = useState(["event_date", "city", "status", "event_name", "contact_name"]);
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState("-event_date");
  const [limit, setLimit] = useState(500);
  const [isShared, setIsShared] = useState(false);
  const [results, setResults] = useState(null);
  const [resultColumns, setResultColumns] = useState([]);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [activeTab, setActiveTab] = useState("columns"); // columns | filters | sort

  // ── Load saved report ──────────────────────────────────────────────────────
  const { data: defData, isLoading: defLoading } = useQuery({
    queryKey: ["report-def", reportId],
    queryFn: () => base44.functions.invoke("getReportDefinitions", { id: reportId }).then(r => r.data),
    enabled: !!reportId,
  });

  useEffect(() => {
    if (defData?.report) {
      const r = defData.report;
      setName(r.name);
      setEntityKey(r.entity_key);
      setSelectedColumns(r.columns || []);
      setFilters(r.filters || {});
      setSort(r.sort || "");
      setLimit(r.limit || 500);
      setIsShared(r.is_shared || false);
    }
  }, [defData]);

  // ── Run report ─────────────────────────────────────────────────────────────
  const handleRun = async () => {
    setRunning(true);
    setRunError("");
    setResults(null);
    const res = await base44.functions.invoke("runReport", {
      entity_key: entityKey,
      columns: selectedColumns,
      filters,
      sort,
      limit,
    });
    setRunning(false);
    if (res.data?.error) {
      setRunError(res.data.error);
    } else {
      setResults(res.data.rows || []);
      setResultColumns(res.data.columns || []);
    }
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (payload) => base44.functions.invoke("saveReportDefinition", payload),
    onSuccess: (res) => {
      setSaveError("");
      queryClient.invalidateQueries({ queryKey: ["report-definitions"] });
      const newId = res.data?.report?.id;
      if (newId && !reportId) {
        navigate(createPageUrl(`ReportBuilder?id=${newId}`), { replace: true });
      }
    },
    onError: (e) => setSaveError(e.message),
  });

  const handleSave = () => {
    if (selectedColumns.length === 0) { setSaveError("Select at least one column."); return; }
    saveMutation.mutate({
      id: reportId || undefined,
      name, entity_key: entityKey,
      columns: selectedColumns,
      filters, sort, limit, is_shared: isShared,
    });
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: () => base44.functions.invoke("deleteReportDefinition", { id: reportId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-definitions"] });
      navigate(createPageUrl("Reports"));
    },
  });

  // ── Change entity → reset columns ─────────────────────────────────────────
  const handleEntityChange = (val) => {
    setEntityKey(val);
    setSelectedColumns([]);
    setFilters({});
    setSort("");
    setResults(null);
  };

  const availableColumns = COLUMNS_BY_ENTITY[entityKey] || [];
  const sortOptions = availableColumns;

  if (defLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => navigate(createPageUrl("Reports"))}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
        >
          <ChevronLeft className="w-4 h-4" /> Reports
        </button>
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            className="font-semibold text-base max-w-xs"
            placeholder="Report name…"
          />
          <Badge className="bg-gray-100 text-gray-600 border border-gray-200">
            {ENTITY_LABELS[entityKey]}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {reportId && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-400 hover:text-red-600 hover:bg-red-50"
              onClick={() => { if (confirm("Delete this report?")) deleteMutation.mutate(); }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="gap-1.5">
            {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {reportId ? "Save" : "Save Report"}
          </Button>
          <Button
            size="sm"
            className="bg-violet-600 hover:bg-violet-700 gap-1.5"
            onClick={handleRun}
            disabled={running || selectedColumns.length === 0}
          >
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Run Report
          </Button>
        </div>
      </div>

      {(saveError || runError) && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {saveError || runError}
        </div>
      )}
      {saveMutation.isSuccess && (
        <div className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">
          Report saved.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left panel — config */}
        <div className="lg:col-span-1 space-y-4">
          {/* Entity */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Data Source</h3>
            <Select value={entityKey} onValueChange={handleEntityChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="events">Events</SelectItem>
                <SelectItem value="leads">Leads</SelectItem>
                <SelectItem value="payments">Payments</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Config tabs */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex border-b border-gray-100">
              {[
                { id: "columns", icon: Settings2, label: "Columns" },
                { id: "filters", icon: Filter, label: "Filters" },
                { id: "sort", icon: SortAsc, label: "Sort & Limit" },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                    activeTab === tab.id
                      ? "text-violet-700 bg-violet-50 border-b-2 border-violet-600"
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" /> {tab.label}
                </button>
              ))}
            </div>
            <div className="p-4">
              {activeTab === "columns" && (
                <ColumnPicker
                  available={availableColumns}
                  selected={selectedColumns}
                  onChange={setSelectedColumns}
                />
              )}
              {activeTab === "filters" && (
                <FiltersPanel
                  entityKey={entityKey}
                  filters={filters}
                  onChange={setFilters}
                />
              )}
              {activeTab === "sort" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">Sort By</Label>
                    <Select value={sort || ""} onValueChange={setSort}>
                      <SelectTrigger>
                        <SelectValue placeholder="Default sort" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>Default</SelectItem>
                        {sortOptions.map(c => (
                          <React.Fragment key={c.key}>
                            <SelectItem value={c.key}>{c.label} ↑ (asc)</SelectItem>
                            <SelectItem value={`-${c.key}`}>{c.label} ↓ (desc)</SelectItem>
                          </React.Fragment>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">Limit</Label>
                    <div className="flex gap-2 flex-wrap">
                      {LIMITS.map(l => (
                        <button
                          key={l}
                          onClick={() => setLimit(l)}
                          className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                            limit === l
                              ? "bg-violet-600 text-white border-violet-600"
                              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-gray-500">Shared with all staff</Label>
                    <Switch checked={isShared} onCheckedChange={setIsShared} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right panel — results */}
        <div className="lg:col-span-2 space-y-3">
          {results === null && !running && (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-200 rounded-xl text-center">
              <FileText className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">Configure and run your report</p>
              <p className="text-sm text-gray-400 mt-1">Select columns, apply filters, then click Run Report.</p>
            </div>
          )}
          {running && (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-7 h-7 animate-spin text-violet-600" />
            </div>
          )}
          {results !== null && !running && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  <span className="font-semibold text-gray-800">{results.length}</span> rows returned
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => exportCSV(resultColumns, results)}
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </Button>
              </div>
              {results.length === 0 ? (
                <div className="flex items-center justify-center h-40 border border-gray-200 rounded-xl text-gray-400 text-sm">
                  No rows matched your filters.
                </div>
              ) : (
                <ResultsTable columns={resultColumns} rows={results} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}