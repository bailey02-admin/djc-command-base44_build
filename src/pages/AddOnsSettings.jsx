import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit, EyeOff, Eye, Sparkles } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["lighting","photo_booth","ceremony","logistics","uplighting","monogram","videography","other"];
const EMPTY = { name: "", description: "", unit_price: "", category: "", taxable: false, is_active: true, sort_order: 0 };

export default function AddOnsSettings() {
  const qc = useQueryClient();
  const [showInactive, setShowInactive] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["addons-catalog"],
    queryFn: async () => {
      const r = await base44.functions.invoke("getAddOns", { active_only: false });
      return r.data;
    },
    staleTime: 30_000,
  });

  const all = data?.addOns || [];
  const addOns = all
    .filter(a => showInactive || a.is_active !== false)
    .filter(a => !categoryFilter || a.category === categoryFilter);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (a) => { setEditing(a); setForm({ ...EMPTY, ...a, unit_price: a.unit_price?.toString() || "" }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim() || form.unit_price === "") { toast.error("Name and unit price are required"); return; }
    setSaving(true);
    try {
      const data = { ...form, unit_price: Number(form.unit_price) };
      await base44.functions.invoke("saveAddOn", { action: editing ? "update" : "create", id: editing?.id, data });
      qc.invalidateQueries(["addons-catalog"]);
      toast.success(editing ? "Add-on updated" : "Add-on created");
      setDialogOpen(false);
    } catch (e) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (a) => {
    try {
      if (a.is_active) {
        await base44.functions.invoke("deleteAddOn", { id: a.id });
        toast.success("Add-on deactivated");
      } else {
        await base44.functions.invoke("saveAddOn", { action: "update", id: a.id, data: { ...a, is_active: true } });
        toast.success("Add-on reactivated");
      }
      qc.invalidateQueries(["addons-catalog"]);
    } catch (e) {
      toast.error(e.message || "Action failed");
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add-Ons Catalog</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage available add-ons and upgrades</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} />
            Show inactive
          </label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-36 h-9 text-xs"><SelectValue placeholder="All categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>All categories</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, " ").replace(/\b\w/g, x => x.toUpperCase())}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={openCreate} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
            <Plus className="w-4 h-4" /> New Add-On
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Category</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Unit Price</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Taxable</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>
              ))
            ) : addOns.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No add-ons yet.</p>
                </td>
              </tr>
            ) : addOns.map(a => (
              <tr key={a.id} className={!a.is_active ? "opacity-50" : ""}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{a.name}</p>
                  {a.description && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]">{a.description}</p>}
                </td>
                <td className="px-4 py-3">
                  {a.category ? (
                    <Badge variant="outline" className="text-[10px] capitalize">{a.category.replace(/_/g, " ")}</Badge>
                  ) : <span className="text-gray-400 text-xs">—</span>}
                </td>
                <td className="px-4 py-3 font-semibold text-gray-800">${Number(a.unit_price || 0).toLocaleString()}</td>
                <td className="px-4 py-3">
                  {a.taxable ? <Badge className="bg-amber-50 text-amber-700 border-0 text-[10px]">Taxable</Badge> : <span className="text-gray-400 text-xs">No</span>}
                </td>
                <td className="px-4 py-3">
                  <Badge className={a.is_active ? "bg-emerald-50 text-emerald-700 border-0" : "bg-gray-100 text-gray-500 border-0"}>
                    {a.is_active ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEdit(a)}>
                      <Edit className="w-3 h-3 mr-1" />Edit
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => handleToggle(a)} title={a.is_active ? "Deactivate" : "Reactivate"}>
                      {a.is_active ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3 text-violet-600" />}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Add-On" : "New Add-On"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold">Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" placeholder="e.g. Uplighting Package" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold">Unit Price *</Label>
                <Input type="number" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} className="mt-1" placeholder="0.00" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Category</Label>
                <Select value={form.category || ""} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>None</SelectItem>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, " ").replace(/\b\w/g, x => x.toUpperCase())}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">Description</Label>
              <Textarea value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1" rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="taxable" checked={!!form.taxable} onCheckedChange={v => setForm(f => ({ ...f, taxable: v }))} />
              <Label htmlFor="taxable" className="text-sm cursor-pointer">Taxable</Label>
            </div>
            <div>
              <Label className="text-xs font-semibold">Sort Order</Label>
              <Input type="number" value={form.sort_order || 0} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} className="mt-1 w-24" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700 text-white">
              {saving ? "Saving…" : (editing ? "Update" : "Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}