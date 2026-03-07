import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Pencil, Check, X, Trash2, AlertTriangle, Sprout, Flame, Edit2 } from "lucide-react";
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
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [seedResult, setSeedResult] = useState(null);

  const [eventStatusSubTab, setEventStatusSubTab] = useState("statuses"); // "statuses" | "groups" | "finance"
  const [editingGroup, setEditingGroup] = useState(null); // group being edited
  const [groupStatuses, setGroupStatuses] = useState([]); // statuses[] for editingGroup
  const [savingGroup, setSavingGroup] = useState(false);
  const [financeStatuses, setFinanceStatuses] = useState(null); // null = not loaded yet
  const [financeGroupId, setFinanceGroupId] = useState(null);
  const [savingFinance, setSavingFinance] = useState(false);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["label_map"],
    queryFn: () => base44.entities.LabelMap.list("sort_order", 200),
  });

  const { data: statusSettings, isLoading: isLoadingGroups } = useQuery({
    queryKey: ["status-settings"],
    queryFn: async () => {
      const res = await base44.functions.invoke("getStatusSettings", {});
      return res.data;
    },
  });

  const allEventStatuses = statusSettings?.all_statuses || [];
  const eventGroups = (statusSettings?.groups || []).filter(g => (g.entity_key || "event") === "event");

  // Sync financeStatuses from loaded settings (once)
  useEffect(() => {
    if (!statusSettings || financeStatuses !== null) return;
    const financeGroup = (statusSettings.groups || []).find(g => g.key === "finance_visible");
    if (financeGroup) {
      setFinanceStatuses(financeGroup.statuses || []);
      setFinanceGroupId(financeGroup.id || null);
    } else {
      setFinanceStatuses(["booked_pending","booked","planning_in_progress","finalized","completed"]);
    }
  }, [statusSettings]);

  const filtered = records.filter(r => r.category === activeCategory).sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));

  const handleEditGroup = (group) => {
    setEditingGroup(group);
    setGroupStatuses(group.statuses || []);
  };

  const handleSaveFinanceStatuses = async () => {
    setSavingFinance(true);
    await base44.functions.invoke("saveStatusSettings", {
      action: "upsert_group",
      data: {
        id: financeGroupId || undefined,
        key: "finance_visible",
        label: "Finance Visible Statuses",
        description: "Events in these statuses appear in Finance reports (Payments list, Income by Month, A/R). Cancelled and Postponed are excluded by default.",
        statuses: financeStatuses,
        entity_key: "event",
        required: true,
      },
    });
    qc.invalidateQueries(["status-settings"]);
    setSavingFinance(false);
    toast.success("Finance status settings saved");
  };

  const handleSaveGroup = async () => {
    if (editingGroup.key === "official_booked" && groupStatuses.length === 0) {
      toast.error("official_booked group cannot be empty");
      return;
    }
    setSavingGroup(true);
    await base44.functions.invoke("saveStatusSettings", {
      action: "upsert_group",
      data: { ...editingGroup, statuses: groupStatuses, entity_key: "event" },
    });
    qc.invalidateQueries(["status-settings"]);
    setEditingGroup(null);
    setSavingGroup(false);
    toast.success("Group saved");
  };

  const handleSave = async (id, data) => {
    await base44.entities.LabelMap.update(id, data);
    qc.invalidateQueries(["label_map"]);
  };

  const handleToggle = async (id, is_active) => {
    await base44.entities.LabelMap.update(id, { is_active });
    qc.invalidateQueries(["label_map"]);
  };

  const handleReset = async () => {
    setResetting(true);
    setShowResetConfirm(false);
    try {
      const resetData = await AdminAPI.resetDemoData();
      if (!resetData.ok) throw new Error(resetData.error || "Reset failed");
      const del = resetData.deleted || {};
      const lm = resetData.labelMap || {};
      toast.success(
        `Deleted demo data: ${del.leads ?? 0} leads, ${del.events ?? 0} events, ` +
        `${del.tasks ?? 0} tasks, ${del.activities ?? 0} activities, ${del.payments ?? 0} payments. ` +
        `LabelMap: ${lm.finalCount} records${lm.insertedCount > 0 ? ` (+${lm.insertedCount} added)` : " (complete)"}.`
      );
      qc.invalidateQueries(["label_map"]);
    } catch (err) {
      toast.error(`Reset failed: ${err.message}`);
    }
    setResetting(false);
  };

  const handleSeed = async () => {
    setSeeding(true);
    setShowSeedConfirm(false);
    setSeedResult(null);
    try {
      const data = await AdminAPI.seedDemoData();
      if (!data.ok) throw new Error(data.error || "Seed failed");
      setSeedResult(data);
      toast.success(
        `Seeded: ${data.leadsCreated} leads, ${data.eventsCreated} events, ${data.linkedPairsCreated} linked pairs.` +
        (data.missingLeadForLinkedEmail?.length ? ` ⚠️ ${data.missingLeadForLinkedEmail.length} unmatched emails.` : "")
      );
    } catch (err) {
      toast.error(`Seed failed: ${err.message}`);
    }
    setSeeding(false);
  };

  const handleWipeAll = async () => {
    setWiping(true);
    setShowWipeConfirm(false);
    try {
      const data = await AdminAPI.wipeAllLeadsEvents();
      if (!data.ok) throw new Error(data.error || "Wipe failed");
      const del = data.deleted || {};
      toast.success(`Wiped ALL: ${del.leads ?? 0} leads, ${del.events ?? 0} events, ${del.activities ?? 0} activities, ${del.tasks ?? 0} tasks, ${del.payments ?? 0} payments deleted.`);
    } catch (err) {
      toast.error(`Wipe failed: ${err.message}`);
    }
    setWiping(false);
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

          {/* Event Status sub-tabs */}
          {activeCategory === "event_status" && (
            <div className="mb-4">
              <div className="flex gap-1 mb-3">
                <button
                  onClick={() => setEventStatusSubTab("statuses")}
                  className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${eventStatusSubTab === "statuses" ? "bg-violet-600 text-white border-violet-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                >
                  Statuses
                </button>
                <button
                  onClick={() => setEventStatusSubTab("groups")}
                  className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${eventStatusSubTab === "groups" ? "bg-violet-600 text-white border-violet-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                >
                  Groups {eventGroups.length > 0 && <span className="ml-1 opacity-70">({eventGroups.length})</span>}
                </button>
                <button
                  onClick={() => setEventStatusSubTab("finance")}
                  className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${eventStatusSubTab === "finance" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                >
                  Finance
                </button>
              </div>

              {/* DEBUG BANNER */}
              <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700 font-mono">
                🔍 eventGroups count: <strong>{eventGroups.length}</strong>
                {eventGroups.length > 0 && (
                  <span> — {eventGroups.map(g => g.key).join(", ")}</span>
                )}
                {isLoadingGroups && <span> (loading...)</span>}
              </div>

              {eventStatusSubTab === "groups" && (
                <div className="space-y-3">
                  {isLoadingGroups ? (
                    <div className="flex items-center gap-2 text-gray-400 py-4">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading groups...
                    </div>
                  ) : eventGroups.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">No groups found. Try refreshing — they are seeded automatically.</p>
                  ) : eventGroups.map(g => {
                    const isSystem = g.key === "official_booked";
                    const isEditing = editingGroup?.id === g.id;
                    return (
                      <div key={g.id} className={`rounded-lg border p-3 ${isSystem ? "bg-violet-50 border-violet-200" : "bg-gray-50 border-gray-200"}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">{g.label}</span>
                              {isSystem && <Badge className="text-[10px] bg-violet-100 text-violet-700 border-violet-300">System</Badge>}
                              {g.required && <Badge variant="secondary" className="text-[10px]">Required</Badge>}
                            </div>
                            <code className="text-[10px] text-gray-400 font-mono">{g.key}</code>
                            {g.description && <p className="text-xs text-gray-500 mt-0.5">{g.description}</p>}
                          </div>
                          {!isEditing && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEditGroup(g)}>
                              <Edit2 className="w-3.5 h-3.5 text-gray-400" />
                            </Button>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-gray-600">Select member statuses:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {allEventStatuses.map(s => {
                                const active = groupStatuses.includes(s.key);
                                return (
                                  <button
                                    key={s.key}
                                    onClick={() => setGroupStatuses(prev =>
                                      active ? prev.filter(k => k !== s.key) : [...prev, s.key]
                                    )}
                                    className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${active ? "bg-violet-600 text-white border-violet-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                                  >
                                    {s.label || s.key}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex gap-2 pt-1">
                              <Button size="sm" className="bg-violet-600 hover:bg-violet-700 gap-1 h-7 text-xs" onClick={handleSaveGroup} disabled={savingGroup}>
                                {savingGroup ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                Save
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingGroup(null)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {(g.statuses || []).length === 0
                              ? <span className="text-xs text-red-500">No statuses assigned</span>
                              : (g.statuses || []).map(key => {
                                  const s = allEventStatuses.find(x => x.key === key);
                                  return <Badge key={key} variant="outline" className="text-[10px]">{s?.label || key}</Badge>;
                                })
                            }
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Label rows — hidden when viewing groups sub-tab */}
          <div className="min-h-[200px]" style={{ display: activeCategory === "event_status" && eventStatusSubTab === "groups" ? "none" : undefined }}>
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

          {/* Add new — hide when on groups sub-tab */}
          {(activeCategory !== "event_status" || eventStatusSubTab !== "groups") && adding ? (
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
          ) : (activeCategory !== "event_status" || eventStatusSubTab !== "groups") ? (
            <Button size="sm" variant="outline" className="mt-3 gap-1" onClick={() => setAdding(true)}>
              <Plus className="w-3 h-3" /> Add Label
            </Button>
          ) : null}
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
        <CardContent className="space-y-4">

          {/* ── Reset Demo Data ── */}
          <div className="space-y-2">
            {!showResetConfirm ? (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Reset Demo Data</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Deletes demo-tagged test data (leads/events) plus all Activities/Tasks/Payments/AutomationLogs. Preserves LabelMap.
                  </p>
                </div>
                <Button variant="outline" size="sm" className="border-red-300 text-red-600 hover:bg-red-50 gap-1.5 flex-shrink-0"
                  onClick={() => setShowResetConfirm(true)} disabled={resetting || seeding || wiping}>
                  {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Reset Demo Data
                </Button>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                <p className="text-sm font-semibold text-red-700">⚠️ Confirm Reset</p>
                <p className="text-xs text-red-600">
                  Deletes all demo-tagged leads/events + all Activities, Tasks, Payments, AutomationLogs. <strong>Cannot be undone.</strong> LabelMap is safe.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-red-600 hover:bg-red-700 gap-1" onClick={handleReset} disabled={resetting}>
                    {resetting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    {resetting ? "Deleting..." : "Yes, Delete Demo Data"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowResetConfirm(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-red-100" />

          {/* ── Seed Demo Data ── */}
          <div className="space-y-2">
            {!showSeedConfirm ? (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Seed Demo Data</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Creates 250 demo leads + 250 demo events with ~150 bidirectional links. Tagged so Reset can delete them.
                  </p>
                </div>
                <Button variant="outline" size="sm" className="border-green-300 text-green-700 hover:bg-green-50 gap-1.5 flex-shrink-0"
                  onClick={() => setShowSeedConfirm(true)} disabled={resetting || seeding || wiping}>
                  {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sprout className="w-3.5 h-3.5" />}
                  Seed Demo Data
                </Button>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                <p className="text-sm font-semibold text-green-700">🌱 Confirm Seed</p>
                <p className="text-xs text-green-700">
                  This will create 250 leads + 250 events. Run Reset first if you want a clean slate.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1" onClick={handleSeed} disabled={seeding}>
                    {seeding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sprout className="w-3 h-3" />}
                    {seeding ? "Seeding... (takes ~30s)" : "Yes, Seed Demo Data"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowSeedConfirm(false)}>Cancel</Button>
                </div>
              </div>
            )}
            {seedResult && (
              <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-xs text-green-800 space-y-1 mt-1">
                <p className="font-semibold">Seed Results</p>
                <p>Leads created: <strong>{seedResult.leadsCreated}</strong></p>
                <p>Events created: <strong>{seedResult.eventsCreated}</strong></p>
                <p>Linked pairs: <strong>{seedResult.linkedPairsCreated}</strong> / {seedResult.intendedLinks} intended</p>
                {seedResult.missingLeadForLinkedEmail?.length > 0 && (
                  <p className="text-amber-700">⚠️ {seedResult.missingLeadForLinkedEmail.length} unmatched emails</p>
                )}
                {seedResult.mismatchedLinks?.length > 0 && (
                  <p className="text-red-700">⚠️ {seedResult.mismatchedLinks.length} mismatched links</p>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-red-100" />

          {/* ── Wipe ALL ── */}
          <div className="space-y-2">
            {!showWipeConfirm ? (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Wipe ALL Leads &amp; Events</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Permanently deletes <strong>every</strong> Lead and Event record (demo and real), plus all Activities/Tasks/Payments. Irreversible.
                  </p>
                </div>
                <Button variant="outline" size="sm" className="border-red-500 text-red-700 hover:bg-red-100 gap-1.5 flex-shrink-0"
                  onClick={() => setShowWipeConfirm(true)} disabled={resetting || seeding || wiping}>
                  {wiping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flame className="w-3.5 h-3.5" />}
                  Wipe ALL
                </Button>
              </div>
            ) : (
              <div className="bg-red-100 border border-red-400 rounded-lg p-4 space-y-3">
                <p className="text-sm font-bold text-red-800">☠️ NUCLEAR OPTION — Are you absolutely sure?</p>
                <p className="text-xs text-red-700">
                  This will permanently delete <strong>ALL</strong> leads and events — including any real data. There is no undo. Type "WIPE" to confirm.
                </p>
                <WipeConfirmInput onConfirm={handleWipeAll} onCancel={() => setShowWipeConfirm(false)} loading={wiping} />
              </div>
            )}
          </div>

        </CardContent>
      </Card>
    </div>
  );
}

function WipeConfirmInput({ onConfirm, onCancel, loading }) {
  const [val, setVal] = useState("");
  return (
    <div className="flex gap-2 items-center">
      <input
        className="border border-red-400 rounded px-2 py-1 text-xs font-mono w-24 bg-white"
        placeholder='type "WIPE"'
        value={val}
        onChange={e => setVal(e.target.value)}
      />
      <Button size="sm" className="bg-red-700 hover:bg-red-800 gap-1" onClick={onConfirm} disabled={val !== "WIPE" || loading}>
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Flame className="w-3 h-3" />}
        {loading ? "Wiping..." : "Wipe Everything"}
      </Button>
      <Button size="sm" variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
    </div>
  );
}