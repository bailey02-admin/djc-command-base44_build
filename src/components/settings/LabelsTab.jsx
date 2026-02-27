import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2, Pencil, Check, X, Trash2, AlertTriangle, Sprout, Flame } from "lucide-react";
import { toast } from "sonner";
import { AdminAPI } from "../api/secureApi";

const CATEGORIES = [
  { key: "lead_status", label: "Lead Status" },
  { key: "event_status", label: "Event Status" },
  { key: "city", label: "Cities" },
  { key: "calendar_type", label: "Calendar Types" },
  { key: "shift_type", label: "Shift Types" },
  { key: "lead_flag", label: "Lead Flags" },
];

function LabelRow({ record, onSave, onToggle }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(record.label);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onSave(record.id, { label });
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-3 py-2 border-b last:border-0">
      <code className="text-xs font-mono text-gray-400 w-40 flex-shrink-0">{record.key}</code>
      {editing ? (
        <div className="flex-1 flex items-center gap-2">
          <Input value={label} onChange={e => setLabel(e.target.value)} className="h-7 text-sm" autoFocus />
          <Button size="icon" className="h-7 w-7 bg-green-600 hover:bg-green-700" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setLabel(record.label); setEditing(false); }}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-between">
          <span className="text-sm font-medium">{record.label}</span>
          <div className="flex items-center gap-2">
            <Switch checked={record.is_active !== false} onCheckedChange={v => onToggle(record.id, v)} />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}>
              <Pencil className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LabelsTab() {
  const qc = useQueryClient();
  const [activeCategory, setActiveCategory] = useState("lead_status");
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["label_map"],
    queryFn: () => base44.entities.LabelMap.list("sort_order", 200),
  });

  const filtered = records.filter(r => r.category === activeCategory).sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));

  const handleSave = async (id, data) => {
    await base44.entities.LabelMap.update(id, data);
    qc.invalidateQueries(["label_map"]);
  };

  const handleToggle = async (id, is_active) => {
    await base44.entities.LabelMap.update(id, { is_active });
    qc.invalidateQueries(["label_map"]);
  };

  const handleResetAndSeed = async () => {
    setResetting(true);
    setShowResetConfirm(false);
    try {
      const resetRes = await base44.functions.invoke("adminResetTestData", {});
      const resetData = resetRes.data || {};
      if (!resetData.ok) throw new Error(resetData.error || "Reset failed");

      const seedRes = await base44.functions.invoke("adminSeedDemoData", {});
      const seedData = seedRes.data || {};
      if (!seedData.ok) throw new Error(seedData.error || "Seed failed");

      const del = resetData.deleted || {};
      const lm = resetData.labelMap || {};
      toast.success(
        `Reset: deleted ${del.leads ?? 0} leads, ${del.events ?? 0} events, ${del.tasks ?? 0} tasks, ${del.activities ?? 0} activities. ` +
        `Seeded: ${seedData.leadsCreated} leads, ${seedData.eventsCreated} events (${seedData.linkedPairsCreated} linked pairs). ` +
        `LabelMap: ${lm.finalCount} records${lm.insertedCount > 0 ? ` (+${lm.insertedCount} added)` : " (complete)"}.`
      );
      qc.invalidateQueries(["label_map"]);
    } catch (err) {
      toast.error(`Reset failed: ${err.message}`);
    }
    setResetting(false);
  };

  const handleAdd = async () => {
    if (!newKey.trim() || !newLabel.trim()) return;
    setSaving(true);
    await base44.entities.LabelMap.create({
      key: newKey.trim().toLowerCase().replace(/\s+/g, "_"),
      label: newLabel.trim(),
      category: activeCategory,
      sort_order: filtered.length + 1,
      is_active: true,
    });
    qc.invalidateQueries(["label_map"]);
    setNewKey(""); setNewLabel(""); setAdding(false); setSaving(false);
  };

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Labels & Statuses</CardTitle>
            <p className="text-xs text-gray-400">Edit display labels without changing enum values in code</p>
          </div>
        </CardHeader>
        <CardContent>
          {/* Category tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            {CATEGORIES.map(c => (
              <button
                key={c.key}
                onClick={() => setActiveCategory(c.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeCategory === c.key
                    ? "bg-violet-100 text-violet-700 border border-violet-200"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent"
                }`}
              >
                {c.label}
                <span className="ml-1.5 text-[10px] opacity-60">
                  ({records.filter(r => r.category === c.key).length})
                </span>
              </button>
            ))}
          </div>

          {/* Label rows */}
          <div className="min-h-[200px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-32 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">No labels defined for this category yet.</p>
            ) : (
              filtered.map(r => (
                <LabelRow key={r.id} record={r} onSave={handleSave} onToggle={handleToggle} />
              ))
            )}
          </div>

          {/* Add new */}
          {adding ? (
            <div className="mt-4 flex items-center gap-2 p-3 bg-gray-50 rounded-lg border">
              <Input
                placeholder="canonical_key"
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
                className="h-8 font-mono text-xs w-40"
              />
              <Input
                placeholder="Display Label"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                className="h-8 flex-1"
              />
              <Button size="sm" onClick={handleAdd} disabled={saving || !newKey || !newLabel} className="bg-violet-600 hover:bg-violet-700">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewKey(""); setNewLabel(""); }}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="mt-3 gap-1" onClick={() => setAdding(true)}>
              <Plus className="w-3 h-3" /> Add Label
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm bg-amber-50/50 border-amber-100">
        <CardContent className="pt-4">
          <p className="text-xs text-amber-700">
            <strong>Note:</strong> Editing a label here changes the display text only. Canonical keys (enum values in code) remain unchanged and do not require a redeploy.
          </p>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border border-red-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!showResetConfirm ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Reset Test Data</p>
                <p className="text-xs text-gray-400 mt-0.5">Deletes ALL leads, events, tasks, payments, activities, and re-seeds demo data. LabelMap is preserved.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-red-300 text-red-600 hover:bg-red-50 gap-1.5"
                onClick={() => setShowResetConfirm(true)}
                disabled={resetting}
              >
                <Trash2 className="w-3.5 h-3.5" /> Reset Test Data
              </Button>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-red-700">⚠️ Are you sure?</p>
              <p className="text-xs text-red-600">
                This will permanently delete <strong>ALL</strong> test leads, events, tasks, payments, activities, and automation logs, then re-seed fresh demo data. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 gap-1"
                  onClick={handleResetAndSeed}
                  disabled={resetting}
                >
                  {resetting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  {resetting ? "Running..." : "Yes, Reset & Seed Demo Data"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowResetConfirm(false)} disabled={resetting}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}