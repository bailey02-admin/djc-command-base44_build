import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Lock, CheckCircle2, Circle, Music, Loader2, AlertTriangle, Trash2 } from "lucide-react";

const SPECIAL_FORMALITIES = [
  { key: "grand_entrance",   label: "Grand Entrance",   required: true },
  { key: "first_dance",      label: "First Dance",      required: true },
  { key: "father_daughter",  label: "Father / Daughter Dance", required: true },
  { key: "mother_son",       label: "Mother / Son Dance", required: true },
  { key: "cake_cutting",     label: "Cake Cutting",     required: true },
  { key: "last_dance",       label: "Last Dance",       required: true },
];

export default function PortalSpecialSongs({ bundle, eventId }) {
  const { event, musicSelections: initialSongs = [], planning: initialPlanning } = bundle;
  const queryClient = useQueryClient();

  const isLocked = event.planning_lock_at && new Date() >= new Date(event.planning_lock_at);

  // Songs for special categories
  const [songs, setSongs] = useState(
    initialSongs.filter(s => SPECIAL_FORMALITIES.map(f => f.key).includes(s.category))
  );

  // skip flags stored in EventPlanning: skip_special_<key>
  const [skipFlags, setSkipFlags] = useState(() => {
    const flags = {};
    for (const f of SPECIAL_FORMALITIES) {
      flags[f.key] = initialPlanning?.["skip_special_" + f.key] === true;
    }
    return flags;
  });

  const [editing, setEditing] = useState(null); // formality key being edited
  const [newSong, setNewSong] = useState({ song_title: "", artist: "" });
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState(null);

  const invoke = async (action, data) => {
    const res = await base44.functions.invoke("clientPortalSave", { action, event_id: eventId, data });
    queryClient.invalidateQueries({ queryKey: ["portal-event", eventId] });
    return res.data;
  };

  const handleAddSong = async (formalityKey) => {
    if (!newSong.song_title.trim()) { setError("Song title is required"); return; }
    setSaving(formalityKey); setError(null);
    try {
      const res = await invoke("add_song", { ...newSong, category: formalityKey });
      setSongs(prev => [...prev.filter(s => s.category !== formalityKey), res.song]);
      setNewSong({ song_title: "", artist: "" });
      setEditing(null);
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to save");
    } finally { setSaving(null); }
  };

  const handleDeleteSong = async (song) => {
    setSaving(song.category); setError(null);
    try {
      await invoke("delete_song", { music_id: song.id });
      setSongs(prev => prev.filter(s => s.id !== song.id));
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to remove");
    } finally { setSaving(null); }
  };

  const handleToggleSkip = async (formalityKey, skip) => {
    setSkipFlags(prev => ({ ...prev, [formalityKey]: skip }));
    try {
      await invoke("save_planning", { ["skip_special_" + formalityKey]: skip });
    } catch (e) {
      setSkipFlags(prev => ({ ...prev, [formalityKey]: !skip }));
      setError("Failed to save skip preference");
    }
  };

  return (
    <div className="space-y-5">
      <h2 className="font-bold text-gray-900 text-lg">Special Songs</h2>

      {isLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start">
          <Lock className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800">Special songs are locked. Contact your coordinator to make changes.</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 items-center text-xs text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
          <button className="ml-auto underline" onClick={() => setError(null)}>dismiss</button>
        </div>
      )}

      <div className="space-y-3">
        {SPECIAL_FORMALITIES.map(formality => {
          const song = songs.find(s => s.category === formality.key);
          const skipped = skipFlags[formality.key];
          const isResolved = !!song || skipped;
          const isSavingThis = saving === formality.key;

          return (
            <Card key={formality.key} className={`border shadow-sm ${isResolved ? "border-emerald-100 bg-emerald-50/30" : "border-gray-100"}`}>
              <CardContent className="pt-4 pb-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {isResolved
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      : <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    }
                    <span className="text-sm font-semibold text-gray-800">{formality.label}</span>
                    {formality.required && !isResolved && (
                      <Badge className="text-[9px] bg-amber-50 text-amber-700 border-0">Required</Badge>
                    )}
                  </div>
                  {isSavingThis && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                </div>

                {/* Selected song display */}
                {song && !skipped && (
                  <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-100">
                    <Music className="w-4 h-4 text-violet-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{song.song_title}</p>
                      {song.artist && <p className="text-xs text-gray-500">{song.artist}</p>}
                    </div>
                    {!isLocked && (
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-gray-300 hover:text-red-500" onClick={() => handleDeleteSong(song)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                )}

                {/* Skip toggle */}
                {!isLocked && !song && (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={skipped}
                      onCheckedChange={v => handleToggleSkip(formality.key, v)}
                      id={`skip-${formality.key}`}
                    />
                    <Label htmlFor={`skip-${formality.key}`} className="text-xs text-gray-500 cursor-pointer">
                      We don't need this for our event
                    </Label>
                  </div>
                )}

                {/* Add song form */}
                {!isLocked && !song && !skipped && (
                  <>
                    {editing === formality.key ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            value={newSong.song_title}
                            onChange={e => setNewSong(p => ({ ...p, song_title: e.target.value }))}
                            placeholder="Song title *"
                            className="flex-1 text-sm h-8"
                          />
                          <Input
                            value={newSong.artist}
                            onChange={e => setNewSong(p => ({ ...p, artist: e.target.value }))}
                            placeholder="Artist"
                            className="flex-1 text-sm h-8"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleAddSong(formality.key)} disabled={isSavingThis} className="flex-1 bg-violet-600 hover:bg-violet-700 h-8 text-xs gap-1">
                            {isSavingThis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Save
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setEditing(null); setNewSong({ song_title: "", artist: "" }); }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5 w-full"
                        onClick={() => { setEditing(formality.key); setNewSong({ song_title: "", artist: "" }); }}>
                        <Music className="w-3.5 h-3.5" /> Choose Song
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}