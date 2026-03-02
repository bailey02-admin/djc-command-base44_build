import React from "react";
import { format } from "date-fns";
import { CalendarDays, MapPin, Clock, DollarSign, Phone, CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATUS_LABELS = {
  booked_pending: "Booked",
  booked: "Booked",
  planning_in_progress: "Planning in Progress",
  finalized: "Finalized",
  completed: "Completed",
  cancelled: "Cancelled",
  postponed: "Postponed",
};

export default function PortalEventDetail({ bundle }) {
  const { event, timeline, musicSelections } = bundle;

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
    <div className="space-y-5">
      {/* Hero */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-2xl px-6 py-7">
        <p className="text-violet-200 text-xs uppercase tracking-wider mb-1 capitalize">{event.event_type?.replace(/_/g, " ")}</p>
        <h1 className="text-xl font-bold">{event.event_name}</h1>
        <div className="flex flex-wrap gap-4 mt-3 text-violet-200 text-xs">
          {event.event_date && (
            <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />{format(new Date(event.event_date), "MMMM d, yyyy")}</span>
          )}
          {event.start_time && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{event.start_time}{event.end_time ? ` – ${event.end_time}` : ""}</span>}
          {event.venue_name && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{event.venue_name}</span>}
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-violet-200 mb-1">
            <span>Planning Progress</span>
            <span>{completedCount}/{checklist.length}</span>
          </div>
          <div className="h-1.5 bg-white/20 rounded-full">
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${(completedCount / checklist.length) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Payment Summary */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Payment Summary</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Amount Paid</span>
            <span className="font-semibold text-emerald-600">${(event.amount_paid_total || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Remaining Balance</span>
            <span className={`font-bold ${event.remaining_balance > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              ${(event.remaining_balance || 0).toLocaleString()}
            </span>
          </div>
          {event.remaining_balance > 0 && event.payment_link && (
            <a href={event.payment_link} target="_blank" rel="noopener noreferrer">
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 mt-1 gap-2">
                <DollarSign className="w-4 h-4" /> Make a Payment
              </Button>
            </a>
          )}
        </CardContent>
      </Card>

      {/* Scheduling */}
      {event.finalizer_call_link && (
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4">
            <a href={event.finalizer_call_link} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full gap-2">
                <Phone className="w-4 h-4" /> Schedule Finalizer Call <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </a>
          </CardContent>
        </Card>
      )}

      {/* Checklist */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Your Checklist</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {checklist.map(item => (
              <div key={item.label} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-gray-50">
                {item.done
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  : <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                <span className={item.done ? "text-gray-400" : "text-gray-700"}>{item.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Timeline preview */}
      {timeline && timeline.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Event Timeline Preview</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {timeline.slice(0, 5).map(item => (
                <div key={item.id} className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
                  <span className="text-xs font-mono text-violet-600 font-bold w-14 flex-shrink-0">{item.time}</span>
                  <p className="text-sm text-gray-700">{item.segment_name}</p>
                </div>
              ))}
              {timeline.length > 5 && (
                <p className="text-xs text-gray-400 pt-1">+{timeline.length - 5} more segments</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Music preview */}
      {musicSelections && musicSelections.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Music Selections ({musicSelections.length} songs)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {[...new Set(musicSelections.map(s => s.category))].map(cat => (
                <Badge key={cat} variant="secondary" className="text-[10px] capitalize">
                  {cat?.replace(/_/g, " ")} ({musicSelections.filter(s => s.category === cat).length})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}