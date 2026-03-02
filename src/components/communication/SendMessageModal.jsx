/**
 * Send Message Modal
 * Opens from LeadDetail or EventDetail.
 * Picks a template, resolves merge tags, allows editing before send.
 */
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageSquare, Loader2, CheckCircle2, Send } from "lucide-react";
import { MessageAPI } from "../api/secureApi";

const CATEGORY_LABELS = {
  new_lead: "New Lead",
  quote_followup: "Quote Follow-Up",
  planning_reminder: "Planning Reminder",
  final_call: "Final Call",
  post_event_survey: "Post-Event Survey",
  deposit_reminder: "Deposit Reminder",
  booking_confirmation: "Booking Confirmation",
  dj_briefing: "DJ Briefing",
  general: "General",
};

export default function SendMessageModal({ open, onClose, lead = null, event = null, contact = null, relatedType, relatedId, relatedName }) {
  const [channel, setChannel] = useState("email");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [user, setUser] = useState(null);

  const { data: templates = [] } = useQuery({
    queryKey: ["message-templates"],
    queryFn: () => base44.entities.MessageTemplate.filter({ is_active: true }, "name", 100),
  });

  const filteredTemplates = templates.filter(t => t.channel === channel || t.channel === "both");

  const applyTemplate = async (tmpl) => {
    setSelectedTemplateId(tmpl.id);
    setSubject(tmpl.subject || "");
    setBody(tmpl.body || "");
    // Preview via backend for accurate merge tag resolution
    const preview = await MessageAPI.preview(
      tmpl.id, tmpl.body || "", tmpl.subject || "",
      lead?.id, event?.id, contact?.id
    ).catch(() => null);
    if (preview) {
      if (preview.subject) setSubject(preview.subject);
      if (preview.body)    setBody(preview.body);
    }
  };

  const handleSend = async () => {
    setSending(true);
    const tmpl = templates.find(t => t.id === selectedTemplateId);
    await MessageAPI.send({
      channel,
      subject,
      body,
      template_id: selectedTemplateId,
      template_name: tmpl?.name || "",
      related_type:  relatedType,
      related_id:    relatedId,
      related_name:  relatedName,
      lead_id:   lead?.id,
      event_id:  event?.id,
      contact_id: contact?.id,
    });
    setSending(false);
    setSent(true);
    setTimeout(() => { setSent(false); onClose(); }, 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-4 h-4 text-violet-600" /> Send Message
            {relatedName && <Badge variant="secondary" className="text-xs">{relatedName}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={channel} onValueChange={v => { setChannel(v); setSelectedTemplateId(""); setSubject(""); setBody(""); }}>
          <TabsList className="mb-4">
            <TabsTrigger value="email"><Mail className="w-3.5 h-3.5 mr-1.5" />Email</TabsTrigger>
            <TabsTrigger value="sms"><MessageSquare className="w-3.5 h-3.5 mr-1.5" />SMS</TabsTrigger>
          </TabsList>

          {["email", "sms"].map(ch => (
            <TabsContent key={ch} value={ch} className="space-y-4">
              {/* Template picker */}
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">Load Template</Label>
                <Select value={selectedTemplateId} onValueChange={id => {
                  const t = templates.find(x => x.id === id);
                  if (t) applyTemplate(t);
                }}>
                  <SelectTrigger><SelectValue placeholder="Choose a template…" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
                      const catTmpls = filteredTemplates.filter(t => t.category === cat);
                      if (catTmpls.length === 0) return null;
                      return (
                        <React.Fragment key={cat}>
                          <div className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</div>
                          {catTmpls.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </React.Fragment>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Email subject */}
              {ch === "email" && (
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">Subject</Label>
                  <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject…" />
                </div>
              )}

              {/* Body */}
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">Message</Label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder={ch === "sms" ? "SMS message…" : "Email body…"}
                  rows={ch === "sms" ? 4 : 10}
                  className="w-full text-sm border border-input rounded-md px-3 py-2 bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                />
                {ch === "sms" && (
                  <p className="text-[10px] text-gray-400 mt-1">{body.length} / 160 chars (1 SMS segment)</p>
                )}
              </div>

              {/* To */}
              <div className="text-xs text-gray-400 flex gap-4">
                {ch === "email" && <span>To: <span className="text-gray-600 font-medium">{lead?.email || event?.contact_email || "—"}</span></span>}
                {ch === "sms"   && <span>To: <span className="text-gray-600 font-medium">{lead?.phone || event?.contact_phone || "—"}</span></span>}
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button
                  onClick={handleSend}
                  disabled={!body.trim() || sending || sent}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  {sent ? <><CheckCircle2 className="w-4 h-4 mr-1.5" />Sent!</> :
                   sending ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Sending…</> :
                   <><Send className="w-4 h-4 mr-1.5" />Send {ch === "sms" ? "SMS" : "Email"}</>}
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}