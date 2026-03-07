import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, ChevronRight } from "lucide-react";
import { PIPELINE_STAGES, getMissingFieldsForStage } from "../crm/pipeline";
import { LeadAPI } from "@/components/api/secureApi";

const FIELD_LABELS = {
  phone: "Phone Number",
  event_date: "Event Date",
  city: "Event City",
  lead_source: "Lead Source",
  first_response_date: "First Response Date",
  consultation_date: "Consultation Date",
  quote_amount: "Quote Amount",
  package_name: "Package Name",
  assigned_rep: "Assigned Rep (email)",
  quote_sent_date: "Quote Sent Date",
  deposit_amount: "Deposit Amount",
  total_fee: "Total Fee",
  booked_date: "Booked Date",
  lost_reason: "Lost Reason",
  no_response_count: "No Response Count",
};

const LOST_REASONS = ["price","availability","competitor","no_response","changed_plans","diy","other"];
const LEAD_SOURCES = ["website","google_ads","meta_ads","referral","bridal_show","the_knot","weddingwire","yelp","phone_call","walk_in","vendor_referral","repeat_client","other"];

export default function StageAdvancer({ lead, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [targetStage, setTargetStage] = useState("");
  const [missingValues, setMissingValues] = useState({});
  const [saving, setSaving] = useState(false);

  const currentIdx = PIPELINE_STAGES.findIndex(s => s.key === lead.pipeline_stage);
  const nextStage = PIPELINE_STAGES[currentIdx + 1];

  const handleOpenForStage = (stageKey) => {
    setTargetStage(stageKey);
    const missing = getMissingFieldsForStage(lead, stageKey);
    const init = {};
    missing.forEach(f => { init[f] = lead[f] || ""; });
    setMissingValues(init);
    setOpen(true);
  };

  const handleAdvance = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    const updates = { pipeline_stage: targetStage, ...missingValues };

    // Timestamp updates
    if (targetStage === "quote_sent" && !lead.quote_sent_date) updates.quote_sent_date = now;
    if (targetStage === "booked" && !lead.booked_date) updates.booked_date = now;
    if (targetStage === "deposit_requested" && !lead.deposit_requested_date) updates.deposit_requested_date = now;

    await onUpdate(updates, targetStage);
    setSaving(false);
    setOpen(false);
  };

  const missingFields = targetStage ? getMissingFieldsForStage({ ...lead, ...missingValues }, targetStage) : [];
  const canProceed = missingFields.length === 0;

  return (
    <>
      {nextStage && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleOpenForStage(nextStage.key)}
          className="text-xs h-8 gap-1 border-violet-200 text-violet-700 hover:bg-violet-50"
        >
          → {nextStage.label}
          <ChevronRight className="w-3 h-3" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Advance to: {PIPELINE_STAGES.find(s => s.key === targetStage)?.label}</DialogTitle>
          </DialogHeader>

          {getMissingFieldsForStage(lead, targetStage).length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Fill in required fields to advance this lead.</span>
              </div>
              {getMissingFieldsForStage(lead, targetStage).map(field => (
                <div key={field}>
                  <Label className="text-xs">{FIELD_LABELS[field] || field} *</Label>
                  {field === "lost_reason" ? (
                    <Select value={missingValues[field] || ""} onValueChange={v => setMissingValues(p => ({...p, [field]: v}))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select reason" /></SelectTrigger>
                      <SelectContent>
                        {LOST_REASONS.map(r => <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : field === "lead_source" ? (
                    <Select value={missingValues[field] || ""} onValueChange={v => setMissingValues(p => ({...p, [field]: v}))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select source" /></SelectTrigger>
                      <SelectContent>
                        {LEAD_SOURCES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      className="mt-1"
                      type={["event_date","consultation_date","booked_date"].includes(field) ? "date" : ["quote_amount","deposit_amount","total_fee","no_response_count"].includes(field) ? "number" : "text"}
                      value={missingValues[field] || ""}
                      onChange={e => setMissingValues(p => ({...p, [field]: e.target.value}))}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {getMissingFieldsForStage(lead, targetStage).length === 0 && (
            <p className="text-sm text-gray-500 py-2">All required fields are complete. Ready to advance!</p>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAdvance}
              disabled={saving || !canProceed || getMissingFieldsForStage({ ...lead, ...missingValues }, targetStage).length > 0}
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