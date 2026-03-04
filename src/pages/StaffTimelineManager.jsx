/**
 * Staff Timeline Manager — /StaffTimelineManager?event_id=xxx
 * Header editor + activity grid with library sidebar
 */
import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Save, Trash2, ChevronUp, ChevronDown, Plus, Eye, Loader2 } from "lucide-react";

export default function StaffTimelineManager() {
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get("event_id");
  const timelineType = urlParams.get("type") || "PRIMARY";
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [header, setHeader] = useState({ title: "", subtitle: "" });
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["staff-timeline", eventId, timelineType],
    queryFn: async () => {
      const r = await base44.functions.invoke("getStaffTimeline", { event_id: eventId, timeline_type: timelineType });
      return r.data;
    },
    enabled: !!eventId,
  });

  useEffect(() => {
    if (data) {
      // handle both { timeline, activities } and { bundle: { timeline, activities } }
      const d = data.bundle ?? data;
      setHeader({ title: d.timeline?.header_title || "", subtitle: d.timeline?.header_subtitle || "" });
      setRows(d.activities || []);
      setDirty(false);
    }
  }, [data]);

  const updateRow = (idx, field, val) => {
    setRows(prev => { const n = [...prev]; n[idx] = { ...n[idx], [field]: val }; return n; });
    setDirty(true);
  };

  const addRow = (template = null) => {
    const newRow = template || { time_display: "", activity_name: "", comments: "" };
    setRows(prev => [...prev, newRow]);
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
    setSaving(true);
    await base44.functions.invoke("bulkUpsertStaffTimeline", {
      event_id: eventId, timeline_type: timelineType,
      header: { title: header.title, subtitle: header.subtitle },
      rows,
    });
    qc.invalidateQueries(["staff-timeline", eventId, timelineType]);
    setSaving(false);
    setDirty(false);
  };

  const handleClear = async () => {
    setRows([]);
    setHeader({ title: "", subtitle: "" });
    setDirty(true);
    setConfirmClear(false);
  };

  const loadTemplate = () => {
    if (!data?.template) return;
    setRows(data.template.map((t, i) => ({ ...t, sort_order: i })));
    setDirty(true);
  };

  if (!eventId) return <div className="p-8 text-center text-gray-400">No event_id provided.</div>;

  return (
    <div className="p-4 lg:p-8 max-w-[1200px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 text-gray-500">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Timeline Manager</h1>
            <p className="text-xs text-gray-400 mt-0.5">{timelineType} timeline · {rows.length} activities</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to={createPageUrl("StaffTimelineView") + `?event_id=${eventId}&type=${timelineType}`}>
            <Button variant="outline" size="sm" className="gap-1"><Eye className="w-3.5 h-3.5" /> Preview</Button>
          </Link>
          {data?.template && rows.length === 0 && (
            <Button variant="outline" size="sm" className="gap-1 text-indigo-600 border-indigo-200" onClick={loadTemplate}>
              Load Template
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1 text-red-500 border-red-200" onClick={() => setConfirmClear(true)}>
            <Trash2 className="w-3.5 h-3.5" /> Clear All
          </Button>
          <Button onClick={handleSave} disabled={saving || !dirty} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white gap-1">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </Button>
        </div>
      </div>

      {/* Header editor */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-gray-600">Header Title</Label>
          <Input value={header.title} onChange={e => { setHeader(h => ({ ...h, title: e.target.value })); setDirty(true); }}
            placeholder="e.g. Smith / Johnson Wedding Reception" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-gray-600">Header Subtitle</Label>
          <Input value={header.subtitle} onChange={e => { setHeader(h => ({ ...h, subtitle: e.target.value })); setDirty(true); }}
            placeholder="e.g. Saturday, June 14 · The Grand Ballroom" />
        </div>
      </div>

      {/* Activity table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-2">{Array.from({length:6}).map((_,i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase w-8" />
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase w-28">Time</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase">Activity</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase">Comments</th>
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
                  <td className="px-1 py-1">
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
            </tbody>
          </table>
        )}
        <div className="flex items-center justify-between p-3 border-t border-gray-100">
          <Button variant="outline" size="sm" onClick={() => addRow()} className="gap-1 text-xs">
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

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all activities?</AlertDialogTitle>
            <AlertDialogDescription>This will remove all rows from the timeline editor. You'll need to save to commit.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClear} className="bg-red-600 hover:bg-red-700 text-white">Clear All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}