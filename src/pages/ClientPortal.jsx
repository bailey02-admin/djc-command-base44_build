import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { 
  CalendarDays, MapPin, Clock, Music, CheckCircle2, Circle, 
  DollarSign, Disc3, Plus, Trash2, Save, Loader2, Heart
} from "lucide-react";

const SONG_CATEGORIES = [
  { key: "first_dance", label: "First Dance" },
  { key: "father_daughter", label: "Father/Daughter" },
  { key: "mother_son", label: "Mother/Son" },
  { key: "grand_entrance", label: "Grand Entrance" },
  { key: "cake_cutting", label: "Cake Cutting" },
  { key: "last_dance", label: "Last Dance" },
  { key: "must_play", label: "Must Play" },
  { key: "do_not_play", label: "Do Not Play" },
];

export default function ClientPortal() {
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get("event_id");
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [songForm, setSongForm] = useState({ category: "must_play", song_title: "", artist: "" });
  const [addingSong, setAddingSong] = useState(false);

  const { data: event } = useQuery({
    queryKey: ["client-event", eventId],
    queryFn: async () => {
      const events = await base44.entities.Event.list();
      return events.find(e => e.id === eventId);
    },
    enabled: !!eventId,
  });

  const { data: music = [] } = useQuery({
    queryKey: ["client-music", eventId],
    queryFn: () => base44.entities.MusicSelection.filter({ event_id: eventId }, "category", 200),
    enabled: !!eventId,
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ["client-timeline", eventId],
    queryFn: () => base44.entities.TimelineItem.filter({ event_id: eventId }, "order", 100),
    enabled: !!eventId,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["client-payments", eventId],
    queryFn: () => base44.entities.Payment.filter({ event_id: eventId }, "due_date", 20),
    enabled: !!eventId,
  });

  const { data: planning, isLoading: planningLoading } = useQuery({
    queryKey: ["client-planning", eventId],
    queryFn: async () => {
      const plans = await base44.entities.EventPlanning.filter({ event_id: eventId });
      return plans[0] || null;
    },
    enabled: !!eventId,
  });

  const [planningForm, setPlanningForm] = useState({});

  useEffect(() => {
    if (planning) setPlanningForm(planning);
  }, [planning]);

  const savePlanning = async () => {
    setSaving(true);
    const data = { ...planningForm, event_id: eventId };
    if (planning?.id) {
      await base44.entities.EventPlanning.update(planning.id, data);
    } else {
      await base44.entities.EventPlanning.create(data);
    }
    setSaving(false);
    queryClient.invalidateQueries(["client-planning", eventId]);
    // Sync planning_complete flag after save (fire-and-forget)
    base44.functions.invoke("syncEventFlags", { action: "sync_flags", event_id: eventId }).catch(() => {});
  };

  const addSong = async () => {
    await base44.entities.MusicSelection.create({ ...songForm, event_id: eventId, added_by: "client" });
    setSongForm({ category: "must_play", song_title: "", artist: "" });
    setAddingSong(false);
    queryClient.invalidateQueries(["client-music", eventId]);
  };

  const deleteSong = async (id) => {
    await base44.entities.MusicSelection.delete(id);
    queryClient.invalidateQueries(["client-music", eventId]);
  };

  if (!eventId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-rose-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-0 shadow-xl">
          <CardContent className="p-8 text-center">
            <Heart className="w-12 h-12 text-rose-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Client Portal</h1>
            <p className="text-sm text-gray-500 mt-2">Please use the link provided by your DJ company to access your event planning portal.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!event) return <div className="flex items-center justify-center h-screen"><Disc3 className="w-8 h-8 animate-spin text-violet-600" /></div>;

  const checklist = [
    { label: "Contract Signed", done: event.contract_signed },
    { label: "Deposit Paid", done: event.deposit_paid },
    { label: "Planning Form", done: event.planning_complete },
    { label: "Timeline", done: event.timeline_complete },
    { label: "Music Selections", done: event.music_complete },
    { label: "Balance Paid", done: event.balance_paid },
  ];
  const completedCount = checklist.filter(c => c.done).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-rose-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-6 py-10 text-center">
        <Disc3 className="w-8 h-8 mx-auto mb-3 opacity-80" />
        <h1 className="text-2xl font-bold">{event.event_name}</h1>
        <div className="flex items-center justify-center gap-4 mt-3 text-violet-200 text-sm">
          {event.event_date && <span className="flex items-center gap-1"><CalendarDays className="w-4 h-4" />{format(new Date(event.event_date), "MMMM d, yyyy")}</span>}
          {event.venue_name && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{event.venue_name}</span>}
        </div>
        {/* Progress */}
        <div className="mt-6 max-w-xs mx-auto">
          <div className="flex items-center justify-between text-xs mb-1">
            <span>Planning Progress</span>
            <span>{completedCount}/{checklist.length}</span>
          </div>
          <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${(completedCount / checklist.length) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-6 -mt-4">
        {/* Checklist */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Your Checklist</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {checklist.map(item => (
                <div key={item.label} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-gray-50/50">
                  {item.done ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 text-gray-300" />}
                  <span className={item.done ? "text-gray-400" : "text-gray-700"}>{item.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="planning">
          <TabsList className="w-full bg-white border">
            <TabsTrigger value="planning" className="flex-1 text-xs">Planning Form</TabsTrigger>
            <TabsTrigger value="music" className="flex-1 text-xs">Music</TabsTrigger>
            <TabsTrigger value="timeline" className="flex-1 text-xs">Timeline</TabsTrigger>
            <TabsTrigger value="payments" className="flex-1 text-xs">Payments</TabsTrigger>
          </TabsList>

          <TabsContent value="planning" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Planning Questionnaire</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-xs">Bride's Full Name</Label><Input value={planningForm.bride_full_name || ""} onChange={e => setPlanningForm({...planningForm, bride_full_name: e.target.value})} className="mt-1" /></div>
                  <div><Label className="text-xs">Groom's Full Name</Label><Input value={planningForm.groom_full_name || ""} onChange={e => setPlanningForm({...planningForm, groom_full_name: e.target.value})} className="mt-1" /></div>
                  <div><Label className="text-xs">Bride Pronunciation</Label><Input value={planningForm.bride_pronunciation || ""} onChange={e => setPlanningForm({...planningForm, bride_pronunciation: e.target.value})} placeholder="How to pronounce" className="mt-1" /></div>
                  <div><Label className="text-xs">Groom Pronunciation</Label><Input value={planningForm.groom_pronunciation || ""} onChange={e => setPlanningForm({...planningForm, groom_pronunciation: e.target.value})} placeholder="How to pronounce" className="mt-1" /></div>
                </div>
                <div>
                  <Label className="text-xs">Formality Level</Label>
                  <Select value={planningForm.formality_level || "semi_formal"} onValueChange={v => setPlanningForm({...planningForm, formality_level: v})}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["very_formal","formal","semi_formal","casual","fun_party"].map(f => (
                        <SelectItem key={f} value={f}>{f.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Describe the vibe you want</Label>
                  <Textarea value={planningForm.vibe_description || ""} onChange={e => setPlanningForm({...planningForm, vibe_description: e.target.value})} rows={2} className="mt-1" placeholder="Fun and upbeat? Elegant? A mix?" />
                </div>
                <div>
                  <Label className="text-xs mb-2 block">DJ Freedom Level: {planningForm.dj_freedom_level || 5}/10</Label>
                  <p className="text-[10px] text-gray-400 mb-2">1 = Stick to our playlist only, 10 = Read the room and play what works</p>
                  <Slider value={[planningForm.dj_freedom_level || 5]} onValueChange={v => setPlanningForm({...planningForm, dj_freedom_level: v[0]})} max={10} min={1} step={1} />
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={planningForm.explicit_lyrics_ok || false} onCheckedChange={v => setPlanningForm({...planningForm, explicit_lyrics_ok: v})} />
                  <Label className="text-xs">OK to play songs with explicit lyrics</Label>
                </div>
                <div>
                  <Label className="text-xs">Special Announcements</Label>
                  <Textarea value={planningForm.special_announcements || ""} onChange={e => setPlanningForm({...planningForm, special_announcements: e.target.value})} rows={2} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Notes to DJ</Label>
                  <Textarea value={planningForm.notes_to_dj || ""} onChange={e => setPlanningForm({...planningForm, notes_to_dj: e.target.value})} rows={3} className="mt-1" placeholder="Anything special we should know?" />
                </div>
                <Button onClick={savePlanning} disabled={saving} className="w-full bg-gradient-to-r from-violet-600 to-indigo-600">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Save Planning Form
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="music" className="mt-4 space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold">Your Music Selections</CardTitle>
                <Button size="sm" onClick={() => setAddingSong(!addingSong)} className="bg-violet-600 hover:bg-violet-700">
                  <Plus className="w-4 h-4 mr-1" /> Add Song
                </Button>
              </CardHeader>
              <CardContent>
                {addingSong && (
                  <div className="p-4 bg-gray-50 rounded-lg mb-4 space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <Select value={songForm.category} onValueChange={v => setSongForm({...songForm, category: v})}>
                        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SONG_CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input value={songForm.song_title} onChange={e => setSongForm({...songForm, song_title: e.target.value})} placeholder="Song title" className="text-sm" />
                      <Input value={songForm.artist} onChange={e => setSongForm({...songForm, artist: e.target.value})} placeholder="Artist" className="text-sm" />
                    </div>
                    <Button size="sm" onClick={addSong} disabled={!songForm.song_title} className="bg-violet-600">Add</Button>
                  </div>
                )}
                <div className="space-y-2">
                  {music.map(s => (
                    <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 text-sm group">
                      <div>
                        <Badge variant="secondary" className="text-[10px] capitalize mb-0.5">{s.category?.replace(/_/g, " ")}</Badge>
                        <p className="font-medium">{s.song_title} <span className="text-gray-400">– {s.artist}</span></p>
                      </div>
                      <button onClick={() => deleteSong(s.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {music.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No songs added yet. Start adding your must-play songs!</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Your Event Timeline</CardTitle></CardHeader>
              <CardContent>
                {timeline.length > 0 ? (
                  <div className="space-y-2">
                    {timeline.map(item => (
                      <div key={item.id} className="flex gap-3 py-2.5 border-b border-gray-100 last:border-0">
                        <span className="text-xs font-mono text-violet-600 font-bold w-14 flex-shrink-0">{item.time}</span>
                        <div>
                          <p className="text-sm font-medium">{item.segment_name}</p>
                          {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-center py-8 text-gray-400 text-sm">Your timeline will appear here once it's been set up.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Payment Status</CardTitle></CardHeader>
              <CardContent>
                {payments.length > 0 ? payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-3 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium capitalize">{p.payment_type?.replace(/_/g, " ")}</p>
                      {p.due_date && <p className="text-xs text-gray-400">Due: {format(new Date(p.due_date), "MMM d, yyyy")}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">${p.amount?.toLocaleString()}</p>
                      <Badge variant="secondary" className={`text-[10px] ${p.status === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-yellow-50 text-yellow-700"}`}>{p.status}</Badge>
                    </div>
                  </div>
                )) : <p className="text-center py-8 text-gray-400 text-sm">No payment information available yet.</p>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}