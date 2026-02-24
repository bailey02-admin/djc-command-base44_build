import React, { useState } from "react";
import { TaskAPI } from "../api/secureApi";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";

export default function QuickTaskModal({ relatedEvent, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: "",
    due_date: "",
    priority: "medium",
    category: "finalization",
    assigned_to: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await TaskAPI.create({
      ...form,
      related_type: "event",
      related_id: relatedEvent.id,
      related_name: relatedEvent.event_name,
    });
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">New Task</DialogTitle>
          <p className="text-xs text-gray-500">{relatedEvent.event_name}</p>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Task *</Label>
            <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="mt-1 text-sm" placeholder="What needs to be done?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Due Date</Label>
              <Input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Priority</Label>
              <Select value={form.priority} onValueChange={v => setForm({...form, priority: v})}>
                <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
              <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["finalization","follow_up","call","planning","dj_prep","payment","contract","other"].map(c => (
                  <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Assign To (email)</Label>
            <Input value={form.assigned_to} onChange={e => setForm({...form, assigned_to: e.target.value})} className="mt-1 text-sm" placeholder="user@example.com" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!form.title || saving} onClick={handleSave} className="bg-violet-600 hover:bg-violet-700">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            Create Task
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}