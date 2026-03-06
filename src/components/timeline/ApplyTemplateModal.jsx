import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, LayoutList } from "lucide-react";
import { toast } from "sonner";

export default function ApplyTemplateModal({ open, onClose, eventId, eventType, timelineType, onApplied }) {
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [applyHeader, setApplyHeader] = useState(false);
  const [applying, setApplying] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["timeline-templates-for-apply", eventType, timelineType],
    queryFn: async () => {
      const r = await base44.functions.invoke("getTimelineTemplates", {
        event_type: eventType,
        timeline_type: timelineType,
        active_only: true,
      });
      return r.data;
    },
    enabled: open && !!eventType,
    staleTime: 60_000,
  });

  const templates = data?.templates || [];

  const handleApply = async () => {
    if (!selectedTemplateId) { toast.error("Select a template first"); return; }
    setApplying(true);
    try {
      const res = await base44.functions.invoke("applyTimelineTemplateToEvent", {
        event_id: eventId,
        template_id: selectedTemplateId,
        apply_header: applyHeader,
        replace_existing: replaceExisting,
      });
      const body = res?.data;
      // Handle 422 PLANNING_LOCKED (axios doesn't throw on 4xx by default — check body)
      if (body?.error === "PLANNING_LOCKED") {
        toast.error(body.message || "Planning is locked; cannot apply template.");
        return;
      }
      toast.success(`Template applied — ${body?.applied ?? ""} activities added.`);
      onApplied?.();
      onClose();
    } catch (e) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || e.message || "Failed to apply template";
      if (msg === "PLANNING_LOCKED" || e?.response?.status === 422) {
        toast.error("Planning is locked; cannot apply template.");
      } else {
        toast.error(msg);
      }
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutList className="w-4 h-4 text-violet-600" /> Apply Timeline Template
          </DialogTitle>
          <DialogDescription>
            Select a template for this {eventType?.replace(/_/g, " ")} event ({timelineType}).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading templates…
            </div>
          ) : templates.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">
              No active templates found for {eventType?.replace(/_/g, " ")} / {timelineType}.
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger><SelectValue placeholder="Select a template…" /></SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2.5">
              <Checkbox id="replace" checked={replaceExisting} onCheckedChange={setReplaceExisting} />
              <Label htmlFor="replace" className="text-sm cursor-pointer">Replace existing timeline rows</Label>
            </div>
            <div className="flex items-center gap-2.5">
              <Checkbox id="header" checked={applyHeader} onCheckedChange={setApplyHeader} />
              <Label htmlFor="header" className="text-sm cursor-pointer">Apply template header (title / subtitle)</Label>
            </div>
          </div>

          {replaceExisting && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠️ Existing timeline activities will be permanently deleted before applying the template.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApply} disabled={applying || !selectedTemplateId || templates.length === 0}
            className="bg-violet-600 hover:bg-violet-700 text-white gap-1">
            {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Apply Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}