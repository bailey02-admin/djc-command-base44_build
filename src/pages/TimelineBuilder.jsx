import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Trash2, Clock, GripVertical, Loader2, Save, Sparkles } from "lucide-react";

const WEDDING_TEMPLATE = [
  { segment_name: "Guest Arrival & Cocktail Music", time: "5:00 PM", end_time: "5:30 PM", order: 1 },
  { segment_name: "Wedding Party Entrance", time: "5:30 PM", end_time: "5:35 PM", order: 2, mic_needed: true, music_cue: "Upbeat entrance song" },
  { segment_name: "Grand Entrance of Couple", time: "5:35 PM", end_time: "5:40 PM", order: 3, mic_needed: true, music_cue: "Grand entrance song" },
  { segment_name: "First Dance", time: "5:40 PM", end_time: "5:45 PM", order: 4, music_cue: "First dance song" },
  { segment_name: "Welcome & Blessing", time: "5:45 PM", end_time: "5:55 PM", order: 5, mic_needed: true },
  { segment_name: "Dinner Service", time: "5:55 PM", end_time: "6:45 PM", order: 6, music_cue: "Background dinner music" },
  { segment_name: "Toasts & Speeches", time: "6:45 PM", end_time: "7:10 PM", order: 7, mic_needed: true },
  { segment_name: "Parent Dances", time: "7:10 PM", end_time: "7:20 PM", order: 8, music_cue: "Parent dance songs" },
  { segment_name: "Cake Cutting", time: "7:20 PM", end_time: "7:25 PM", order: 9, mic_needed: true, music_cue: "Cake cutting song" },
  { segment_name: "Open Dancing", time: "7:25 PM", end_time: "9:45 PM", order: 10 },
  { segment_name: "Bouquet & Garter Toss", time: "8:30 PM", end_time: "8:40 PM", order: 11, mic_needed: true },
  { segment_name: "Last Dance", time: "9:45 PM", end_time: "9:50 PM", order: 12, music_cue: "Last dance song" },
  { segment_name: "Grand Exit", time: "9:50 PM", end_time: "10:00 PM", order: 13, mic_needed: true },
];

export default function TimelineBuilder() {
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get("event_id");
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ segment_name: "", time: "", end_time: "", description: "", music_cue: "", mic_needed: false, lighting_cue: "", notes: "" });

  const { data: items = [] } = useQuery({
    queryKey: ["timeline", eventId],
    queryFn: () => base44.entities.TimelineItem.filter({ event_id: eventId }, "order", 100),
    enabled: !!eventId,
  });

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.TimelineItem.create({
      ...form,
      event_id: eventId,
      order: items.length + 1,
    });
    setForm({ segment_name: "", time: "", end_time: "", description: "", music_cue: "", mic_needed: false, lighting_cue: "", notes: "" });
    setSaving(false);
    setAdding(false);
    queryClient.invalidateQueries(["timeline", eventId]);
  };

  const handleDelete = async (id) => {
    await base44.entities.TimelineItem.delete(id);
    queryClient.invalidateQueries(["timeline", eventId]);
  };

  const applyTemplate = async () => {
    setSaving(true);
    await base44.entities.TimelineItem.bulkCreate(
      WEDDING_TEMPLATE.map(t => ({ ...t, event_id: eventId }))
    );
    setSaving(false);
    queryClient.invalidateQueries(["timeline", eventId]);
  };

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6">
      <Link to={createPageUrl("EventDetail") + `?id=${eventId}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to Event
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Timeline Builder</h1>
          <p className="text-sm text-gray-500 mt-0.5">{items.length} items</p>
        </div>
        <div className="flex gap-2">
          {items.length === 0 && (
            <Button onClick={applyTemplate} variant="outline" disabled={saving} className="text-sm h-9">
              <Sparkles className="w-4 h-4 mr-1.5" /> Wedding Template
            </Button>
          )}
          <Button onClick={() => setAdding(!adding)} className="bg-gradient-to-r from-violet-600 to-indigo-600 text-sm h-9">
            <Plus className="w-4 h-4 mr-1.5" /> Add Item
          </Button>
        </div>
      </div>

      {adding && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label className="text-xs">Segment Name *</Label><Input value={form.segment_name} onChange={e => setForm({...form, segment_name: e.target.value})} className="mt-1" /></div>
              <div><Label className="text-xs">Start Time</Label><Input value={form.time} onChange={e => setForm({...form, time: e.target.value})} placeholder="6:00 PM" className="mt-1" /></div>
              <div><Label className="text-xs">End Time</Label><Input value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})} placeholder="6:30 PM" className="mt-1" /></div>
              <div><Label className="text-xs">Music Cue</Label><Input value={form.music_cue} onChange={e => setForm({...form, music_cue: e.target.value})} className="mt-1" /></div>
              <div><Label className="text-xs">Lighting Cue</Label><Input value={form.lighting_cue} onChange={e => setForm({...form, lighting_cue: e.target.value})} className="mt-1" /></div>
            </div>
            <div><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} className="mt-1" /></div>
            <div className="flex items-center gap-2">
              <Switch checked={form.mic_needed} onCheckedChange={v => setForm({...form, mic_needed: v})} />
              <Label className="text-xs">Microphone needed</Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !form.segment_name} className="bg-violet-600 hover:bg-violet-700">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Save
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-violet-200 via-violet-300 to-violet-200" />
        <div className="space-y-1">
          {items.map((item, idx) => (
            <div key={item.id} className="relative flex gap-4 group">
              <div className="w-16 text-right flex-shrink-0 pt-3">
                <span className="text-xs font-mono text-violet-600 font-medium">{item.time}</span>
              </div>
              <div className="w-4 flex-shrink-0 flex items-start justify-center pt-4 relative z-10">
                <div className="w-3 h-3 rounded-full bg-violet-500 ring-4 ring-violet-100" />
              </div>
              <Card className="flex-1 border-0 shadow-sm mb-2 group-hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{item.segment_name}</p>
                      {item.description && <p className="text-xs text-gray-500 mt-1">{item.description}</p>}
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {item.time && item.end_time && (
                          <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />{item.time} - {item.end_time}
                          </span>
                        )}
                        {item.mic_needed && <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">🎤 Mic</span>}
                        {item.music_cue && <span className="text-[10px] bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded">🎵 {item.music_cue}</span>}
                        {item.lighting_cue && <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">💡 {item.lighting_cue}</span>}
                      </div>
                    </div>
                    <button onClick={() => handleDelete(item.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-center py-16 text-gray-400 text-sm ml-20">
              No timeline items yet. Add items or use a template to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}