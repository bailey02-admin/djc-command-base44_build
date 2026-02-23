import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import {
  Phone, Mail, MessageSquare, FileText, Send, Loader2,
  PhoneCall, PhoneMissed, PhoneOff, CheckCircle2, Clock
} from "lucide-react";

const TYPE_ICONS = {
  call:          { icon: Phone, color: "text-blue-500", bg: "bg-blue-50" },
  email:         { icon: Mail, color: "text-indigo-500", bg: "bg-indigo-50" },
  text:          { icon: MessageSquare, color: "text-violet-500", bg: "bg-violet-50" },
  note:          { icon: FileText, color: "text-gray-500", bg: "bg-gray-100" },
  status_change: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50" },
  client_message:{ icon: MessageSquare, color: "text-pink-500", bg: "bg-pink-50" },
  task_created:  { icon: Clock, color: "text-amber-500", bg: "bg-amber-50" },
  system:        { icon: CheckCircle2, color: "text-gray-400", bg: "bg-gray-50" },
};

const OUTCOME_ICONS = {
  connected:      <PhoneCall className="w-3 h-3 text-emerald-500" />,
  left_voicemail: <PhoneOff className="w-3 h-3 text-amber-500" />,
  no_answer:      <PhoneMissed className="w-3 h-3 text-red-400" />,
};

export default function ActivityFeed({ activities = [], relatedId, relatedName, relatedType = "lead", queryKey }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState("note"); // note | call | email | text
  const [text, setText] = useState("");
  const [callOutcome, setCallOutcome] = useState("connected");
  const [callDuration, setCallDuration] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [isInternal, setIsInternal] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);

    const activity = {
      type: mode,
      subject: mode === "call" ? `Call — ${callOutcome.replace(/_/g, " ")}` : mode === "email" ? "Email sent" : mode === "text" ? "Text sent" : "Note",
      description: text,
      related_type: relatedType,
      related_id: relatedId,
      related_name: relatedName,
      is_internal: isInternal,
      direction: ["call","email","text"].includes(mode) ? "outbound" : undefined,
      ...(mode === "call" && {
        outcome: callOutcome,
        call_duration_seconds: callDuration ? Number(callDuration) * 60 : undefined,
        next_step: nextStep || undefined,
      }),
    };

    await base44.entities.Activity.create(activity);
    setText("");
    setNextStep("");
    setCallDuration("");
    setSaving(false);
    queryClient.invalidateQueries([queryKey]);
    queryClient.invalidateQueries(["activities", relatedId]);
    queryClient.invalidateQueries(["event-activities", relatedId]);
  };

  return (
    <div className="space-y-4">
      {/* Log action bar */}
      <div className="border rounded-xl bg-white p-4 space-y-3">
        <div className="flex gap-1">
          {[
            { key: "note", label: "Note", icon: FileText },
            { key: "call", label: "Call", icon: Phone },
            { key: "email", label: "Email", icon: Mail },
            { key: "text", label: "Text", icon: MessageSquare },
          ].map(m => {
            const Icon = m.icon;
            return (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  mode === m.key ? "bg-violet-100 text-violet-700" : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />{m.label}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
            <button
              onClick={() => setIsInternal(!isInternal)}
              className={`px-2 py-1 rounded text-[10px] border transition-colors ${isInternal ? "bg-gray-100 text-gray-500 border-gray-200" : "bg-green-50 text-green-700 border-green-200"}`}
            >
              {isInternal ? "Internal" : "Client-visible"}
            </button>
          </div>
        </div>

        {mode === "call" && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Select value={callOutcome} onValueChange={setCallOutcome}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="connected">Connected</SelectItem>
                  <SelectItem value="left_voicemail">Left Voicemail</SelectItem>
                  <SelectItem value="no_answer">No Answer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="Duration (mins)" value={callDuration} onChange={e => setCallDuration(e.target.value)} className="h-8 text-xs" type="number" />
            <Input placeholder="Next step" value={nextStep} onChange={e => setNextStep(e.target.value)} className="h-8 text-xs" />
          </div>
        )}

        <div className="flex gap-2">
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={
              mode === "call" ? "Call notes..." :
              mode === "email" ? "Email summary..." :
              mode === "text" ? "Text message..." :
              "Add internal note..."
            }
            rows={2}
            className="text-sm resize-none"
          />
          <Button onClick={handleSave} disabled={saving || !text.trim()} size="sm" className="self-end bg-violet-600 hover:bg-violet-700">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Activity list */}
      <div className="space-y-2">
        {activities.map(act => {
          const meta = TYPE_ICONS[act.type] || TYPE_ICONS.note;
          const Icon = meta.icon;
          return (
            <div key={act.id} className={`flex gap-3 p-3 rounded-lg ${act.is_internal ? "bg-gray-50/70" : "bg-white border border-gray-100"}`}>
              <div className={`w-8 h-8 rounded-full ${meta.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">{act.subject}</p>
                  {act.outcome && OUTCOME_ICONS[act.outcome] && (
                    <span className="flex items-center gap-1">{OUTCOME_ICONS[act.outcome]}</span>
                  )}
                  {act.is_internal && <Badge variant="secondary" className="text-[9px] py-0">internal</Badge>}
                  {act.is_client_visible && <Badge variant="secondary" className="text-[9px] py-0 bg-green-50 text-green-700">client</Badge>}
                </div>
                {act.description && <p className="text-xs text-gray-500 mt-0.5">{act.description}</p>}
                {act.next_step && <p className="text-xs text-violet-600 mt-1 font-medium">→ {act.next_step}</p>}
                <p className="text-[10px] text-gray-300 mt-1">{act.performed_by ? `${act.performed_by} · ` : ""}{format(new Date(act.created_date), "MMM d, h:mm a")}</p>
              </div>
            </div>
          );
        })}
        {activities.length === 0 && <p className="text-center text-gray-400 text-xs py-6">No activity yet</p>}
      </div>
    </div>
  );
}