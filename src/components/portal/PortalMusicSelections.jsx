import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, Plus, Trash2, Music, AlertTriangle, Loader2 } from "lucide-react";

const MUSIC_CATEGORIES = [
  { value: "must_play", label: "Must Play", color: "bg-emerald-50 text-emerald-700", limit: 20 },
  { value: "do_not_play", label: "Do Not Play", color: "bg-red-50 text-red-700", limit: 20 },
  { value: "dedication", label: "Dedication", color: "bg-pink-50 text-pink-700", limit: 10 },
  { value: "dinner", label: "Dinner", color: "bg-amber-50 text-amber-700", limit: 30 },
  { value: "cocktail_hour", label: "Cocktail Hour", color: "bg-blue-50 text-blue-700", limit: 30 },
  { value: "open_dance", label: "Open Dance", color: "bg-violet-50 text-violet-700", limit: 50 },
];
const TOTAL_LIMIT = 80;

export default function PortalMusicSelections({ bundle, eventId }) {
  const { event, musicSelections: initialSongs = [] } = bundle;
  const queryClient = useQueryClient();

  const isLocked = event.planning_lock_at && new Date() >= new Date(event.planning_lock_at);

  const [songs, setSongs] = useState(initialSongs.filter(s =>
    MUSIC_CATEGORIES.map(c => c.value).includes(s.category)
  ));
  const [newSong, setNewSong] = useState({ song_title: "", artist: "", category: "must_play", notes: "" });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState("must_play");

  const invoke = async (action, data) => {
    const res = await base44.functions.invoke("clientPortalSave", { action, event_id: eventId, data });
    queryClient.invalidateQueries({ queryKey: ["portal-event", eventId] });
    return res.data;
  };

  const handleAdd = async () => {
    if (!newSong.song_title.trim()) { setError("Song title is required"); return; }
    setAdding(true); setError(null);
    try {
      const res = await invoke("add_song", { ...newSong, category: activeCategory });
      setSongs(prev => [...prev, res.song]);
      setNewSong(p => ({ ...p, song_title: "", artist: "", notes: "" }));
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to add song");
    } finally { setAdding(false); }
  };

  const handleDelete = async (song) => {
    try {
      await invoke("delete_song", { music_id: song.id });
      setSongs(prev => prev.filter(s => s.id !== song.id));
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to remove song");
    }
  };

  const categorySongs = songs.filter(s => s.category === activeCategory);
  const catMeta = MUSIC_CATEGORIES.find(c => c.value === activeCategory);
  const totalCount = songs.length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-900 text-lg">Music Selections</h2>
        <Badge variant="secondary" className="text-xs">{totalCount}/{TOTAL_LIMIT} total</Badge>
      </div>

      {isLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start">
          <Lock className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800">Music selections are locked. Contact your coordinator to make changes.</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 items-center text-xs text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
          <button className="ml-auto underline" onClick={() => setError(null)}>dismiss</button>
        </div>
      )}

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {MUSIC_CATEGORIES.map(cat => {
          const count = songs.filter(s => s.category === cat.value).length;
          return (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                activeCategory === cat.value
                  ? cat.color + " border-current"
                  : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
              }`}
            >
              {cat.label} {count > 0 && <span className="ml-1 opacity-70">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Songs in active category */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">{catMeta?.label}</CardTitle>
            <span className="text-xs text-gray-400">{categorySongs.length}/{catMeta?.limit}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {categorySongs.length === 0 && (
            <div className="flex items-center gap-2 py-6 text-gray-400 justify-center text-sm">
              <Music className="w-4 h-4" /> No songs in this category yet
            </div>
          )}
          {categorySongs.map(song => (
            <div key={song.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-100 bg-gray-50">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{song.song_title}</p>
                {song.artist && <p className="text-xs text-gray-500 truncate">{song.artist}</p>}
              </div>
              {song.notes && <span className="text-xs text-gray-400 hidden sm:block truncate max-w-[120px]">{song.notes}</span>}
              {!isLocked && (
                <Button
                  size="icon" variant="ghost"
                  className="h-6 w-6 text-gray-300 hover:text-red-500 flex-shrink-0"
                  onClick={() => handleDelete(song)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Add song */}
      {!isLocked && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Add a Song</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={newSong.song_title}
                onChange={e => setNewSong(p => ({ ...p, song_title: e.target.value }))}
                placeholder="Song title *"
                className="flex-1 text-sm"
              />
              <Input
                value={newSong.artist}
                onChange={e => setNewSong(p => ({ ...p, artist: e.target.value }))}
                placeholder="Artist"
                className="flex-1 text-sm"
              />
            </div>
            <Input
              value={newSong.notes}
              onChange={e => setNewSong(p => ({ ...p, notes: e.target.value }))}
              placeholder="Notes (optional)"
              className="text-sm"
            />
            <Button onClick={handleAdd} disabled={adding} className="w-full gap-2 bg-violet-600 hover:bg-violet-700">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add to {catMeta?.label}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}