import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ContractAPI } from "../api/secureApi";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

const EMPTY = {
  event_id: "", contact_name: "", contact_email: "",
  contract_amount: "", notes: "", status: "draft",
};

export default function ContractFormModal({ open, onClose, contract, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const { data: events = [] } = useQuery({
    queryKey: ["events-simple"],
    queryFn: () => base44.entities.Event.filter({ is_deleted: false }, "-event_date", 100),
    enabled: open,
  });

  useEffect(() => {
    if (contract) {
      setForm({ ...EMPTY, ...contract, contract_amount: contract.contract_amount?.toString() || "" });
    } else {
      setForm(EMPTY);
    }
  }, [contract, open]);

  // Auto-fill contact info when event is selected
  useEffect(() => {
    if (!contract && form.event_id) {
      const event = events.find(e => e.id === form.event_id);
      if (event) {
        setForm(f => ({
          ...f,
          contact_name: f.contact_name || event.contact_name || "",
          contact_email: f.contact_email || event.contact_email || "",
          contract_amount: f.contract_amount || event.package_price?.toString() || "",
        }));
      }
    }
  }, [form.event_id, events]);

  const handleSave = async () => {
    if (!form.event_id || !form.contact_name) return toast.error("Event and contact name are required.");
    setSaving(true);
    const payload = { ...form, contract_amount: Number(form.contract_amount) || 0 };
    if (contract?.id) {
      await ContractAPI.update(contract.id, payload);
      toast.success("Contract updated.");
    } else {
      await ContractAPI.create(payload);
      toast.success("Contract created.");
    }
    setSaving(false);
    onSaved?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{contract ? "Edit Contract" : "New Contract"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Linked Event *</Label>
            <Select value={form.event_id} onValueChange={v => setForm(f => ({ ...f, event_id: v }))}>
              <SelectTrigger className="mt-1 text-sm"><SelectValue placeholder="Select event..." /></SelectTrigger>
              <SelectContent>
                {events.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.event_name} — {e.event_date}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Contact Name *</Label>
              <Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Contact Email</Label>
              <Input type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} className="mt-1 text-sm" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Contract Amount ($)</Label>
            <Input type="number" value={form.contract_amount} onChange={e => setForm(f => ({ ...f, contract_amount: e.target.value }))} className="mt-1 text-sm" placeholder="0.00" />
          </div>
          <div>
            <Label className="text-xs">Notes / Terms</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="mt-1 text-sm" rows={3} placeholder="Contract terms, inclusions, etc." />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              {contract ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}