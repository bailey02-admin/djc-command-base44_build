import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, differenceInDays } from "date-fns";
import {
  CalendarDays, MapPin, User, Phone, Mail, Clock, Music,
  AlertCircle, CheckCircle2, Disc3, ArrowLeft
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function DJView() {
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get("event_id");
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: event } = useQuery({
    queryKey: ["dj-event", eventId],
    queryFn: async () => {
      const events = await base44.entities.Event.list();
      return events.find(e => e.id === eventId);
    },
    enabled: !!eventId,
  });

  const { data: music = [] } = useQuery({
    queryKey: ["dj-music", eventId],
    queryFn: () => base44.entities.MusicSelection.filter({ event_id: eventId }, "category", 200),
    enabled: !!eventId,
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ["dj-timeline", eventId],
    queryFn: () => base44.entities.TimelineItem.filter({ event_id: eventId }, "order", 100),
    enabled: !!eventId,
  });

  const { data: planning } = useQuery({
    queryKey: ["dj-planning", eventId],
    queryFn: async () => {
      const plans = await base44.entities.EventPlanning.filter({ event_id: eventId });
      return plans[0];
    },
    enabled: !!eventId,
  });

  // DJ list view (if no event selected)
  const { data: myEvents = [] } = useQuery({
    queryKey: ["dj-events"],
    queryFn: () => base44.entities.Event.list("event_date", 100),
    enabled: !eventId,
  });

  if (!eventId) {
    const upcoming = myEvents.filter(e => e.event_date && new Date(e.event_date) >= new Date()).sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white p-6 pb-8">
          <div className="flex items-center gap-3 mb-1">
            <Disc3 className="w-6 h-6" />
            <h1 className="text-xl font-bold">DJ View</h1>
          </div>
          <p className="text-violet-200 text-sm">Welcome{user ? `, ${user.full_name}` : ""}! Here are your upcoming events.</p>
        </div>
        <div className="p-4 -mt-4 space-y-3">
          {upcoming.map(e => {
            const days = differenceInDays(new Date(e.event_date), new Date());
            return (
              <Link key={e.id} to={createPageUrl("DJView") + `?event_id=${e.id}`}>
                <Card className="border-0 shadow-sm hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{e.event_name}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          <CalendarDays className="w-3.5 h-3.5" />
                          {format(new Date(e.event_date), "EEE, MMM d, yyyy")}
                          {e.start_time && <span>• {e.start_time}</span>}
                        </div>
                        {e.venue_name && <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" />{e.venue_name}</p>}
                      </div>
                      <Badge className={days <= 3 ? "bg-red-100 text-red-700" : days <= 7 ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-700"}>
                        {days === 0 ? "Today!" : `${days}d`}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
          {upcoming.length === 0 && <p className="text-center py-16 text-gray-400 text-sm">No upcoming events.</p>}
        </div>
      </div>
    );
  }

  if (!event) return <div className="flex items-center justify-center h-screen"><Disc3 className="w-8 h-8 animate-spin text-violet-600" /></div>;

  const mustPlay = music.filter(m => m.category === "must_play");
  const doNotPlay = music.filter(m => m.category === "do_not_play");
  const specialSongs = music.filter(m => !["must_play", "do_not_play", "play_if_appropriate"].includes(m.category));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white p-6">
        <Link to={createPageUrl("DJView")} className="inline-flex items-center gap-1 text-violet-200 hover:text-white text-xs mb-3">
          <ArrowLeft className="w-3 h-3" /> All Events
        </Link>
        <h1 className="text-xl font-bold">{event.event_name}</h1>
        <p className="text-violet-200 text-sm mt-1 capitalize">{event.event_type?.replace(/_/g, " ")} • {event.event_date && format(new Date(event.event_date), "EEEE, MMMM d, yyyy")}</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Quick info */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400" /><span>{event.start_time || "TBD"} - {event.end_time || "TBD"}</span></div>
            <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400" /><span>{event.venue_name || "TBD"}</span></div>
            <div className="flex items-center gap-2"><User className="w-4 h-4 text-gray-400" /><span>{event.contact_name || "—"}</span></div>
            <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400" /><span>{event.contact_phone || "—"}</span></div>
            {event.setup_time && <div className="col-span-2 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-amber-500" /><span className="text-amber-700 font-medium">Setup: {event.setup_time}</span></div>}
            {event.guest_count && <div className="col-span-2 text-gray-500">👥 {event.guest_count} guests</div>}
          </CardContent>
        </Card>

        <Tabs defaultValue="timeline">
          <TabsList className="w-full bg-white border">
            <TabsTrigger value="timeline" className="flex-1 text-xs">Timeline</TabsTrigger>
            <TabsTrigger value="music" className="flex-1 text-xs">Music</TabsTrigger>
            <TabsTrigger value="details" className="flex-1 text-xs">Details</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="space-y-2 mt-4">
            {timeline.map(item => (
              <Card key={item.id} className="border-0 shadow-sm">
                <CardContent className="p-3">
                  <div className="flex gap-3">
                    <span className="text-xs font-mono text-violet-600 font-bold w-14 flex-shrink-0 pt-0.5">{item.time}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{item.segment_name}</p>
                      {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {item.mic_needed && <Badge variant="outline" className="text-[10px]">🎤 Mic</Badge>}
                        {item.music_cue && <Badge variant="outline" className="text-[10px]">🎵 {item.music_cue}</Badge>}
                        {item.lighting_cue && <Badge variant="outline" className="text-[10px]">💡 {item.lighting_cue}</Badge>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {timeline.length === 0 && <p className="text-center py-10 text-gray-400 text-sm">No timeline set up.</p>}
          </TabsContent>

          <TabsContent value="music" className="space-y-4 mt-4">
            {specialSongs.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-1"><CardTitle className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Special Songs</CardTitle></CardHeader>
                <CardContent className="space-y-1.5">
                  {specialSongs.map(s => (
                    <div key={s.id} className="text-sm py-1.5 border-b border-gray-100 last:border-0">
                      <span className="text-[10px] text-violet-500 uppercase font-medium">{s.category?.replace(/_/g, " ")}</span>
                      <p className="font-medium">{s.song_title} <span className="text-gray-400">– {s.artist}</span></p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            {mustPlay.length > 0 && (
              <Card className="border-0 shadow-sm border-l-4 border-l-emerald-500">
                <CardHeader className="pb-1"><CardTitle className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">✅ Must Play ({mustPlay.length})</CardTitle></CardHeader>
                <CardContent className="space-y-1">
                  {mustPlay.map(s => <p key={s.id} className="text-sm">{s.song_title} <span className="text-gray-400">– {s.artist}</span></p>)}
                </CardContent>
              </Card>
            )}
            {doNotPlay.length > 0 && (
              <Card className="border-0 shadow-sm border-l-4 border-l-red-500">
                <CardHeader className="pb-1"><CardTitle className="text-xs font-semibold text-red-600 uppercase tracking-wider">🚫 Do Not Play ({doNotPlay.length})</CardTitle></CardHeader>
                <CardContent className="space-y-1">
                  {doNotPlay.map(s => <p key={s.id} className="text-sm">{s.song_title} <span className="text-gray-400">– {s.artist}</span></p>)}
                </CardContent>
              </Card>
            )}
            {music.length === 0 && <p className="text-center py-10 text-gray-400 text-sm">No music selections.</p>}
          </TabsContent>

          <TabsContent value="details" className="space-y-4 mt-4">
            {planning && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-1"><CardTitle className="text-xs font-semibold uppercase tracking-wider">Planning Details</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {planning.formality_level && <div><span className="text-gray-400">Formality: </span><span className="capitalize">{planning.formality_level.replace(/_/g, " ")}</span></div>}
                  {planning.dj_freedom_level && <div><span className="text-gray-400">DJ Freedom: </span>{planning.dj_freedom_level}/10</div>}
                  {planning.vibe_description && <div><span className="text-gray-400">Vibe: </span>{planning.vibe_description}</div>}
                  {planning.notes_to_dj && <div className="p-3 bg-amber-50 rounded-lg text-amber-800 mt-2"><span className="font-medium">Notes to DJ: </span>{planning.notes_to_dj}</div>}
                  {planning.explicit_lyrics_ok !== undefined && <div><span className="text-gray-400">Explicit OK: </span>{planning.explicit_lyrics_ok ? "Yes" : "No"}</div>}
                </CardContent>
              </Card>
            )}
            {(event.load_in_notes || event.equipment_notes || event.internal_notes) && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-1"><CardTitle className="text-xs font-semibold uppercase tracking-wider">Internal Notes</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {event.load_in_notes && <div><span className="text-gray-400">Load-in: </span>{event.load_in_notes}</div>}
                  {event.equipment_notes && <div><span className="text-gray-400">Equipment: </span>{event.equipment_notes}</div>}
                  {event.internal_notes && <div><span className="text-gray-400">Notes: </span>{event.internal_notes}</div>}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}