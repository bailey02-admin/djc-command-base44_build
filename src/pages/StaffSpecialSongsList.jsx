/**
 * Staff Special Songs Edit List — /StaffSpecialSongsList?event_id=xxx
 * Inline grid for all special song types
 */
import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Save, ChevronUp, ChevronDown, Loader2 } from "lucide-react";

const ACQUISITION_OPTIONS = [
  { value: "UNKNOWN",          label: "Unknown",          color: "bg-gray-100 text-gray-600" },
  { value: "HAVE_IN_LIBRARY",  label: "Have in Library",  color: "bg-emerald-100 text-emerald-700" },
  { value: "NEED_TO_ACQUIRE",  label: "Need to Acquire",  color: "bg-amber-100 text-amber-700" },
];

const TYPE_LABELS = {
  processional:   "Processional",
  bridal_entrance:"Bridal Entrance",
  recessional:    "Recessional",
  first_dance:    "First Dance",
  parent_dances:  "Parent Dances",
  cake_cutting:   "Cake Cutting",
  bouquet_toss:   "Bouquet Toss",
  garter_toss:    "Garter Toss",
  last_dance:     "Last Dance",
  other:          "Other",
};

export default function StaffSpecialSongsList() {
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get("event_id");
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["special-songs-full", eventId],
    queryFn: async () => {
      const r = await base44.functions.invoke("getSpecialSongs", { event_id: eventId, include_all_types: true });
      return r.data;
    },
    enabled: !!eventId,
  });

  useEffect(() => {
    if (data?.rows) { setRows(data.rows); setDirty(false); }
  }, [data]);

  const update = (idx, field, val) => {
    setRows(prev => { const n = [...prev]; n[idx] = { ...n[idx], [field]: val }; return n; });
    setDirty(true);
  };

  const moveRow = (idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= rows.length) return;
    setRows(prev => {
      const n = [...prev];
      [n[idx], n[newIdx]] = [n[newIdx], n[idx]];
      return n;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await base44.functions.invoke("bulkUpsertSpecialSongs", { event_id: eventId, rows });
    qc.invalidateQueries(["special-songs-full", eventId]);
    qc.invalidateQueries(["special-songs", eventId]);
    setSaving(false);
    setDirty(false);
  };

  if (!eventId) return <div className="p-8 text-center text-gray-400">No event_id provided.</div>;

  return (
    <div className="p-4 lg:p-8 max-w-[1200px] mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 text-gray-500">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <h1 className="text-xl font-bold text-gray-900">Special Songs</h1>
        </div>
        <Button onClick={handleSave} disabled={saving || !dirty} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white gap-1">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save All
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-2">{Array.from({length:10}).map((_,i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase w-8" />
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase w-36">Type</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase">Song</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase">Artist</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase w-28">Location</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase">Comments</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase w-36">Status</th>
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
                  <td className="px-3 py-1.5">
                    <span className="text-xs font-medium text-gray-600">{TYPE_LABELS[row.special_song_type] || row.special_song_type}</span>
                  </td>
                  <td className="px-1 py-1">
                    <Input value={row.song || ""} onChange={e => update(idx, "song", e.target.value)}
                      className="h-7 text-xs border-0 bg-transparent focus-visible:ring-1" placeholder="Song title…" />
                  </td>
                  <td className="px-1 py-1">
                    <Input value={row.artist || ""} onChange={e => update(idx, "artist", e.target.value)}
                      className="h-7 text-xs border-0 bg-transparent focus-visible:ring-1" placeholder="Artist…" />
                  </td>
                  <td className="px-1 py-1">
                    <Input value={row.location || ""} onChange={e => update(idx, "location", e.target.value)}
                      className="h-7 text-xs border-0 bg-transparent focus-visible:ring-1" placeholder="Location…" />
                  </td>
                  <td className="px-1 py-1">
                    <Input value={row.comments || ""} onChange={e => update(idx, "comments", e.target.value)}
                      className="h-7 text-xs border-0 bg-transparent focus-visible:ring-1" placeholder="Comments…" />
                  </td>
                  <td className="px-2 py-1">
                    <Select value={row.acquisition_status || "UNKNOWN"} onValueChange={v => update(idx, "acquisition_status", v)}>
                      <SelectTrigger className="h-7 text-xs border-gray-200 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACQUISITION_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${o.color}`}>{o.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {dirty && (
          <div className="flex justify-end p-3 border-t border-gray-100">
            <Button onClick={handleSave} disabled={saving} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white gap-1">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Changes
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}