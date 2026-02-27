import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Plus, Loader2, Pencil, Check, X, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

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
    </div>
  );
}