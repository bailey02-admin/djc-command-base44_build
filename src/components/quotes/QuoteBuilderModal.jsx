import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { QuoteAPI, LeadAPI } from "../api/secureApi";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2, Save, Package } from "lucide-react";
import { toast } from "sonner";

const EMPTY_QUOTE = {
  lead_id: "", contact_name: "", package_id: null, package_name: "", package_price: null,
  base_price: "", add_ons: [], discount_amount: 0, travel_fee: 0, tax_amount: 0,
  total_amount: 0, valid_until: "", notes: "", status: "draft",
};

// Normalize legacy add_on {name, price} → {name, qty, unit_price, line_total}
function normalizeAddOn(a) {
  if (a.unit_price !== undefined) return a;
  const price = Number(a.price) || 0;
  return { name: a.name, qty: 1, unit_price: price, line_total: price };
}

export default function QuoteBuilderModal({ open, onClose, quote, onSaved, preselectedLeadId }) {
  const [form, setForm] = useState(EMPTY_QUOTE);
  const [saving, setSaving] = useState(false);
  // Local add-ons state: { add_on_id?, name, qty, unit_price, line_total }
  const [addOnRows, setAddOnRows] = useState([]);

  const { data: leadsData = [] } = useQuery({
    queryKey: ["leads-simple"],
    queryFn: () => LeadAPI.list({ is_deleted: false }, "-created_date", 100),
    enabled: open,
  });

  const { data: catalogData } = useQuery({
    queryKey: ["quote-catalog-bundle"],
    queryFn: async () => {
      const r = await base44.functions.invoke("quoteGetCatalogBundle", {});
      return r.data;
    },
    enabled: open,
    staleTime: 60_000,
  });

  const packages = catalogData?.packages || [];
  const catalogAddOns = catalogData?.addOns || [];

  useEffect(() => {
    if (quote) {
      const normalized = (quote.add_ons || []).map(normalizeAddOn);
      setForm({ ...EMPTY_QUOTE, ...quote, base_price: (quote.package_price || quote.base_price || "").toString() });
      setAddOnRows(normalized);
    } else if (preselectedLeadId) {
      const lead = leadsData.find(l => l.id === preselectedLeadId);
      setForm({ ...EMPTY_QUOTE, lead_id: preselectedLeadId, contact_name: lead ? `${lead.client_first_name} ${lead.client_last_name}` : "" });
      setAddOnRows([]);
    } else {
      setForm(EMPTY_QUOTE);
      setAddOnRows([]);
    }
  }, [quote, open, preselectedLeadId]);

  // Auto-fill contact_name when lead changes
  useEffect(() => {
    if (!quote && form.lead_id) {
      const lead = leadsData.find(l => l.id === form.lead_id);
      if (lead) setForm(f => ({ ...f, contact_name: `${lead.client_first_name} ${lead.client_last_name}` }));
    }
  }, [form.lead_id, leadsData]);

  // When a package is selected from catalog, populate pricing
  const handlePackageSelect = (pkg_id) => {
    if (!pkg_id) {
      setForm(f => ({ ...f, package_id: null, package_name: "", package_price: null, base_price: "" }));
      return;
    }
    const pkg = packages.find(p => p.id === pkg_id);
    if (!pkg) return;
    setForm(f => ({ ...f, package_id: pkg.id, package_name: pkg.name, package_price: pkg.base_price, base_price: pkg.base_price.toString() }));
  };

  // Add an add-on from catalog
  const addCatalogAddOn = (addOnId) => {
    if (!addOnId) return;
    const a = catalogAddOns.find(x => x.id === addOnId);
    if (!a) return;
    // Check if already added
    if (addOnRows.some(r => r.add_on_id === a.id)) {
      toast("Add-on already in list — adjust the quantity instead.");
      return;
    }
    setAddOnRows(rows => [...rows, { add_on_id: a.id, name: a.name, qty: 1, unit_price: a.unit_price, line_total: a.unit_price }]);
  };

  const updateQty = (i, qty) => {
    setAddOnRows(rows => rows.map((r, idx) => {
      if (idx !== i) return r;
      const q = Math.max(1, Number(qty) || 1);
      return { ...r, qty: q, line_total: q * r.unit_price };
    }));
  };

  const removeRow = (i) => setAddOnRows(rows => rows.filter((_, idx) => idx !== i));

  // Computed totals (client-side preview; server recalculates on save)
  const packagePrice = Number(form.base_price) || 0;
  const addOnsTotal = addOnRows.reduce((s, a) => s + (a.line_total || 0), 0);
  const discount = Number(form.discount_amount) || 0;
  const travel = Number(form.travel_fee) || 0;
  const tax = Number(form.tax_amount) || 0;
  const totalPreview = Math.max(0, packagePrice + addOnsTotal - discount + travel + tax);

  const handleSave = async () => {
    if (!form.lead_id) return toast.error("Please link this quote to a lead.");
    if (!form.package_name && !form.base_price) return toast.error("Select a package or enter a base price.");
    setSaving(true);
    try {
      const payload = {
        ...form,
        base_price: packagePrice,
        package_price: packagePrice,
        add_ons: addOnRows,
        discount_amount: discount,
        travel_fee: travel,
        tax_amount: tax,
        total_amount: totalPreview,
        total_fee: totalPreview,
      };
      if (quote?.id) {
        await QuoteAPI.update(quote.id, payload);
        toast.success("Quote updated.");
      } else {
        await QuoteAPI.create(payload);
        toast.success("Quote created.");
      }
      // Trigger server recalculation
      await base44.functions.invoke("quoteRecalculateTotals", { lead_id: form.lead_id }).catch(() => {});
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{quote ? "Edit Quote" : "New Quote"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Lead + contact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Link to Lead *</Label>
              <Select value={form.lead_id} onValueChange={v => setForm(f => ({ ...f, lead_id: v }))}>
                <SelectTrigger className="mt-1 text-sm"><SelectValue placeholder="Select lead…" /></SelectTrigger>
                <SelectContent>
                  {leadsData.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.client_first_name} {l.client_last_name} — {l.event_type?.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Contact Name</Label>
              <Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} className="mt-1 text-sm" placeholder="Auto-filled from lead" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Valid Until</Label>
              <Input type="date" value={form.valid_until || ""} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} className="mt-1 text-sm" />
            </div>
          </div>

          <Separator />

          {/* Package selection */}
          <div>
            <Label className="text-xs font-semibold text-gray-700 mb-2 block">Package</Label>
            <div className="flex gap-3 items-start">
              <div className="flex-1">
                <Select value={form.package_id || ""} onValueChange={handlePackageSelect}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Select from catalog…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>— No package —</SelectItem>
                    {packages.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — ${Number(p.base_price || 0).toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!form.package_id && (
                <div className="w-36">
                  <Input type="number" value={form.base_price} onChange={e => setForm(f => ({ ...f, base_price: e.target.value, package_name: e.target.value ? "Custom" : "" }))}
                    placeholder="Custom price" className="text-sm" />
                </div>
              )}
            </div>
            {form.package_name && (
              <div className="mt-2 flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-violet-500" />
                <span className="text-xs text-violet-700 font-medium">{form.package_name}</span>
                <Badge className="text-[10px] bg-violet-50 text-violet-700 border-0">${Number(packagePrice).toLocaleString()}</Badge>
              </div>
            )}
          </div>

          {/* Add-ons */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold text-gray-700">Add-Ons</Label>
              <Select value="" onValueChange={addCatalogAddOn}>
                <SelectTrigger className="w-48 h-8 text-xs border-dashed">
                  <Plus className="w-3 h-3 mr-1" /><SelectValue placeholder="Add from catalog…" />
                </SelectTrigger>
                <SelectContent>
                  {catalogAddOns.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} — ${Number(a.unit_price || 0).toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              {addOnRows.length === 0 && (
                <p className="text-xs text-gray-400 italic py-2">No add-ons selected. Pick from the catalog above.</p>
              )}
              {addOnRows.map((a, i) => (
                <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="flex-1 text-sm font-medium text-gray-800">{a.name}</span>
                  <span className="text-xs text-gray-400">${Number(a.unit_price || 0).toLocaleString()}/ea</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">Qty</span>
                    <Input type="number" value={a.qty} onChange={e => updateQty(i, e.target.value)}
                      className="w-16 h-7 text-xs text-center" min="1" />
                  </div>
                  <span className="text-sm font-semibold text-gray-800 w-20 text-right">${Number(a.line_total || 0).toLocaleString()}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 flex-shrink-0" onClick={() => removeRow(i)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Adjustments */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Discount ($)</Label>
              <Input type="number" value={form.discount_amount} onChange={e => setForm(f => ({ ...f, discount_amount: e.target.value }))} className="mt-1 text-sm" placeholder="0" />
            </div>
            <div>
              <Label className="text-xs">Travel Fee</Label>
              <Input type="number" value={form.travel_fee} onChange={e => setForm(f => ({ ...f, travel_fee: e.target.value }))} className="mt-1 text-sm" placeholder="0" />
            </div>
            <div>
              <Label className="text-xs">Tax ($)</Label>
              <Input type="number" value={form.tax_amount} onChange={e => setForm(f => ({ ...f, tax_amount: e.target.value }))} className="mt-1 text-sm" placeholder="0" />
            </div>
          </div>

          {/* Totals */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Package</span><span>${Number(packagePrice).toLocaleString()}</span>
            </div>
            {addOnRows.length > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Add-ons</span><span>${Number(addOnsTotal).toLocaleString()}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span><span>−${Number(discount).toLocaleString()}</span>
              </div>
            )}
            {travel > 0 && (
              <div className="flex justify-between text-gray-500"><span>Travel</span><span>+${Number(travel).toLocaleString()}</span></div>
            )}
            {tax > 0 && (
              <div className="flex justify-between text-gray-500"><span>Tax</span><span>+${Number(tax).toLocaleString()}</span></div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-lg text-violet-900 pt-1">
              <span>Total</span><span>${Number(totalPreview).toLocaleString()}</span>
            </div>
          </div>

          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea value={form.notes || ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="mt-1 text-sm" rows={2} placeholder="Terms, inclusions, special conditions…" />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              {quote ? "Update Quote" : "Create Quote"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}