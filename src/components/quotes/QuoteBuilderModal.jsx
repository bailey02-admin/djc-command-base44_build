import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QuoteAPI, LeadAPI } from "../api/secureApi";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

const EMPTY = {
  lead_id: "", contact_name: "", package_name: "", base_price: "",
  add_ons: [], discount_amount: 0, travel_fee: 0, tax_amount: 0,
  total_amount: 0, valid_until: "", notes: "", status: "draft",
};

export default function QuoteBuilderModal({ open, onClose, quote, onSaved, preselectedLeadId }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  // Fetch leads for linking
  const { data: leads = [] } = useQuery({
    queryKey: ["leads-simple"],
    queryFn: () => base44.entities.Lead.filter({ is_deleted: false }, "-created_date", 100),
    enabled: open,
  });

  useEffect(() => {
    if (quote) {
      setForm({ ...EMPTY, ...quote, base_price: quote.base_price?.toString() || "", add_ons: quote.add_ons || [] });
    } else if (preselectedLeadId) {
      const lead = leads.find(l => l.id === preselectedLeadId);
      setForm({ ...EMPTY, lead_id: preselectedLeadId, contact_name: lead ? `${lead.client_first_name} ${lead.client_last_name}` : "" });
    } else {
      setForm(EMPTY);
    }
  }, [quote, open, preselectedLeadId]);

  // Auto-fill contact_name when lead changes
  useEffect(() => {
    if (!quote && form.lead_id) {
      const lead = leads.find(l => l.id === form.lead_id);
      if (lead) setForm(f => ({ ...f, contact_name: `${lead.client_first_name} ${lead.client_last_name}` }));
    }
  }, [form.lead_id, leads]);

  // Recalculate total
  const basePrice = Number(form.base_price) || 0;
  const addOnsTotal = (form.add_ons || []).reduce((s, a) => s + (Number(a.price) || 0), 0);
  const discount = Number(form.discount_amount) || 0;
  const travel = Number(form.travel_fee) || 0;
  const tax = Number(form.tax_amount) || 0;
  const total = Math.max(0, basePrice + addOnsTotal - discount + travel + tax);

  const addAddon = () => setForm(f => ({ ...f, add_ons: [...(f.add_ons || []), { name: "", price: "" }] }));
  const updateAddon = (i, field, val) => setForm(f => {
    const add_ons = [...(f.add_ons || [])];
    add_ons[i] = { ...add_ons[i], [field]: val };
    return { ...f, add_ons };
  });
  const removeAddon = (i) => setForm(f => ({ ...f, add_ons: f.add_ons.filter((_, idx) => idx !== i) }));

  const handleSave = async () => {
    if (!form.package_name) return toast.error("Package name is required.");
    if (!form.lead_id) return toast.error("Please link this quote to a lead.");
    setSaving(true);
    const payload = {
      ...form,
      base_price: basePrice,
      add_ons: (form.add_ons || []).map(a => ({ name: a.name, price: Number(a.price) || 0 })),
      discount_amount: discount,
      travel_fee: travel,
      tax_amount: tax,
      total_amount: total,
    };
    if (quote?.id) {
      await QuoteAPI.update(quote.id, payload);
      toast.success("Quote updated.");
    } else {
      await QuoteAPI.create(payload);
      toast.success("Quote created.");
    }
    setSaving(false);
    onSaved?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{quote ? "Edit Quote" : "New Quote"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Lead link + contact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Link to Lead *</Label>
              <Select value={form.lead_id} onValueChange={v => setForm(f => ({ ...f, lead_id: v }))}>
                <SelectTrigger className="mt-1 text-sm"><SelectValue placeholder="Select lead..." /></SelectTrigger>
                <SelectContent>
                  {leads.map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.client_first_name} {l.client_last_name} — {l.event_type?.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Contact Name</Label>
              <Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} className="mt-1 text-sm" placeholder="Auto-filled from lead" />
            </div>
          </div>

          {/* Package + validity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Package Name *</Label>
              <Input value={form.package_name} onChange={e => setForm(f => ({ ...f, package_name: e.target.value }))} className="mt-1 text-sm" placeholder="e.g. Premium DJ Package" />
            </div>
            <div>
              <Label className="text-xs">Valid Until</Label>
              <Input type="date" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} className="mt-1 text-sm" />
            </div>
          </div>

          <Separator />

          {/* Pricing */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Pricing</h3>
            <div>
              <Label className="text-xs">Base Price</Label>
              <Input type="number" value={form.base_price} onChange={e => setForm(f => ({ ...f, base_price: e.target.value }))} className="mt-1 text-sm w-48" placeholder="0.00" />
            </div>

            {/* Add-ons */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs">Add-ons / Line Items</Label>
                <Button size="sm" variant="outline" onClick={addAddon} className="h-7 text-xs"><Plus className="w-3 h-3 mr-1" />Add Line</Button>
              </div>
              <div className="space-y-2">
                {(form.add_ons || []).map((a, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input value={a.name} onChange={e => updateAddon(i, "name", e.target.value)} placeholder="Description" className="text-sm flex-1" />
                    <Input type="number" value={a.price} onChange={e => updateAddon(i, "price", e.target.value)} placeholder="$0" className="text-sm w-28" />
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 flex-shrink-0" onClick={() => removeAddon(i)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <Label className="text-xs">Discount ($)</Label>
                <Input type="number" value={form.discount_amount} onChange={e => setForm(f => ({ ...f, discount_amount: e.target.value }))} className="mt-1 text-sm" placeholder="0" />
              </div>
              <div>
                <Label className="text-xs">Travel Fee</Label>
                <Input type="number" value={form.travel_fee} onChange={e => setForm(f => ({ ...f, travel_fee: e.target.value }))} className="mt-1 text-sm" placeholder="0" />
              </div>
              <div>
                <Label className="text-xs">Tax</Label>
                <Input type="number" value={form.tax_amount} onChange={e => setForm(f => ({ ...f, tax_amount: e.target.value }))} className="mt-1 text-sm" placeholder="0" />
              </div>
            </div>

            {/* Total */}
            <div className="mt-4 p-3 bg-violet-50 rounded-lg flex items-center justify-between">
              <span className="text-sm font-semibold text-violet-800">Total</span>
              <span className="text-xl font-bold text-violet-900">${total.toLocaleString()}</span>
            </div>
          </div>

          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="mt-1 text-sm" rows={2} placeholder="Terms, inclusions, special conditions..." />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              {quote ? "Update Quote" : "Create Quote"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}