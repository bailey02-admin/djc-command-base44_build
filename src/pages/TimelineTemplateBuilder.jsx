import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Save, Trash2, ChevronUp, ChevronDown, Plus, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";

const EVENT_TYPE_OPTIONS = ["wedding","corporate","school_dance","private_party","birthday","anniversary","mitzvah","quinceañera","holiday_party","other"];
const MANAGER_ROLES = new Set(["admin","city_manager","office_finalizer","sales_manager"]);

const emptyTemplate = {
  name: "", event_type: "wedding", timeline_type: "PRIMARY",
  header_title: "", header_subtitle: "", notes: "", is_active: true,
};

export default function TimelineTemplateBuilder() {
  const urlParams = new URLSearchParams(window.location.search);
  const templateId = urlParams.get("template_id");
  const isNew = urlParams.get("action") === "new" || !templateId;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [template, setTemplate] = useState(emptyTemplate);
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { isLoading, data: detailData } = useQuery({
    queryKey: ["timeline-template-detail", templateId],
    queryFn: async () => {
      const r = await base44.functions.invoke("getTimelineTemplateDetail", { template_id: templateId });
      return r.data;
    },
    enabled: !isNew && !!templateId,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (detailData?.template) setTemplate(detailData.template);
    if (detailData?.items) setRows(detailData.items);
  }, [detailData]);

  const isManager = MANAGER_ROLES.has(currentUser?.role);

  const setField = (field, val) => {
    setTemplate(prev => ({ ...prev, [field]: val }));
    setDirty(true);
  };

  const updateRow = (idx, field, val) => {
    setRows(prev => { const n = [...prev]; n[idx] = { ...n[idx], [field]: val }; return n; });
    setDirty(true);
  };

  const addRow = () => {
    setRows(prev => [...prev, { time_display: "", activity_name: "", comments: "" }]);
    setDirty(true);
  };

  const deleteRow = (idx) => {
    setRows(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const moveRow = (idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= rows.length) return;
    setRows(prev => {
      const n = [...prev]; [n[idx], n[newIdx]] = [n[newIdx], n[idx]]; return n;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!template.name?.trim()) { toast.error("Template name is required"); return; }
    if (!template.event_type) { toast.error("Event type is required"); return; }
    setSaving(true);
    try {
      const action = isNew ? "create" : "update";
      const payload = { ...template };
      if (isNew) delete payload.id;
      const r = await base44.functions.invoke("saveTimelineTemplate", {
        action,
        template: payload,
        items: rows,
      });
      qc.invalidateQueries(["timeline-templates"]);
      qc.invalidateQueries(["timeline-template-detail", templateId]);
      toast.success(isNew ? "Template created!" : "Template saved!");
      setDirty(false);
      if (isNew && r.data?.template?.id) {
        navigate(createPageUrl("TimelineTemplateBuilder") + `?template_id=${r.data.template.id}`);
      }
    } catch (e) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsDuplicate = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke("saveTimelineTemplate", {
        action: "create",
        template: { ...template, id: undefined, name: `${template.name} (Copy)` },
        items: rows,
      });
      qc.invalidateQueries(["timeline-templates"]);
      toast.success("Saved as new template!");
      navigate(createPageUrl("TimelineTemplates"));
    } catch (e) {
      toast.error(e.message || "Duplicate failed");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (dirty) { setConfirmLeave(true); return; }
    navigate(createPageUrl("TimelineTemplates"));
  };

  if (!isManager && currentUser) {
    return <div className="p-8 text-center text-gray-400">You don't have permission to access this page.</div>;
  }

  return (
    <div className="p-4 lg:p-8 max-w-[1100px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1 text-gray-500">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{isNew ? "New Template" : "Edit Template"}</h1>
            <p className="text-xs text-gray-400 mt-0.5">{rows.length} activities</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!isNew && (
            <Button variant="outline" size="sm" className="gap-1" onClick={handleSaveAsDuplicate} disabled={saving}>
              <Copy className="w-3.5 h-3.5" /> Save as Duplicate
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || !dirty} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white gap-1">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </Button>
        </div>
      </div>

      {isLoading && !isNew ? (
        <div className="space-y-3">{Array.from({length:6}).map((_,i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : (
        <>
          {/* Template meta */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <Label className="text-xs font-semibold text-gray-600">Template Name *</Label>
              <Input value={template.name || ""} onChange={e => setField("name", e.target.value)} placeholder="e.g. Standard Wedding Reception" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">Event Type *</Label>
              <Select value={template.event_type} onValueChange={v => setField("event_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPE_OPTIONS.map(t => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">Timeline Type *</Label>
              <Select value={template.timeline_type} onValueChange={v => setField("timeline_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIMARY">Primary</SelectItem>
                  <SelectItem value="SECONDARY">Secondary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">Header Title</Label>
              <Input value={template.header_title || ""} onChange={e => setField("header_title", e.target.value)} placeholder="e.g. Wedding Reception" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">Header Subtitle</Label>
              <Input value={template.header_subtitle || ""} onChange={e => setField("header_subtitle", e.target.value)} placeholder="e.g. Saturday Evening" />
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <Label className="text-xs font-semibold text-gray-600">Notes</Label>
              <Input value={template.notes || ""} onChange={e => setField("notes", e.target.value)} placeholder="Internal notes…" />
            </div>
          </div>

          {/* Activity grid */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase w-8" />
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase w-28">Time</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase">Activity</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase hidden md:table-cell">Comments</th>
                  <th className="px-3 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/40">
                    <td className="px-2 py-1">
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveRow(idx, -1)} disabled={idx === 0} className="text-gray-300 hover:text-gray-500 disabled:opacity-20">
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button onClick={() => moveRow(idx, 1)} disabled={idx === rows.length - 1} className="text-gray-300 hover:text-gray-500 disabled:opacity-20">
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-1 py-1">
                      <Input value={row.time_display || ""} onChange={e => updateRow(idx, "time_display", e.target.value)}
                        className="h-7 text-xs border-0 bg-transparent focus-visible:ring-1" placeholder="5:00 PM" />
                    </td>
                    <td className="px-1 py-1">
                      <Input value={row.activity_name || ""} onChange={e => updateRow(idx, "activity_name", e.target.value)}
                        className="h-7 text-xs border-0 bg-transparent focus-visible:ring-1" placeholder="Activity name…" />
                    </td>
                    <td className="px-1 py-1 hidden md:table-cell">
                      <Input value={row.comments || ""} onChange={e => updateRow(idx, "comments", e.target.value)}
                        className="h-7 text-xs border-0 bg-transparent focus-visible:ring-1" placeholder="Notes…" />
                    </td>
                    <td className="px-2">
                      <button onClick={() => deleteRow(idx)} className="text-gray-300 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">No activities yet. Add a row below.</td></tr>
                )}
              </tbody>
            </table>
            <div className="flex items-center justify-between p-3 border-t border-gray-100">
              <Button variant="outline" size="sm" onClick={addRow} className="gap-1 text-xs">
                <Plus className="w-3.5 h-3.5" /> Add Row
              </Button>
              {dirty && (
                <Button onClick={handleSave} disabled={saving} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white gap-1 text-xs">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Changes
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved changes. Leave without saving?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate(createPageUrl("TimelineTemplates"))} className="bg-red-600 hover:bg-red-700 text-white">
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}