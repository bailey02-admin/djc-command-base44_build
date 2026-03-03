import React, { useState, useEffect } from "react";
import { differenceInDays, format } from "date-fns";
import { Lock, AlertTriangle, CheckCircle2, Music, Clock, Star, Loader2, Save, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";

export default function PortalPlanningHub({ bundle, eventId }) {
  const { event, planning: initialPlanning, musicSelections = [], timeline = [] } = bundle;
  const queryClient = useQueryClient();

  const [form, setForm] = useState(initialPlanning || {});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  useEffect(() => {
    if (initialPlanning) setForm(initialPlanning);
  }, [initialPlanning]);

  const isLocked = event.planning_lock_at && new Date() >= new Date(event.planning_lock_at);
  const lockWarning = !isLocked && event.planning_lock_at &&
    differenceInDays(new Date(event.planning_lock_at), new Date()) <= 7;

  const isSubmitted = !!event.planning_submitted_at;

  const savePlanning = async () => {
    setSaving(true);
    await base44.functions.invoke("clientPortalSave", {
      action: "save_planning",
      event_id: eventId,
      data: form,
    });
    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ["portal-event", eventId] });
  };

  const submitPlanning = async () => {
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const res = await base44.functions.invoke("portalSubmitPlanning", { event_id: eventId });
      setSubmitResult(res.data);
      if (res.data?.success) {
        queryClient.invalidateQueries({ queryKey: ["portal-event", eventId] });
      }
    } catch (e) {
      // 422 errors from the SDK land here — extract the response body
      const errData = e?.response?.data || { error: e?.message || "Submission failed" };
      setSubmitResult(errData);
    } finally {
      setSubmitting(false);
    }
  };

  const field = (key, label, Component = Input, extraProps = {}) => (
    <div>
      <Label className="text-xs text-gray-600">{label}</Label>
      <Component
        value={form[key] || ""}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        disabled={isLocked}
        className="mt-1"
        {...extraProps}
      />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Lock / Warning banners */}
      {isLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start">
          <Lock className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-800 text-sm">Planning is locked</p>
            <p className="text-xs text-amber-600 mt-0.5">
              The deadline to submit your planning form has passed.
              Please contact your event coordinator if you need to make changes.
            </p>
          </div>
        </div>
      )}
      {lockWarning && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex gap-3 items-start">
          <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-yellow-800 text-sm">Planning closes soon</p>
            <p className="text-xs text-yellow-600 mt-0.5">
              Planning locks on {format(new Date(event.planning_lock_at), "MMMM d")} — please submit before then.
            </p>
          </div>
        </div>
      )}

      {/* Status */}
      <div className="flex items-center gap-3">
        <h2 className="font-bold text-gray-900 text-lg">Planning Hub</h2>
        {isSubmitted && (
          <Badge className="bg-emerald-50 text-emerald-700 border-0 text-xs gap-1">
            <CheckCircle2 className="w-3 h-3" /> Submitted
          </Badge>
        )}
      </div>

      {/* Navigation cards for Music / Timeline / Special Songs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link to={createPageUrl(`ClientPortal?view=music&event_id=${eventId}`)}>
          <Card className="border border-gray-100 shadow-sm hover:border-violet-200 hover:shadow-md transition-all cursor-pointer">
            <CardContent className="pt-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
                <Music className="w-4 h-4 text-violet-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">Music</p>
                <p className="text-xs text-gray-400">{musicSelections.length} song{musicSelections.length !== 1 ? "s" : ""} added</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </CardContent>
          </Card>
        </Link>
        <Link to={createPageUrl(`ClientPortal?view=special_songs&event_id=${eventId}`)}>
          <Card className="border border-gray-100 shadow-sm hover:border-pink-200 hover:shadow-md transition-all cursor-pointer">
            <CardContent className="pt-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-pink-50 flex items-center justify-center">
                <Star className="w-4 h-4 text-pink-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">Special Songs</p>
                <p className="text-xs text-gray-400">First dance, entrance & more</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </CardContent>
          </Card>
        </Link>
        <Link to={createPageUrl(`ClientPortal?view=timeline&event_id=${eventId}`)}>
          <Card className="border border-gray-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer">
            <CardContent className="pt-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Clock className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">Timeline</p>
                <p className="text-xs text-gray-400">{timeline.length} segment{timeline.length !== 1 ? "s" : ""}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Planning Form */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Planning Questionnaire</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {field("bride_full_name", "Bride / Partner 1 Full Name")}
            {field("groom_full_name", "Groom / Partner 2 Full Name")}
            {field("bride_pronunciation", "Partner 1 Pronunciation", Input, { placeholder: "How to say it" })}
            {field("groom_pronunciation", "Partner 2 Pronunciation", Input, { placeholder: "How to say it" })}
          </div>

          <div>
            <Label className="text-xs text-gray-600">Formality Level</Label>
            <Select
              value={form.formality_level || "semi_formal"}
              onValueChange={v => setForm({ ...form, formality_level: v })}
              disabled={isLocked}
            >
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["very_formal", "formal", "semi_formal", "casual", "fun_party"].map(f => (
                  <SelectItem key={f} value={f}>{f.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {field("vibe_description", "Describe the vibe you want", Textarea, {
            rows: 2, placeholder: "Fun and upbeat? Elegant? A mix?"
          })}

          <div>
            <Label className="text-xs text-gray-600 mb-1 block">
              DJ Freedom Level: {form.dj_freedom_level || 5}/10
            </Label>
            <p className="text-[10px] text-gray-400 mb-2">1 = Strict playlist only · 10 = Read the room</p>
            <Slider
              value={[form.dj_freedom_level || 5]}
              onValueChange={v => setForm({ ...form, dj_freedom_level: v[0] })}
              max={10} min={1} step={1}
              disabled={isLocked}
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={form.explicit_lyrics_ok || false}
              onCheckedChange={v => setForm({ ...form, explicit_lyrics_ok: v })}
              disabled={isLocked}
            />
            <Label className="text-xs text-gray-600">OK to play songs with explicit lyrics</Label>
          </div>

          {field("special_announcements", "Special Announcements", Textarea, { rows: 2 })}
          {field("notes_to_dj", "Notes to DJ", Textarea, {
            rows: 3, placeholder: "Anything special we should know?"
          })}

          {!isLocked && (
            <Button onClick={savePlanning} disabled={saving} variant="outline" className="w-full gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Draft
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      {!isLocked && (
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-start gap-3">
              <Star className="w-5 h-5 text-violet-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-900 text-sm">Ready to submit?</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Once you're happy with your answers, submit your planning form to let your team know it's complete.
                  You can still edit it until the planning deadline.
                </p>
              </div>
            </div>

            {submitResult?.error && (
              <div className="bg-red-50 text-red-700 text-xs rounded-lg p-3">
                <p className="font-semibold mb-1">
                  {submitResult.error === "INCOMPLETE_PLANNING"
                    ? "Please complete the following before submitting:"
                    : submitResult.error}
                </p>
                {submitResult.missing?.length > 0 && (
                  <ul className="list-disc ml-4 space-y-0.5">
                    {submitResult.missing.map(f => (
                      <li key={f}>{f.replace(/_/g, " ").replace(/:/g, " → ")}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {submitResult?.success && (
              <div className="bg-emerald-50 text-emerald-700 text-xs rounded-lg p-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Planning submitted successfully!
              </div>
            )}

            <Button
              onClick={submitPlanning}
              disabled={submitting}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Submit Planning Form
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}