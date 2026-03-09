import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save } from "lucide-react";
import { PIPELINE_FIELD_OPTIONS, normalizePipelineStages } from "@/components/crm/pipeline";

export default function PipelineSettingsTab() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [stages, setStages] = useState([]);

  const { data, isLoading } = useQuery({
    queryKey: ["pipeline-settings"],
    queryFn: () => base44.functions.invoke("getPipelineSettings", {}).then((r) => r.data),
  });

  useEffect(() => {
    if (data?.stages) setStages(normalizePipelineStages(data.stages));
  }, [data]);

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.sort_order - b.sort_order),
    [stages]
  );

  const toggleArrayValue = (stageKey, field, value) => {
    setStages((prev) => prev.map((stage) => {
      if (stage.key !== stageKey) return stage;
      const current = new Set(stage[field] || []);
      if (current.has(value)) current.delete(value); else current.add(value);
      return { ...stage, [field]: [...current] };
    }));
  };

  const updateStage = (stageKey, patch) => {
    setStages((prev) => prev.map((stage) => stage.key === stageKey ? { ...stage, ...patch } : stage));
  };

  const handleSave = async () => {
    setSaving(true);
    await base44.functions.invoke("savePipelineSettings", { stages });
    await queryClient.invalidateQueries({ queryKey: ["pipeline-settings"] });
    setSaving(false);
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

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Pipeline Settings v2</CardTitle>
          <p className="text-xs text-gray-400 mt-1">Stage keys are locked for safety. Labels, order, active state, required fields, allowed next stages, terminal flags, and help text are editable.</p>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="text-xs text-gray-500">Changes here drive the same server-side validation used by lead stage transitions.</div>
          <Button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700 gap-2 self-start sm:self-auto">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Pipeline
          </Button>
        </CardContent>
      </Card>

      {sortedStages.map((stage) => (
        <Card key={stage.key} className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-semibold">{stage.label}</CardTitle>
                <p className="text-xs text-gray-400 mt-1">Internal key stays fixed so reports, automations, and backend rules remain stable.</p>
              </div>
              <Badge variant="outline" className="w-fit font-mono text-[10px]">{stage.key}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Display Label</Label>
                <Input className="mt-1" value={stage.label} onChange={(e) => updateStage(stage.key, { label: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Stage Order</Label>
                <Input className="mt-1" type="number" value={stage.sort_order} onChange={(e) => updateStage(stage.key, { sort_order: Number(e.target.value) || 0 })} />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={!!stage.is_active} onChange={(e) => updateStage(stage.key, { is_active: e.target.checked })} />
                Active stage
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={!!stage.is_terminal} onChange={(e) => updateStage(stage.key, { is_terminal: e.target.checked })} />
                Terminal stage
              </label>
            </div>

            <div>
              <Label className="text-xs">Description / Help Text</Label>
              <Textarea className="mt-1 min-h-[90px]" value={stage.description || ""} onChange={(e) => updateStage(stage.key, { description: e.target.value })} />
            </div>

            <div>
              <Label className="text-xs">Required Fields</Label>
              <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {PIPELINE_FIELD_OPTIONS.map((field) => (
                  <label key={field.key} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-gray-700 bg-white">
                    <input
                      type="checkbox"
                      checked={(stage.required_fields || []).includes(field.key)}
                      onChange={() => toggleArrayValue(stage.key, "required_fields", field.key)}
                    />
                    {field.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs">Allowed Next Stages</Label>
              <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {sortedStages.filter((candidate) => candidate.key !== stage.key).map((candidate) => (
                  <label key={candidate.key} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-gray-700 bg-white">
                    <input
                      type="checkbox"
                      checked={(stage.allowed_next_stages || []).includes(candidate.key)}
                      onChange={() => toggleArrayValue(stage.key, "allowed_next_stages", candidate.key)}
                    />
                    <span>{candidate.label}</span>
                    <span className="text-gray-300">•</span>
                    <span className="font-mono text-[10px] text-gray-400">{candidate.key}</span>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}