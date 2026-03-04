import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserAPI, EventAPI } from "../api/secureApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserCheck } from "lucide-react";
import { toast } from "sonner";

export default function StaffAssignmentCard({ event, onSaved }) {
  const [djId, setDjId] = useState(event?.assigned_dj_id || "");
  const [mcId, setMcId] = useState(event?.assigned_mc_id || "");
  const [saving, setSaving] = useState(false);

  const { data: usersData } = useQuery({
    queryKey: ["users-dj"],
    queryFn: () => UserAPI.list({ role: "dj", is_active: "true" }, 100),
    staleTime: 60_000,
  });

  const djUsers = usersData?.users || [];

  const handleSave = async () => {
    setSaving(true);
    try {
      await EventAPI.assignStaff(event.id, djId || null, mcId || null);
      toast.success("Staff assignment saved");
      if (onSaved) onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const changed = djId !== (event?.assigned_dj_id || "") || mcId !== (event?.assigned_mc_id || "");

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-violet-500" /> Staff Assignments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-xs text-gray-500 font-medium">Assigned DJ</p>
          <Select value={djId || "__none__"} onValueChange={v => setDjId(v === "__none__" ? "" : v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Unassigned —</SelectItem>
              {djUsers.map(u => (
                <SelectItem key={u.id} value={u.id}>
                  {u.full_name || u.email}
                  {u.default_city && <span className="text-gray-400 ml-1">({u.default_city})</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {event?.assigned_dj && <p className="text-xs text-gray-400">Current: {event.assigned_dj}</p>}
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-gray-500 font-medium">Assigned MC</p>
          <Select value={mcId || "__none__"} onValueChange={v => setMcId(v === "__none__" ? "" : v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Unassigned —</SelectItem>
              {djUsers.map(u => (
                <SelectItem key={u.id} value={u.id}>
                  {u.full_name || u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {event?.assigned_mc && <p className="text-xs text-gray-400">Current: {event.assigned_mc}</p>}
        </div>

        {changed && (
          <Button size="sm" onClick={handleSave} disabled={saving} className="w-full bg-violet-600 hover:bg-violet-700 text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Save Assignments
          </Button>
        )}
      </CardContent>
    </Card>
  );
}