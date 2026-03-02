import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Trash2, Music, Loader2, Save } from "lucide-react";
import { EventOpsAPI, MusicAPI } from "../components/api/secureApi";

const CATEGORIES = [
  { key: "first_dance", label: "First Dance", icon: "💃" },
  { key: "father_daughter", label: "Father/Daughter Dance", icon: "👨‍👧" },
  { key: "mother_son", label: "Mother/Son Dance", icon: "👩‍👦" },
  { key: "wedding_party_entrance", label: "Wedding Party Entrance", icon: "🎉" },
  { key: "grand_entrance", label: "Grand Entrance", icon: "✨" },
  { key: "cake_cutting", label: "Cake Cutting", icon: "🎂" },
  { key: "bouquet_toss", label: "Bouquet Toss", icon: "💐" },
  { key: "garter_toss", label: "Garter Toss", icon: "🎯" },
  { key: "last_dance", label: "Last Dance", icon: "🌙" },
  { key: "ceremony_processional", label: "Ceremony Processional", icon: "🚶" },
  { key: "ceremony_recessional", label: "Ceremony Recessional", icon: "🎵" },
  { key: "must_play", label: "Must Play", icon: "✅" },
  { key: "do_not_play", label: "Do Not Play", icon: "🚫" },
  { key: "play_if_appropriate", label: "Play If Appropriate", icon: "🤔" },
  { key: "cocktail_hour", label: "Cocktail Hour", icon: "🍸" },
  { key: "dinner", label: "Dinner", icon: "🍽️" },
  { key: "open_dance", label: "Open Dance", icon: "🕺" },
];

export default function MusicPlanner() {
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get("event_id");
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ category: "must_play", song_title: "", artist: "", notes: "", clean_version_preferred: false });

  const { data: songs = [] } = useQuery({
    queryKey: ["music", eventId],
    queryFn: () => base44.entities.MusicSelection.filter({ event_id: eventId }, "category", 200),
    enabled: !!eventId,
  });

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.MusicSelection.create({ ...form, event_id: eventId });
    setForm({ category: "must_play", song_title: "", artist: "", notes: "", clean_version_preferred: false });
    setSaving(false);
    setAdding(false);
    queryClient.invalidateQueries(["music", eventId]);
    EventOpsAPI.syncFlags(eventId).catch(() => {});
  };

  const handleDelete = async (id) => {
    await base44.entities.MusicSelection.delete(id);
    queryClient.invalidateQueries(["music", eventId]);
    EventOpsAPI.syncFlags(eventId).catch(() => {});
  };

  const grouped = CATEGORIES.map(cat => ({
    ...cat,
    songs: songs.filter(s => s.category === cat.key),
  })).filter(g => g.songs.length > 0 || ["first_dance", "must_play", "do_not_play"].includes(g.key));

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6">
      <Link to={createPageUrl("EventDetail") + `?id=${eventId}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to Event
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Music Planner</h1>
          <p className="text-sm text-gray-500 mt-0.5">{songs.length} songs added</p>
        </div>
        <Button onClick={() => setAdding(!adding)} className="bg-gradient-to-r from-violet-600 to-indigo-600 text-sm h-9">
          <Plus className="w-4 h-4 mr-1.5" /> Add Song
        </Button>
      </div>

      {adding && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.icon} {c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Song Title *</Label><Input value={form.song_title} onChange={e => setForm({...form, song_title: e.target.value})} className="mt-1" /></div>
              <div><Label className="text-xs">Artist</Label><Input value={form.artist} onChange={e => setForm({...form, artist: e.target.value})} className="mt-1" /></div>
              <div><Label className="text-xs">Notes</Label><Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="mt-1" /></div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.clean_version_preferred} onCheckedChange={v => setForm({...form, clean_version_preferred: v})} />
              <Label className="text-xs">Prefer clean version</Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !form.song_title} className="bg-violet-600 hover:bg-violet-700">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Save
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {grouped.map(group => (
          <Card key={group.key} className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <span>{group.icon}</span> {group.label}
                <Badge variant="secondary" className="text-[10px] ml-auto">{group.songs.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {group.songs.length > 0 ? (
                <div className="space-y-2">
                  {group.songs.map(s => (
                    <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 group">
                      <div className="text-sm">
                        <p className="font-medium">{s.song_title}</p>
                        <p className="text-xs text-gray-400">{s.artist}{s.notes ? ` • ${s.notes}` : ""}</p>
                        {s.clean_version_preferred && <Badge variant="outline" className="text-[10px] mt-0.5">Clean</Badge>}
                      </div>
                      <button onClick={() => handleDelete(s.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 py-3 text-center">No songs added yet.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}