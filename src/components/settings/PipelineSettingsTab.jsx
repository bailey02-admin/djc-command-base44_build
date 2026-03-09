import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Loader2, Save } from "lucide-react";
import { PIPELINE_FIELD_OPTIONS, normalizePipelineStages } from "@/components/crm/pipeline";

// ── Stage accordion row ────────────────────────────────────────────────────
function StageRow({ stage, savedStage, isOpen, onToggle, onUpdate, onToggleArray, sortedStages, onSave, saving }) {
  const rowRef = useRef(null);
  const isDirty = JSON.stringify(stage) !== JSON.stringify(savedStage);

  useEffect(() => {
    if (isOpen && rowRef.current) {
      setTimeout(() => rowRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    }
  }, [isOpen]);

  return (
    <div
      ref={rowRef}
      className={`rounded-xl border bg-white transition-all ${isOpen ? "border-violet-300 shadow-md" : "border-gray-200/80 shadow-sm"} ${isDirty && !isOpen ? "border-amber-300" : ""}`}
    >
      {/* Summary row */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/60 transition-colors rounded-xl"
      >
        <span className="text-gray-400 flex-shrink-0">
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>

        <span className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">{stage.label}</span>
          <Badge variant="outline" className="font-mono text-[10px] text-gray-400">{stage.key}</Badge>
          {isDirty && <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">Unsaved</Badge>}
        </span>

        <span className="hidden sm:flex items-center gap-3 flex-shrink-0 text-[11px] text-gray-400">
          <span className="w-16 text-right">Order: {stage.sort_order}</span>
          {stage.is_active
            ? <span className="text-emerald-600 font-medium">Active</span>
            : <span className="text-gray-300">Inactive</span>}
          {stage.is_terminal
            ? <span className="text-orange-500 font-medium">Terminal</span>
            : <span className="text-gray-300">—</span>}
          <span>{stage.required_fields?.length || 0} req</span>
          <span>{stage.allowed_next_stages?.length || 0} next</span>
        </span>
      </button>

      {/* Expanded form */}
      {isOpen && (
        <div className="px-4 pb-5 pt-1 space-y-5 border-t border-gray-100">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Display Label</Label>
              <Input className="mt-1" value={stage.label} onChange={(e) => onUpdate({ label: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Stage Order</Label>
              <Input className="mt-1" type="number" value={stage.sort_order} onChange={(e) => onUpdate({ sort_order: Number(e.target.value) || 0 })} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={!!stage.is_active} onChange={(e) => onUpdate({ is_active: e.target.checked })} />
              Active stage
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={!!stage.is_terminal} onChange={(e) => onUpdate({ is_terminal: e.target.checked })} />
              Terminal stage
            </label>
          </div>

          <div>
            <Label className="text-xs">Description / Help Text</Label>
            <Textarea className="mt-1 min-h-[80px]" value={stage.description || ""} onChange={(e) => onUpdate({ description: e.target.value })} />
          </div>

          <div>
            <Label className="text-xs">Required Fields</Label>
            <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {PIPELINE_FIELD_OPTIONS.map((field) => (
                <label key={field.key} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-gray-700 bg-white cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={(stage.required_fields || []).includes(field.key)}
                    onChange={() => onToggleArray("required_fields", field.key)}
                  />
                  {field.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Allowed Next Stages</Label>
            <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {sortedStages.filter((c) => c.key !== stage.key).map((candidate) => (
                <label key={candidate.key} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-gray-700 bg-white cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={(stage.allowed_next_stages || []).includes(candidate.key)}
                    onChange={() => onToggleArray("allowed_next_stages", candidate.key)}
                  />
                  <span className="truncate">{candidate.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onToggle}>Cancel</Button>
            <Button size="sm" onClick={onSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700 gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Stage
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main tab ───────────────────────────────────────────────────────────────
export default function PipelineSettingsTab() {
  const queryClient = useQueryClient();
  const [stages, setStages] = useState([]);
  const [savedStages, setSavedStages] = useState([]);
  const [openKey, setOpenKey] = useState(null);
  const [savingKey, setSavingKey] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["pipeline-settings"],
    queryFn: () => base44.functions.invoke("getPipelineSettings", {}).then((r) => r.data),
  });

  useEffect(() => {
    if (data?.stages) {
      const normalized = normalizePipelineStages(data.stages);
      setStages(normalized);
      setSavedStages(normalized);
    }
  }, [data]);

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.sort_order - b.sort_order),
    [stages]
  );

  const updateStage = useCallback((stageKey, patch) => {
    setStages((prev) => prev.map((s) => s.key === stageKey ? { ...s, ...patch } : s));
  }, []);

  const toggleArrayValue = useCallback((stageKey, field, value) => {
    setStages((prev) => prev.map((s) => {
      if (s.key !== stageKey) return s;
      const current = new Set(s[field] || []);
      if (current.has(value)) current.delete(value); else current.add(value);
      return { ...s, [field]: [...current] };
    }));
  }, []);

  const handleSaveStage = async (stageKey) => {
    setSavingKey(stageKey);
    await base44.functions.invoke("savePipelineSettings", { stages });
    await queryClient.invalidateQueries({ queryKey: ["pipeline-settings"] });
    setSavedStages([...stages]);
    setOpenKey(null);
    setSavingKey(null);
  };

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-12 flex items-center justify-center text-gray-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading pipeline settings…
        </CardContent>
      </Card>
    );
  }

  const anyDirty = JSON.stringify(stages) !== JSON.stringify(savedStages);

  return (
    <div className="space-y-3">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Pipeline Settings</CardTitle>
          <p className="text-xs text-gray-400 mt-1">Stage keys are locked. Labels, order, active/terminal state, required fields, and allowed transitions are editable per stage.</p>
        </CardHeader>
        {anyDirty && (
          <CardContent className="pt-0">
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              You have unsaved changes. Open a stage and click "Save Stage" to apply.
            </p>
          </CardContent>
        )}
      </Card>

      {sortedStages.map((stage) => {
        const savedStage = savedStages.find((s) => s.key === stage.key) || stage;
        return (
          <StageRow
            key={stage.key}
            stage={stage}
            savedStage={savedStage}
            isOpen={openKey === stage.key}
            onToggle={() => setOpenKey(openKey === stage.key ? null : stage.key)}
            onUpdate={(patch) => updateStage(stage.key, patch)}
            onToggleArray={(field, value) => toggleArrayValue(stage.key, field, value)}
            sortedStages={sortedStages}
            onSave={() => handleSaveStage(stage.key)}
            saving={savingKey === stage.key}
          />
        );
      })}
    </div>
  );
}