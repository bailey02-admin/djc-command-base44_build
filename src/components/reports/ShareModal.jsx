import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, X } from "lucide-react";

export default function ShareModal({ report, open, onClose, onSave }) {
  const [visibility, setVisibility] = useState(report?.visibility || "private");
  const [sharedWith, setSharedWith] = useState(report?.shared_with || []);
  const [allowEdit, setAllowEdit] = useState(report?.allow_edit_shared || false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (report) {
      setVisibility(report.visibility || "private");
      setSharedWith(report.shared_with || []);
      setAllowEdit(report.allow_edit_shared || false);
    }
  }, [report]);

  const { data: staffData } = useQuery({
    queryKey: ["staff-profiles-for-share"],
    queryFn: () => base44.functions.invoke("getUsers", {}).then(r => r.data),
    enabled: open,
  });

  const allStaff = (staffData?.users || []).filter(u => u.email && u.full_name);

  const togglePerson = (id) => {
    setSharedWith(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({ visibility, shared_with: sharedWith, allow_edit_shared: allowEdit });
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Report</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Visibility */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Who can run this report?</Label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Private — only me</SelectItem>
                <SelectItem value="org">Org — all staff</SelectItem>
                <SelectItem value="shared">Specific people</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Specific people */}
          {visibility === "shared" && (
            <div className="space-y-2">
              <Label className="text-xs text-gray-500">Select staff members</Label>
              {/* Selected */}
              {sharedWith.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {sharedWith.map(id => {
                    const person = allStaff.find(s => s.id === id);
                    return (
                      <Badge key={id} className="bg-violet-100 text-violet-700 border-violet-200 border gap-1 pr-1">
                        {person?.full_name || id}
                        <button onClick={() => togglePerson(id)} className="hover:opacity-70">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
              {/* Staff list */}
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {allStaff.length === 0 ? (
                  <div className="p-3 text-sm text-gray-400 text-center">Loading staff…</div>
                ) : (
                  allStaff.map(s => (
                    <button
                      key={s.id}
                      onClick={() => togglePerson(s.id)}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-50 transition-colors ${
                        sharedWith.includes(s.id) ? "bg-violet-50" : ""
                      }`}
                    >
                      <span className="font-medium text-gray-800">{s.full_name}</span>
                      <span className="text-xs text-gray-400">{s.custom_role}</span>
                    </button>
                  ))
                )}
              </div>

              {/* Allow edit toggle */}
              <div className="flex items-center justify-between pt-1">
                <Label className="text-xs text-gray-500">Allow shared users to edit this report</Label>
                <Switch checked={allowEdit} onCheckedChange={setAllowEdit} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="bg-violet-600 hover:bg-violet-700" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save Sharing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}