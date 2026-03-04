/**
 * Staff Music Manager — /StaffMusicManager?event_id=xxx
 * 99-row song request table + special songs overview
 */
import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Save, Music2, AlertTriangle, Loader2, RefreshCw } from "lucide-react";

const CLASSIFICATION_OPTIONS = [
  { value: "MUST_PLAY",        label: "Must Play",         color: "bg-emerald-100 text-emerald-700" },
  { value: "PLAY_IF_POSSIBLE", label: "Play If Possible",  color: "bg-blue-100 text-blue-700" },
  { value: "DO_NOT_PLAY",      label: "Do Not Play",       color: "bg-red-100 text-red-700" },
  { value: "REQUEST",          label: "Request",           color: "bg-gray-100 text-gray-700" },
];

const TARGET_ROWS = 99;

function buildBlankRows(existing) {
  const blanks = Array.from({ length: Math.max(0, TARGET_ROWS - existing.length) }, (_, i) => ({
    id: null, sort_order: existing.length + i, classification: "PLAY_IF_POSSIBLE",
    song: "", artist: "", location: "", comments: "",
  }));
  return [...existing, ...blanks];
}

export default function StaffMusicManager() {
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get("event_id");
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [dirty, setDirty] = useState(false);

  const { data: requestData, isLoading: loadingRequests } = useQuery({
    queryKey: ["song-requests", eventId],
    queryFn: async () => {
      const r = await base44.functions.invoke("getSongRequests", { event_id: eventId, target_rows: TARGET_ROWS });
      return r.data;
    },
    enabled: !!eventId,
  });

  const { data: specialData, isLoading: loadingSpecial } = useQuery({
    queryKey: ["special-songs", eventId],
    queryFn: async () => {
      const r = await base44.functions.invoke("getSpecialSongs", { event_id: eventId, include_all_types: false });
      return r.data;
    },
    enabled: !!eventId,
  });

  useEffect(() => {
    // Normalize: server returns { rows } directly
    const rawRows = requestData?.rows ?? (Array.isArray(requestData) ? requestData : null);
    if (rawRows) {
      setRows(buildBlankRows(rawRows));
      setDirty(false);
    }
  }, [requestData]);

  const updateRow = (idx, field, val) => {
    setRows(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setWarnings([]);
    const r = await base44.functions.invoke("bulkUpsertSongRequests", { event_id: eventId, rows });
    if (r.data?.warnings?.length) setWarnings(r.data.warnings);
    qc.invalidateQueries(["song-requests", eventId]);
    setSaving(false);
    setDirty(false);
  };

  const filledRows = useMemo(() => rows.filter(r => r.song?.trim()), [rows]);

  if (!eventId) return <div className="p-8 text-center text-gray-400">No event_id provided.</div>;

  return (
    <div className="p-4 lg:p-8 max-w-[1400px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 text-gray-500">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Music Manager</h1>
            <p className="text-xs text-gray-400 mt-0.5">{filledRows.length} songs entered</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to={createPageUrl("StaffSpecialSongsList") + `?event_id=${eventId}`}>
            <Button variant="outline" size="sm" className="gap-1 text-purple-700 border-purple-200">
              <Music2 className="w-3.5 h-3.5" /> Edit Special Songs
            </Button>
          </Link>
          <Button onClick={handleSave} disabled={saving || !dirty} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white gap-1">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Requests
          </Button>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
          <div className="flex items-center gap-2 text-amber-700 text-sm font-medium">
            <AlertTriangle className="w-4 h-4" /> Duplicate warnings
          </div>
          {warnings.map((w, i) => <p key={i} className="text-xs text-amber-600 ml-6">{w}</p>)}
        </div>
      )}

      {/* Special songs overview */}
      {!loadingSpecial && specialData?.rows?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Special Songs ({specialData.rows.length})</h2>
            <Link to={createPageUrl("StaffSpecialSongsList") + `?event_id=${eventId}`}>
              <Button size="sm" variant="ghost" className="text-xs text-violet-600">View/Edit →</Button>
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {specialData.rows.slice(0, 6).map(s => (
              <div key={s.id || s.special_song_type} className="text-xs bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                <div className="font-medium text-gray-600 capitalize">{s.special_song_type?.replace(/_/g," ")}</div>
                <div className="text-gray-900 mt-0.5 truncate">{s.song || <span className="text-gray-300 italic">not set</span>}</div>
                {s.artist && <div className="text-gray-400 truncate">{s.artist}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loadingRequests ? (
            <div className="p-6 space-y-2">{Array.from({length:8}).map((_,i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase w-10">#</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase w-36">Classification</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase">Song</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase">Artist</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase w-28">Location</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase">Comments</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const isFilled = !!row.song?.trim();
                  return (
                    <tr key={idx} className={`border-b border-gray-50 ${isFilled ? "bg-white" : "bg-gray-50/50"}`}>
                      <td className="px-3 py-1.5 text-xs text-gray-300 text-center">{idx + 1}</td>
                      <td className="px-3 py-1.5">
                        <Select value={row.classification} onValueChange={v => updateRow(idx, "classification", v)}>
                          <SelectTrigger className="h-7 text-xs border-0 bg-transparent focus:ring-0 p-0 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CLASSIFICATION_OPTIONS.map(o => (
                              <SelectItem key={o.value} value={o.value}>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${o.color}`}>{o.label}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-1 py-1">
                        <Input value={row.song} onChange={e => updateRow(idx, "song", e.target.value)}
                          className="h-7 text-xs border-0 bg-transparent focus-visible:ring-1" placeholder="Song title…" />
                      </td>
                      <td className="px-1 py-1">
                        <Input value={row.artist} onChange={e => updateRow(idx, "artist", e.target.value)}
                          className="h-7 text-xs border-0 bg-transparent focus-visible:ring-1" placeholder="Artist…" />
                      </td>
                      <td className="px-1 py-1">
                        <Input value={row.location} onChange={e => updateRow(idx, "location", e.target.value)}
                          className="h-7 text-xs border-0 bg-transparent focus-visible:ring-1" placeholder="Location…" />
                      </td>
                      <td className="px-1 py-1">
                        <Input value={row.comments} onChange={e => updateRow(idx, "comments", e.target.value)}
                          className="h-7 text-xs border-0 bg-transparent focus-visible:ring-1" placeholder="Notes…" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
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