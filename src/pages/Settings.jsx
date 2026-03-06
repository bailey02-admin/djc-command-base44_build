import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Loader2, Plus, RefreshCw, ShieldCheck, LayoutList, Package, Sparkles, Wrench, CheckCircle2, AlertCircle, SkipForward } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { PIPELINE_STAGES, AUTOMATION_TEMPLATES, READINESS_ITEMS } from "../components/crm/pipeline";
import LabelsTab from "../components/settings/LabelsTab";
import RbacDebugPanel from "@/components/settings/RbacDebugPanel";

const DEFAULT_SETTINGS = [
  { key: "sla_warning_minutes", value: "15", category: "sla", label: "SLA Warning Threshold (minutes)", description: "Show warning badge after this many minutes without response" },
  { key: "sla_missed_minutes", value: "60", category: "sla", label: "SLA Missed Threshold (minutes)", description: "Mark SLA as missed after this many minutes without response" },
  { key: "default_cities", value: "Dallas,Austin,Houston,San Antonio", category: "cities", label: "Service Cities", description: "Comma-separated list of cities you serve" },
  { key: "company_name", value: "DJ Command", category: "general", label: "Company Name", description: "Your DJ company name" },
  { key: "default_sla_action", value: "notify_manager", category: "sla", label: "SLA Breach Action", description: "What to do when SLA is missed: notify_manager, create_task" },
];

export default function Settings() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(null);

  const { data: settings = [] } = useQuery({
    queryKey: ["settings"],
    queryFn: () => base44.entities.Settings.list("key", 100),
  });

  const getSettingValue = (key) => {
    const found = settings.find(s => s.key === key);
    return found ? found.value : DEFAULT_SETTINGS.find(d => d.key === key)?.value || "";
  };

  const [localValues, setLocalValues] = useState({});

  const getValue = (key) => localValues[key] !== undefined ? localValues[key] : getSettingValue(key);

  const saveSetting = async (key, category) => {
    setSaving(key);
    const value = getValue(key);
    const existing = settings.find(s => s.key === key);
    const def = DEFAULT_SETTINGS.find(d => d.key === key);
    if (existing) {
      await base44.entities.Settings.update(existing.id, { value });
    } else {
      await base44.entities.Settings.create({ key, value, category, label: def?.label || key, description: def?.description || "" });
    }
    setSaving(null);
    queryClient.invalidateQueries(["settings"]);
    setLocalValues(p => { const n = {...p}; delete n[key]; return n; });
  };

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure CRM behavior, SLA, pipeline, and automations</p>
      </div>

      <Tabs defaultValue="sla">
        <TabsList className="bg-white border flex-wrap h-auto">
          <TabsTrigger value="sla">SLA</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="automations">Automations</TabsTrigger>
          <TabsTrigger value="readiness">Readiness</TabsTrigger>
          <TabsTrigger value="labels">Labels &amp; Statuses</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="rbac">RBAC Debug</TabsTrigger>
          <TabsTrigger value="timeline-templates">Timeline Templates</TabsTrigger>
          <TabsTrigger value="packages">Packages</TabsTrigger>
          <TabsTrigger value="addons">Add-Ons</TabsTrigger>
        </TabsList>

        {/* SLA Settings */}
        <TabsContent value="sla" className="mt-6 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">SLA Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {DEFAULT_SETTINGS.filter(s => s.category === "sla").map(setting => (
                <div key={setting.key} className="flex items-end gap-3">
                  <div className="flex-1">
                    <Label className="text-xs">{setting.label}</Label>
                    <p className="text-[10px] text-gray-400 mt-0.5">{setting.description}</p>
                    <Input
                      className="mt-1"
                      value={getValue(setting.key)}
                      onChange={e => setLocalValues(p => ({...p, [setting.key]: e.target.value}))}
                    />
                  </div>
                  <Button size="sm" onClick={() => saveSetting(setting.key, "sla")} disabled={saving === setting.key} className="mb-0.5 bg-violet-600 hover:bg-violet-700">
                    {saving === setting.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pipeline Stages Reference */}
        <TabsContent value="pipeline" className="mt-6 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Pipeline Stage Definitions</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {PIPELINE_STAGES.map((stage, i) => (
                  <div key={stage.key} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50/50">
                    <div className={`w-3 h-3 rounded-full ${stage.dot} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{i + 1}. {stage.label}</span>
                        <Badge variant="secondary" className={`text-[10px] ${stage.color}`}>{stage.key}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {stage.required_fields.length > 0 ? (
                          stage.required_fields.map(f => (
                            <Badge key={f} variant="outline" className="text-[10px]">{f.replace(/_/g, " ")}</Badge>
                          ))
                        ) : <span className="text-[10px] text-gray-400">No required fields</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Automation Templates */}
        <TabsContent value="automations" className="mt-6 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Automation Templates</CardTitle>
              <p className="text-xs text-gray-400 mt-1">These task templates fire automatically on key triggers.</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(AUTOMATION_TEMPLATES).map(([trigger, tasks]) => (
                  <div key={trigger} className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-violet-700 uppercase tracking-wider">{trigger.replace(/_/g, " ")}</span>
                      <Badge variant="secondary" className="text-[10px]">{tasks.length} tasks</Badge>
                    </div>
                    <div className="space-y-1.5">
                      {tasks.map((t, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            t.priority === "urgent" ? "bg-red-400" :
                            t.priority === "high" ? "bg-amber-400" : "bg-blue-400"
                          }`} />
                          {t.title}
                          <span className="text-gray-400 ml-auto">{t.offset_hours === 0 ? "immediate" : `+${t.offset_hours}h`}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Readiness scoring */}
        <TabsContent value="readiness" className="mt-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Event Readiness Scoring</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {READINESS_ITEMS.map(item => (
                  <div key={item.key} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                    <span className="text-gray-700">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{item.weight} pts</Badge>
                      <span className="text-[10px] font-mono text-gray-400">{item.key}</span>
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t flex justify-between text-sm font-semibold">
                  <span>Total Possible Score</span>
                  <span>{READINESS_ITEMS.reduce((s, i) => s + i.weight, 0)} pts</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Labels & Statuses */}
        <TabsContent value="labels" className="mt-6">
          <LabelsTab />
        </TabsContent>

        {/* RBAC Debug */}
        <TabsContent value="rbac" className="mt-6">
          <RbacDebugPanel />
        </TabsContent>

        {/* Timeline Templates */}
        <TabsContent value="timeline-templates" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Timeline Templates</h2>
              <p className="text-xs text-gray-400 mt-0.5">Create and manage reusable timeline structures by event type</p>
            </div>
            <Link to={createPageUrl("TimelineTemplates")}>
              <button className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-medium">
                <LayoutList className="w-3.5 h-3.5" /> Manage Templates →
              </button>
            </Link>
          </div>
          <div className="bg-gray-50 rounded-lg p-6 text-center text-sm text-gray-500">
            <LayoutList className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>Use the Templates page to create, edit, and organize timeline templates.</p>
            <Link to={createPageUrl("TimelineTemplates")}>
              <button className="mt-3 text-xs text-violet-600 hover:underline">Open Timeline Templates →</button>
            </Link>
          </div>
        </TabsContent>

        {/* Packages */}
        <TabsContent value="packages" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Packages Catalog</h2>
              <p className="text-xs text-gray-400 mt-0.5">Manage DJ packages used in quotes</p>
            </div>
            <Link to={createPageUrl("PackagesSettings")}>
              <button className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-medium">
                <Package className="w-3.5 h-3.5" /> Manage Packages →
              </button>
            </Link>
          </div>
          <div className="bg-gray-50 rounded-lg p-6 text-center text-sm text-gray-500">
            <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>Create and manage packages that can be applied to lead quotes.</p>
            <Link to={createPageUrl("PackagesSettings")}>
              <button className="mt-3 text-xs text-violet-600 hover:underline">Open Packages Catalog →</button>
            </Link>
          </div>
        </TabsContent>

        {/* Add-Ons */}
        <TabsContent value="addons" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Add-Ons Catalog</h2>
              <p className="text-xs text-gray-400 mt-0.5">Manage upgrades and extras for quotes</p>
            </div>
            <Link to={createPageUrl("AddOnsSettings")}>
              <button className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-medium">
                <Sparkles className="w-3.5 h-3.5" /> Manage Add-Ons →
              </button>
            </Link>
          </div>
          <div className="bg-gray-50 rounded-lg p-6 text-center text-sm text-gray-500">
            <Sparkles className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>Define add-ons like uplighting, photo booths, and extras with pricing.</p>
            <Link to={createPageUrl("AddOnsSettings")}>
              <button className="mt-3 text-xs text-violet-600 hover:underline">Open Add-Ons Catalog →</button>
            </Link>
          </div>
        </TabsContent>

        {/* General */}
        <TabsContent value="general" className="mt-6 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">General Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {DEFAULT_SETTINGS.filter(s => s.category === "general" || s.category === "cities").map(setting => (
                <div key={setting.key} className="flex items-end gap-3">
                  <div className="flex-1">
                    <Label className="text-xs">{setting.label}</Label>
                    <p className="text-[10px] text-gray-400 mt-0.5">{setting.description}</p>
                    <Input
                      className="mt-1"
                      value={getValue(setting.key)}
                      onChange={e => setLocalValues(p => ({...p, [setting.key]: e.target.value}))}
                    />
                  </div>
                  <Button size="sm" onClick={() => saveSetting(setting.key, setting.category)} disabled={saving === setting.key} className="mb-0.5 bg-violet-600 hover:bg-violet-700">
                    {saving === setting.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Permission Matrix */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Role Permission Matrix</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-semibold text-gray-500">Role</th>
                    <th className="text-center py-2 px-2 font-semibold text-gray-500">Leads</th>
                    <th className="text-center py-2 px-2 font-semibold text-gray-500">Events</th>
                    <th className="text-center py-2 px-2 font-semibold text-gray-500">Payments</th>
                    <th className="text-center py-2 px-2 font-semibold text-gray-500">Reports</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { role: "admin", leads: "CRUD", events: "CRUD", payments: "CRUD", reports: "✓" },
                    { role: "city_manager", leads: "CRU", events: "CRU", payments: "CRU", reports: "✓" },
                    { role: "sales_manager", leads: "CRU", events: "CRU", payments: "CRU", reports: "✓" },
                    { role: "sales_rep", leads: "CRU", events: "R", payments: "—", reports: "—" },
                    { role: "office_finalizer", leads: "R", events: "RU", payments: "—", reports: "—" },
                    { role: "finance", leads: "R", events: "R", payments: "CRU", reports: "✓" },
                    { role: "dj", leads: "—", events: "R", payments: "—", reports: "—" },
                    { role: "client", leads: "—", events: "—", payments: "—", reports: "—" },
                  ].map(row => (
                    <tr key={row.role} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium capitalize">{row.role.replace(/_/g, " ")}</td>
                      <td className="text-center py-2 px-2">{row.leads}</td>
                      <td className="text-center py-2 px-2">{row.events}</td>
                      <td className="text-center py-2 px-2">{row.payments}</td>
                      <td className="text-center py-2 px-2">{row.reports}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}