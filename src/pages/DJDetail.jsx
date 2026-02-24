import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { EventAPI } from "../components/api/secureApi";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Mail, Phone, MapPin, CalendarDays, User, ExternalLink, Music } from "lucide-react";
import { format, differenceInDays } from "date-fns";

const roleColors = { dj: "bg-violet-50 text-violet-700", mc: "bg-blue-50 text-blue-700", dj_mc: "bg-indigo-50 text-indigo-700" };
const roleLabel = { dj: "DJ", mc: "MC", dj_mc: "DJ + MC" };

const statusColors = {
  booked: "bg-blue-50 text-blue-700",
  planning_in_progress: "bg-violet-50 text-violet-700",
  dj_assigned: "bg-cyan-50 text-cyan-700",
  finalized: "bg-purple-50 text-purple-700",
  confirmed: "bg-emerald-50 text-emerald-700",
  event_completed: "bg-green-50 text-green-700",
};

export default function DJDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");
  const navigate = useNavigate();

  const { data: dj, isLoading } = useQuery({
    queryKey: ["dj-profile", id],
    queryFn: () => base44.entities.DJProfile.filter({ id }).then(r => r[0]),
    enabled: !!id,
  });

  const { data: allEvents = [] } = useQuery({
    queryKey: ["events-for-dj", id],
    queryFn: () => EventAPI.list({}, "-event_date", 200),
    enabled: !!id,
  });

  const assignedEvents = allEvents.filter(e =>
    e.assigned_dj_id === id || e.assigned_mc_id === id
  ).sort((a, b) => new Date(a.event_date) - new Date(b.event_date));

  const upcoming = assignedEvents.filter(e => e.event_date && new Date(e.event_date) >= new Date());
  const past = assignedEvents.filter(e => e.event_date && new Date(e.event_date) < new Date()).slice(0, 10);

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>;
  if (!dj) return <div className="p-8 text-gray-500 text-sm">DJ profile not found.</div>;

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6">
      <Button variant="ghost" className="text-sm text-gray-500 hover:text-gray-900 -ml-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
            <User className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{dj.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className={`text-xs ${roleColors[dj.role]}`}>{roleLabel[dj.role] || dj.role}</Badge>
              <Badge variant="secondary" className={`text-xs ${dj.is_active !== false ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                {dj.is_active !== false ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </div>
        <Link to={createPageUrl("DJRoster")}>
          <Button variant="outline" className="text-sm h-8">Edit Profile</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-violet-600">{upcoming.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Upcoming Events</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-700">{past.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Past Events</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-700">{assignedEvents.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total Assigned</p>
          </CardContent>
        </Card>
      </div>

      {/* Contact Info */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Contact & Info</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {dj.email && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail className="w-4 h-4 text-gray-400" />
              <a href={`mailto:${dj.email}`} className="hover:text-violet-600 hover:underline">{dj.email}</a>
            </div>
          )}
          {dj.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="w-4 h-4 text-gray-400" />
              <a href={`tel:${dj.phone}`} className="hover:text-violet-600">{dj.phone}</a>
            </div>
          )}
          {dj.city && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400" />{dj.city}
            </div>
          )}
          {dj.linked_user_email && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="w-4 h-4 text-gray-400" />CRM Login: {dj.linked_user_email}
            </div>
          )}
          {dj.notes && (
            <p className="text-sm text-gray-500 mt-2 pt-2 border-t italic">{dj.notes}</p>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Events */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Upcoming Events ({upcoming.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No upcoming events assigned.</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map(e => {
                const days = e.event_date ? differenceInDays(new Date(e.event_date), new Date()) : null;
                return (
                  <Link key={e.id} to={createPageUrl("EventDetail") + `?id=${e.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{e.event_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <CalendarDays className="w-3 h-3" />
                            {format(new Date(e.event_date), "EEE, MMM d, yyyy")}
                          </span>
                          {days !== null && <Badge variant="outline" className={`text-[10px] ${days <= 7 ? "text-red-600 border-red-200" : days <= 30 ? "text-amber-600 border-amber-200" : ""}`}>{days}d away</Badge>}
                          {e.assigned_mc_id === id && e.assigned_dj_id !== id && <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700">MC role</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={`text-[10px] ${statusColors[e.status] || "bg-gray-100 text-gray-600"}`}>
                          {e.status?.replace(/_/g, " ")}
                        </Badge>
                        <ExternalLink className="w-3.5 h-3.5 text-gray-300" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Events */}
      {past.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Recent Past Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {past.map(e => (
                <Link key={e.id} to={createPageUrl("EventDetail") + `?id=${e.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100 opacity-75">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{e.event_name}</p>
                      <span className="text-xs text-gray-400">{format(new Date(e.event_date), "MMM d, yyyy")}</span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-300" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}