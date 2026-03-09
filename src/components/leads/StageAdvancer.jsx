import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, ChevronRight } from "lucide-react";
import { PIPELINE_FIELD_LABELS, getMissingFieldsForStage } from "../crm/pipeline";
import { LeadAPI } from "@/components/api/secureApi";
import usePipelineConfig from "@/components/hooks/usePipelineConfig";

const LOST_REASONS = ["price","availability","competitor","no_response","changed_plans","diy","other"];
const LEAD_SOURCES = ["website","google_ads","meta_ads","referral","bridal_show","the_knot","weddingwire","yelp","phone_call","walk_in","vendor_referral","repeat_client","other"];

export default function StageAdvancer({ lead, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [targetStage, setTargetStage] = useState("");
  const [missingValues, setMissingValues] = useState({});
  const [saving, setSaving] = useState(false);
  const { stageMap, getAllowedTargets } = usePipelineConfig();

  const currentStage = stageMap[lead.pipeline_stage] || stageMap.new_inquiry;
  const allowedTargets = useMemo(() => getAllowedTargets(currentStage?.key || "new_inquiry"), [currentStage?.key, getAllowedTargets]);

  const prepareStage = (stageKey) => {
    setTargetStage(stageKey);
    const missing = getMissingFieldsForStage(lead, stageKey, stageMap);
    const init = {};
    missing.forEach((field) => { init[field] = lead[field] || ""; });
    setMissingValues(init);
  };

  const handleOpen = () => {
    const firstTarget = allowedTargets[0]?.key || "";
    prepareStage(firstTarget);
    setOpen(true);
  };

  const handleAdvance = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    const updates = { pipeline_stage: targetStage, ...missingValues };
    if (targetStage === "quote_sent" && !lead.quote_sent_date) updates.quote_sent_date = now;
    if (targetStage === "booked" && !lead.booked_date) updates.booked_date = now;
    if (targetStage === "deposit_requested" && !lead.deposit_requested_date) updates.deposit_requested_date = now;
    await LeadAPI.advanceStage(lead.id, updates);
    await onUpdate?.(updates, targetStage, { alreadySaved: true });
    setSaving(false);
    setOpen(false);
  };

  const missingFields = targetStage ? getMissingFieldsForStage({ ...lead, ...missingValues }, targetStage, stageMap) : [];
  const initialMissingFields = targetStage ? getMissingFieldsForStage(lead, targetStage, stageMap) : [];

  return (
    <>
      {allowedTargets.length > 0 && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleOpen}
          className="text-xs h-8 gap-1 border-violet-200 text-violet-700 hover:bg-violet-50"
        >
          {allowedTargets.length === 1 ? `→ ${allowedTargets[0].label}` : "Change Stage"}
          <ChevronRight className="w-3 h-3" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Advance to: {stageMap[targetStage]?.label || "Select stage"}</DialogTitle>
          </DialogHeader>

          {allowedTargets.length > 1 && (
            <div>
              <Label className="text-xs">Target Stage</Label>
              <Select value={targetStage} onValueChange={prepareStage}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select stage" /></SelectTrigger>
                <SelectContent>
                  {allowedTargets.map((stage) => <SelectItem key={stage.key} value={stage.key}>{stage.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {initialMissingFields.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Fill in required fields to advance this lead.</span>
              </div>
              {initialMissingFields.map((field) => (
                <div key={field}>
                  <Label className="text-xs">{PIPELINE_FIELD_LABELS[field] || field} *</Label>
                  {field === "lost_reason" ? (
                    <Select value={missingValues[field] || ""} onValueChange={(value) => setMissingValues((prev) => ({ ...prev, [field]: value }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select reason" /></SelectTrigger>
                      <SelectContent>
                        {LOST_REASONS.map((reason) => <SelectItem key={reason} value={reason}>{reason.replace(/_/g, " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : field === "lead_source" ? (
                    <Select value={missingValues[field] || ""} onValueChange={(value) => setMissingValues((prev) => ({ ...prev, [field]: value }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select source" /></SelectTrigger>
                      <SelectContent>
                        {LEAD_SOURCES.map((source) => <SelectItem key={source} value={source}>{source.replace(/_/g, " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      className="mt-1"
                      type={["event_date","consultation_date","booked_date"].includes(field) ? "date" : ["quote_amount","deposit_amount","total_fee","no_response_count"].includes(field) ? "number" : "text"}
                      value={missingValues[field] || ""}
                      onChange={(e) => setMissingValues((prev) => ({ ...prev, [field]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {initialMissingFields.length === 0 && targetStage && (
            <p className="text-sm text-gray-500 py-2">All required fields are complete. Ready to advance!</p>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAdvance}
              disabled={saving || !targetStage || missingFields.length > 0}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {saving ? "Saving..." : "Advance Stage"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}