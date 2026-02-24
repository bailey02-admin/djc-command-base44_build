/**
 * DJAssignModal — pick a DJ from the roster and assign to an event.
 * Warns if DJ already has an event on the same date.
 */
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { EventAPI } from "../api/secureApi";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { User, AlertTriangle, CheckCircle2, Search, Loader2 } from "lucide-react";

export default function DJAssignModal({ event, onClose, onSaved }) {
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);

  const { data: roster = [] } = useQuery({
    queryKey: ["dj-roster"],
    queryFn: () => base44.entities.DJProfile.list("name", 100),
  });

  // Load all events on the same date to check conflicts
  const { data: sameDay = [] } = useQuery({
    queryKey: ["events-same-date", event.event_date],
    queryFn: () => EventAPI.list({ event_date: event.event_date }, "event_date", 50),
    enabled: !!event.event_date,
  });

  // Conflict detection: match on either the new assigned_dj_id field OR legacy free-text name/email
  const conflicted = new Set([
    ...sameDay.filter(e => e.id !== event.id && e.assigned_dj_id).map(e => e.assigned_dj_id),
    ...sameDay.filter(e => e.id !== event.id && !e.assigned_dj_id && e.assigned_dj).map(e => e.assigned_dj),
  ]);

  const filtered = roster.filter(dj =>
    dj.is_active !== false &&
    (!search || dj.name?.toLowerCase().includes(search.toLowerCase()) ||
     dj.city?.toLowerCase().includes(search.toLowerCase()) ||
     dj.email?.toLowerCase().includes(search.toLowerCase()))
  );

  const handleAssign = async () => {
    if (!selected) return;
    setSaving(true);
    await EventAPI.update(event.id, {
      assigned_dj: selected.name,       // display name (shown everywhere)
      assigned_dj_id: selected.id,      // roster ID (conflict detection, linking)
    });
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Assign DJ — {event.event_name}</DialogTitle>
          <p className="text-xs text-gray-500">{event.event_date} · {event.city}</p>
        </DialogHeader>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search DJ roster..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {filtered.map(dj => {
            // Conflict: matched by ID (new) OR legacy free-text match
            const isConflict = conflicted.has(dj.id) || conflicted.has(dj.email) || conflicted.has(dj.name);
            // Current: matched by ID first, then legacy
            const isCurrent = event.assigned_dj_id === dj.id ||
              (!event.assigned_dj_id && (event.assigned_dj === dj.email || event.assigned_dj === dj.name));
            const isSelected = selected?.id === dj.id;

            return (
              <button
                key={dj.id}
                onClick={() => !isConflict && setSelected(dj)}
                disabled={isConflict}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                  isSelected ? "border-violet-400 bg-violet-50" :
                  isCurrent  ? "border-emerald-300 bg-emerald-50" :
                  isConflict ? "border-red-100 bg-red-50/50 opacity-60 cursor-not-allowed" :
                  "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{dj.name}</p>
                  <p className="text-xs text-gray-400">{dj.city} · {dj.role?.replace(/_/g, " ")}</p>
                </div>
                <div className="flex-shrink-0">
                  {isCurrent && <Badge className="text-[10px] bg-emerald-100 text-emerald-700">Current</Badge>}
                  {isConflict && (
                    <span className="flex items-center gap-1 text-[10px] text-red-500">
                      <AlertTriangle className="w-3 h-3" /> Conflict
                    </span>
                  )}
                  {isSelected && !isConflict && !isCurrent && (
                    <CheckCircle2 className="w-4 h-4 text-violet-500" />
                  )}
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center py-6 text-gray-400 text-sm">No DJs found. Add DJs in the DJ Roster page.</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!selected || saving}
            onClick={handleAssign}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Assign {selected?.name || ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}