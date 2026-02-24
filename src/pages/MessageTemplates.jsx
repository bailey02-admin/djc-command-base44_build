/**
 * Message Templates Management Page
 * CRUD for email/SMS templates with merge tag reference.
 */
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail, MessageSquare, Plus, Edit, Trash2, Loader2, Copy, Zap } from "lucide-react";
import { seedDefaultTemplates } from "../components/crm/messaging";

const CATEGORIES = [
  "new_lead","quote_followup","planning_reminder","final_call",
  "post_event_survey","deposit_reminder","booking_confirmation","dj_briefing","general"
];

const MERGE_TAGS = [
  "{{client_first_name}}","{{client_last_name}}","{{partner_first_name}}",
  "{{event_date}}","{{event_type}}","{{venue_name}}","{{city}}",
  "{{package_name}}","{{total_fee}}","{{deposit_amount}}","{{quote_amount}}",
  "{{assigned_rep}}","{{assigned_dj}}","{{contact_name}}","{{contact_email}}",
  "{{contact_phone}}","{{company_name}}","{{portal_link}}",
];

const EMPTY = { name: "", category: "general", channel: "email", subject: "", body: "", auto_trigger: "", is_active: true, notes: "" };

export default function MessageTemplates() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterChannel, setFilterChannel] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["message-templates"],
    queryFn: () => base44.entities.MessageTemplate.list("name", 100),
  });

  const filtered = templates.filter(t =>
    (filterChannel === "all" || t.channel === filterChannel) &&
    (filterCategory === "all" || t.category === filterCategory)
  );

  const openNew  = () => setEditing({ ...EMPTY });
  const openEdit = (t) => setEditing({ ...t });

  const save = async () => {
    setSaving(true);
    if (editing.id) {
      await base44.entities.MessageTemplate.update(editing.id, editing);
    } else {
      await base44.entities.MessageTemplate.create(editing);
    }
    queryClient.invalidateQueries(["message-templates"]);
    setEditing(null);
    setSaving(false);
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this template?")) return;
    await base44.entities.MessageTemplate.delete(id);
    queryClient.invalidateQueries(["message-templates"]);
  };

  const handleSeedDefaults = async () => {
    setSeeding(true);
    await seedDefaultTemplates();
    queryClient.invalidateQueries(["message-templates"]);
    setSeeding(false);
  };

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Message Templates</h1>
          <p className="text-sm text-gray-500 mt-0.5">Email & SMS templates with merge tags</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSeedDefaults} disabled={seeding}>
            {seeding ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Zap className="w-4 h-4 mr-1.5" />}
            Seed Defaults
          </Button>
          <Button onClick={openNew} className="bg-violet-600 hover:bg-violet-700">
            <Plus className="w-4 h-4 mr-1.5" />New Template
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filterChannel} onValueChange={setFilterChannel}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g," ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-gray-400 self-center">{filtered.length} templates</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-500" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <p className="text-gray-400 mb-4">No templates yet. Seed the defaults to get started.</p>
            <Button onClick={handleSeedDefaults} disabled={seeding} variant="outline">
              <Zap className="w-4 h-4 mr-1.5" />Seed Default Templates
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map(t => (
            <Card key={t.id} className={`border-0 shadow-sm ${!t.is_active ? "opacity-50" : ""}`}>
              <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {t.channel === "email" ? <Mail className="w-3.5 h-3.5 text-violet-500" /> : <MessageSquare className="w-3.5 h-3.5 text-blue-500" />}
                    <CardTitle className="text-sm font-semibold truncate">{t.name}</CardTitle>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    <Badge variant="secondary" className="text-[9px] capitalize">{t.category?.replace(/_/g," ")}</Badge>
                    <Badge variant="outline" className="text-[9px]">{t.channel}</Badge>
                    {t.auto_trigger && <Badge variant="outline" className="text-[9px] border-violet-200 text-violet-600">auto: {t.auto_trigger}</Badge>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(t)}><Edit className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => remove(t.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {t.subject && <p className="text-xs text-gray-500 mb-1 font-medium">Subject: {t.subject}</p>}
                <p className="text-xs text-gray-400 line-clamp-3 whitespace-pre-wrap">{t.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Merge Tag Reference */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Available Merge Tags</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {MERGE_TAGS.map(tag => (
              <button
                key={tag}
                className="font-mono text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-violet-50 hover:text-violet-700 transition-colors"
                onClick={() => navigator.clipboard?.writeText(tag)}
                title="Click to copy"
              >
                {tag}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-2">Click any tag to copy it to clipboard.</p>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit Template" : "New Template"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Name *</Label>
                  <Input value={editing.name} onChange={e => setEditing(p => ({...p, name: e.target.value}))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Channel</Label>
                  <Select value={editing.channel} onValueChange={v => setEditing(p => ({...p, channel: v}))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Category</Label>
                  <Select value={editing.category} onValueChange={v => setEditing(p => ({...p, category: v}))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g," ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Auto Trigger Stage</Label>
                  <Input value={editing.auto_trigger || ""} onChange={e => setEditing(p => ({...p, auto_trigger: e.target.value}))} className="mt-1" placeholder="e.g. quote_sent" />
                </div>
              </div>
              {editing.channel !== "sms" && (
                <div>
                  <Label className="text-xs">Subject</Label>
                  <Input value={editing.subject || ""} onChange={e => setEditing(p => ({...p, subject: e.target.value}))} className="mt-1" />
                </div>
              )}
              <div>
                <Label className="text-xs">Body *</Label>
                <textarea
                  value={editing.body || ""}
                  onChange={e => setEditing(p => ({...p, body: e.target.value}))}
                  rows={editing.channel === "sms" ? 4 : 10}
                  className="mt-1 w-full text-sm border border-input rounded-md px-3 py-2 bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y font-mono"
                  placeholder="Use {{merge_tags}} for dynamic fields"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button onClick={save} disabled={!editing.name || !editing.body || saving} className="bg-violet-600 hover:bg-violet-700">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}Save Template
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}