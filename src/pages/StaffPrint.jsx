/**
 * Staff Print / Export — /StaffPrint?event_id=xxx
 */
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Printer, Download, FileText, Music2, CalendarDays, Info, Loader2 } from "lucide-react";
import { format } from "date-fns";

const DOCUMENTS = [
  { key: "event_info",      label: "Event Information Sheet",           icon: Info },
  { key: "timeline",        label: "Ceremony & Reception Timeline",      icon: CalendarDays },
  { key: "music_list",      label: "Music List (Special Songs + Requests)", icon: Music2 },
];

export default function StaffPrint() {
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get("event_id");
  const navigate = useNavigate();

  const [selected, setSelected] = useState(new Set(DOCUMENTS.map(d => d.key)));
  const [printing, setPrinting] = useState(false);

  const { data: bundle, isLoading } = useQuery({
    queryKey: ["planning-bundle", eventId],
    queryFn: async () => {
      const r = await base44.functions.invoke("getPlanningBundle", { event_id: eventId });
      return r.data;
    },
    enabled: !!eventId,
  });

  const event = bundle?.event;

  const toggle = (key) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handlePrint = () => {
    window.print();
  };

  if (!eventId) return <div className="p-8 text-center text-gray-400">No event_id provided.</div>;

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-6 print:p-0">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 text-gray-500">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <h1 className="text-xl font-bold text-gray-900">Print / Export</h1>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (
        <>
          {/* Event summary */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-3">
              <FileText className="w-5 h-5 text-violet-500" />
              <div>
                <h2 className="font-semibold text-gray-900">{event?.event_name || "Event"}</h2>
                <p className="text-xs text-gray-400">
                  {event?.event_date && format(new Date(event.event_date), "MMMM d, yyyy")}
                  {event?.venue_name && ` · ${event.venue_name}`}
                </p>
              </div>
            </div>
          </div>

          {/* Document checklist */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 print:hidden">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Select Documents to Print</h2>
            <div className="space-y-3">
              {DOCUMENTS.map(({ key, label, icon: Icon }) => (
                <div key={key} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                  <Checkbox
                    id={key}
                    checked={selected.has(key)}
                    onCheckedChange={() => toggle(key)}
                  />
                  <Icon className="w-4 h-4 text-gray-400" />
                  <Label htmlFor={key} className="cursor-pointer text-sm text-gray-700">{label}</Label>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-5">
              <Button
                onClick={handlePrint}
                disabled={selected.size === 0}
                className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
              >
                <Printer className="w-4 h-4" />
                Print Selected ({selected.size})
              </Button>
              <Button
                variant="outline"
                onClick={() => { setSelected(new Set(DOCUMENTS.map(d => d.key))); setTimeout(handlePrint, 100); }}
                className="gap-2"
              >
                <Printer className="w-4 h-4" /> Print All
              </Button>
            </div>
          </div>

          {/* Print-only content */}
          <div className="hidden print:block space-y-8">
            {selected.has("event_info") && event && (
              <section>
                <h2 className="text-xl font-bold border-b-2 border-gray-800 pb-2 mb-4">Event Information</h2>
                <table className="w-full text-sm">
                  <tbody>
                    {[
                      ["Event Name", event.event_name],
                      ["Date", event.event_date && format(new Date(event.event_date), "EEEE, MMMM d, yyyy")],
                      ["City", event.city],
                      ["Venue", event.venue_name],
                      ["Contact", event.contact_name],
                      ["Event Type", event.event_type?.replace(/_/g," ")],
                      ["Assigned DJ", event.assigned_dj || "TBD"],
                    ].map(([label, val]) => val ? (
                      <tr key={label} className="border-b border-gray-100">
                        <td className="py-2 pr-4 font-semibold text-gray-600 w-40">{label}</td>
                        <td className="py-2 capitalize">{val}</td>
                      </tr>
                    ) : null)}
                  </tbody>
                </table>
              </section>
            )}
            {selected.has("timeline") && (
              <section>
                <h2 className="text-xl font-bold border-b-2 border-gray-800 pb-2 mb-4">Timeline</h2>
                <p className="text-gray-400 text-sm italic">Open the Timeline View page to print the formatted timeline.</p>
              </section>
            )}
            {selected.has("music_list") && (
              <section>
                <h2 className="text-xl font-bold border-b-2 border-gray-800 pb-2 mb-4">Music List</h2>
                <p className="text-gray-400 text-sm italic">Open the Music Manager page to print the music list.</p>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}