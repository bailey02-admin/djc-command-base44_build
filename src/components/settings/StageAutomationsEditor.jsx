import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Zap } from "lucide-react";

const TRIGGER_OPTIONS = [
  { value: "on_enter", label: "On Enter" },
  { value: "on_exit", label: "On Exit" },
];

const ACTION_TYPE_OPTIONS = [
  { value: "create_task",   label: "Create Task" },
  { value: "assign_owner",  label: "Assign / Reassign Owner" },
  { value: "log_activity",  label: "Log System Activity" },
  { value: "send_message",  label: "Send Template Message" },
  { value: "sla_rule",      label: "Apply SLA Rule" },
];

const ASSIGNEE_RULES = [
  { value: "assigned_rep", label: "Current Assigned Rep" },
  { value: "actor",        label: "Person who moved the stage" },
  { value: "specific_email", label: "Specific Email…" },
];

const PRIORITIES = ["low", "medium", "high", "urgent"];
const ACTIVITY_TYPES = ["note", "call", "email", "stage_change", "system"];
const RECIPIENT_RULES = [
  { value: "client_email",  label: "Client Email" },
  { value: "assigned_rep",  label: "Assigned Rep Email" },
];
const SLA_ACTIONS = [
  { value: "start",  label: "Start SLA Timer" },
  { value: "reset",  label: "Reset SLA Timer" },
  { value: "clear",  label: "Clear SLA (not applicable)" },
];

function generateRuleId() {
  return `auto_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function NativeSelect({ value, onChange, children, className = "" }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-violet-400 ${className}`}
    >
      {children}
    </select>
  );
}

function PayloadEditor({ actionType, payload, onChange }) {
  const set = (key, value) => onChange({ ...payload, [key]: value });

  if (actionType === "create_task") return (
    <div className="grid sm:grid-cols-2 gap-2.5">
      <div className="sm:col-span-2">
        <Label className="text-[11px] text-gray-500">
          Task Title{" "}
          <span className="font-normal text-gray-400">(supports {`{{client_name}}`})</span>
        </Label>
        <Input
          className="mt-1 text-xs h-7"
          value={payload.title || ""}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Follow up with {{client_name}}"
        />
      </div>
      <div>
        <Label className="text-[11px] text-gray-500">Assign To</Label>
        <NativeSelect className="mt-1" value={payload.assignee_rule || "assigned_rep"} onChange={(v) => set("assignee_rule", v)}>
          {ASSIGNEE_RULES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </NativeSelect>
        {payload.assignee_rule === "specific_email" && (
          <Input className="mt-1 text-xs h-7" placeholder="rep@company.com" value={payload.assignee_email || ""} onChange={(e) => set("assignee_email", e.target.value)} />
        )}
      </div>
      <div>
        <Label className="text-[11px] text-gray-500">Due Offset (days)</Label>
        <Input className="mt-1 text-xs h-7" type="number" min="0" value={payload.due_offset_days ?? ""} onChange={(e) => set("due_offset_days", e.target.value ? Number(e.target.value) : null)} placeholder="e.g. 1" />
      </div>
      <div>
        <Label className="text-[11px] text-gray-500">Priority</Label>
        <NativeSelect className="mt-1" value={payload.priority || "medium"} onChange={(v) => set("priority", v)}>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </NativeSelect>
      </div>
    </div>
  );

  if (actionType === "assign_owner") return (
    <div>
      <Label className="text-[11px] text-gray-500">Assign To</Label>
      <NativeSelect className="mt-1" value={payload.assignee_rule || "assigned_rep"} onChange={(v) => set("assignee_rule", v)}>
        {ASSIGNEE_RULES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </NativeSelect>
      {payload.assignee_rule === "specific_email" && (
        <Input className="mt-1 text-xs h-7" placeholder="rep@company.com" value={payload.assignee_email || ""} onChange={(e) => set("assignee_email", e.target.value)} />
      )}
    </div>
  );

  if (actionType === "log_activity") return (
    <div className="space-y-2.5">
      <div>
        <Label className="text-[11px] text-gray-500">Activity Type</Label>
        <NativeSelect className="mt-1" value={payload.activity_type || "note"} onChange={(v) => set("activity_type", v)}>
          {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </NativeSelect>
      </div>
      <div>
        <Label className="text-[11px] text-gray-500">Note Template</Label>
        <Textarea className="mt-1 text-xs min-h-[56px]" value={payload.note_template || ""} onChange={(e) => set("note_template", e.target.value)} placeholder="Lead {{client_name}} moved to this stage." />
      </div>
    </div>
  );

  if (actionType === "send_message") return (
    <div className="grid sm:grid-cols-2 gap-2.5">
      <div className="sm:col-span-2">
        <Label className="text-[11px] text-gray-500">Template ID</Label>
        <Input className="mt-1 text-xs h-7" value={payload.template_id || ""} onChange={(e) => set("template_id", e.target.value)} placeholder="Template ID from Message Templates page" />
      </div>
      <div>
        <Label className="text-[11px] text-gray-500">Channel</Label>
        <NativeSelect className="mt-1" value={payload.channel || "email"} onChange={(v) => set("channel", v)}>
          <option value="email">Email</option>
          <option value="sms">SMS</option>
        </NativeSelect>
      </div>
      <div>
        <Label className="text-[11px] text-gray-500">Recipient</Label>
        <NativeSelect className="mt-1" value={payload.recipient_rule || "client_email"} onChange={(v) => set("recipient_rule", v)}>
          {RECIPIENT_RULES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </NativeSelect>
      </div>
    </div>
  );

  if (actionType === "sla_rule") return (
    <div>
      <Label className="text-[11px] text-gray-500">SLA Action</Label>
      <NativeSelect className="mt-1" value={payload.sla_action || "start"} onChange={(v) => set("sla_action", v)}>
        {SLA_ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
      </NativeSelect>
    </div>
  );

  return null;
}

const DEFAULT_PAYLOADS = {
  create_task:   { title: "", assignee_rule: "assigned_rep", due_offset_days: 1, priority: "medium" },
  assign_owner:  { assignee_rule: "assigned_rep" },
  log_activity:  { activity_type: "note", note_template: "" },
  send_message:  { template_id: "", channel: "email", recipient_rule: "client_email" },
  sla_rule:      { sla_action: "start" },
};

export default function StageAutomationsEditor({ automations = [], onChange }) {
  const addRule = () => {
    const action_type = "create_task";
    onChange([...automations, {
      id: generateRuleId(),
      trigger: "on_enter",
      action_type,
      is_active: true,
      payload: { ...DEFAULT_PAYLOADS[action_type] },
    }]);
  };

  const removeRule = (id) => onChange(automations.filter((r) => r.id !== id));

  const updateRule = (id, patch) =>
    onChange(automations.map((r) => r.id === id ? { ...r, ...patch } : r));

  const updatePayload = (id, payload) =>
    onChange(automations.map((r) => r.id === id ? { ...r, payload } : r));

  const handleActionTypeChange = (id, action_type) =>
    onChange(automations.map((r) => r.id === id
      ? { ...r, action_type, payload: { ...DEFAULT_PAYLOADS[action_type] } }
      : r));

  const triggerLabel = { on_enter: "On Enter", on_exit: "On Exit" };
  const actionLabel = Object.fromEntries(ACTION_TYPE_OPTIONS.map((o) => [o.value, o.label]));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-violet-500" />
          <Label className="text-xs font-semibold text-gray-700">Automation Rules</Label>
          {automations.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{automations.length}</Badge>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addRule} className="h-7 text-xs gap-1">
          <Plus className="w-3 h-3" /> Add Rule
        </Button>
      </div>

      {automations.length === 0 && (
        <p className="text-xs text-gray-400 py-4 text-center border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
          No automation rules. Click "Add Rule" to trigger actions on stage entry or exit.
        </p>
      )}

      <div className="space-y-2">
        {automations.map((rule, idx) => (
          <div key={rule.id} className={`border rounded-lg p-3 space-y-3 ${rule.is_active !== false ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100 opacity-60"}`}>
            {/* Rule header */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">{idx + 1}.</span>
              <NativeSelect
                className="w-28 flex-shrink-0"
                value={rule.trigger}
                onChange={(v) => updateRule(rule.id, { trigger: v })}
              >
                {TRIGGER_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </NativeSelect>
              <NativeSelect
                className="flex-1 min-w-[160px]"
                value={rule.action_type}
                onChange={(v) => handleActionTypeChange(rule.id, v)}
              >
                {ACTION_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </NativeSelect>
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={rule.is_active !== false}
                  onChange={(e) => updateRule(rule.id, { is_active: e.target.checked })}
                />
                Active
              </label>
              <button
                type="button"
                onClick={() => removeRule(rule.id)}
                className="text-gray-300 hover:text-red-400 transition-colors p-0.5 flex-shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Payload editor */}
            <div className="ml-4 pl-3 border-l border-gray-100">
              <PayloadEditor
                actionType={rule.action_type}
                payload={rule.payload || {}}
                onChange={(payload) => updatePayload(rule.id, payload)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}