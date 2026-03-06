import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit, EyeOff, Eye, Package } from "lucide-react";
import { toast } from "sonner";

const EMPTY = { name: "", description: "", base_price: "", event_types: [], is_active: true, sort_order: 0 };

export default function PackagesSettings() {
  const qc = useQueryClient();
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["packages-catalog"],
    queryFn: async () => {
      const r = await base44.functions.invoke("getPackages", { active_only: false });
      return r.data;
    },
    staleTime: 30_000,
  });

  const all = data?.packages || [];
  const packages = showInactive ? all : all.filter(p => p.is_active !== false);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (pkg) => { setEditing(pkg); setForm({ ...EMPTY, ...pkg, base_price: pkg.base_price?.toString() || "" }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim() || form.base_price === "") { toast.error("Name and base price are required"); return; }
    setSaving(true);
    try {
      const data = { ...form, base_price: Number(form.base_price) };
      await base44.functions.invoke("savePackage", { action: editing ? "update" : "create", id: editing?.id, data });
      qc.invalidateQueries(["packages-catalog"]);
      toast.success(editing ? "Package updated" : "Package created");
      setDialogOpen(false);
    } catch (e) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (pkg) => {
    try {
      if (pkg.is_active) {
        await base44.functions.invoke("deletePackage", { id: pkg.id });
        toast.success("Package deactivated");
      } else {
        await base44.functions.invoke("savePackage", { action: "update", id: pkg.id, data: { ...pkg, is_active: true } });
        toast.success("Package reactivated");
      }
      qc.invalidateQueries(["packages-catalog"]);
    } catch (e) {
      toast.error(e.message || "Action failed");
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Packages Catalog</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your standard DJ packages</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} />
            Show inactive
          </label>
          <Button onClick={openCreate} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
            <Plus className="w-4 h-4" /> New Package
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Base Price</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Event Types</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}><td colSpan={5} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>
              ))
            ) : packages.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No packages yet. Create one to get started.</p>
                </td>
              </tr>
            ) : packages.map(pkg => (
              <tr key={pkg.id} className={!pkg.is_active ? "opacity-50" : ""}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{pkg.name}</p>
                  {pkg.description && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{pkg.description}</p>}
                </td>
                <td className="px-4 py-3 font-semibold text-gray-800">${Number(pkg.base_price || 0).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {(pkg.event_types || []).length === 0
                      ? <span className="text-xs text-gray-400">All types</span>
                      : (pkg.event_types || []).map(t => (
                        <Badge key={t} variant="outline" className="text-[10px] capitalize">{t.replace(/_/g, " ")}</Badge>
                      ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge className={pkg.is_active ? "bg-emerald-50 text-emerald-700 border-0" : "bg-gray-100 text-gray-500 border-0"}>
                    {pkg.is_active ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEdit(pkg)}>
                      <Edit className="w-3 h-3 mr-1" />Edit
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => handleToggle(pkg)} title={pkg.is_active ? "Deactivate" : "Reactivate"}>
                      {pkg.is_active ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3 text-violet-600" />}
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
          <DialogHeader><DialogTitle>{editing ? "Edit Package" : "New Package"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold">Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" placeholder="e.g. Premium DJ Package" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Base Price *</Label>
              <Input type="number" value={form.base_price} onChange={e => setForm(f => ({ ...f, base_price: e.target.value }))} className="mt-1 w-40" placeholder="0.00" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Description</Label>
              <Textarea value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1" rows={2} placeholder="What's included..." />
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