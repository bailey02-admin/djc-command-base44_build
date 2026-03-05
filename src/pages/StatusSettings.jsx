import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit2, Trash2, Loader2 } from "lucide-react";

export default function StatusSettings() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [editingStatus, setEditingStatus] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [statusForm, setStatusForm] = useState({ key: "", label: "", color: "", sort_order: 0, is_active: true });
  const [groupForm, setGroupForm] = useState({ key: "", label: "", description: "", statuses: [], required: false });

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["status-settings"],
    queryFn: () => base44.functions.invoke("getStatusSettings", {}),
    enabled: !!user,
  });

  const allStatuses = settings?.data?.all_statuses || [];
  const allGroups = settings?.data?.groups || [];
  // Show only event-scoped groups in the Event Groups tab
  const groups = allGroups.filter(g => (g.entity_key || "event") === "event");

  const handleSaveStatus = async () => {
    if (!statusForm.key || !statusForm.label) {
      alert("Key and Label required");
      return;
    }
    await base44.functions.invoke("saveStatusSettings", {
      action: "upsert_status",
      data: { ...statusForm, id: editingStatus?.id },
    });
    queryClient.invalidateQueries({ queryKey: ["status-settings"] });
    setStatusForm({ key: "", label: "", color: "", sort_order: 0, is_active: true });
    setEditingStatus(null);
  };

  const handleDeactivateStatus = async (id) => {
    if (confirm("Deactivate this status?")) {
      await base44.functions.invoke("saveStatusSettings", {
        action: "deactivate_status",
        data: { id },
      });
      queryClient.invalidateQueries({ queryKey: ["status-settings"] });
    }
  };

  const handleSaveGroup = async () => {
    if (!groupForm.key || !groupForm.label) {
      alert("Key and Label required");
      return;
    }
    if (groupForm.statuses.length === 0) {
      alert("At least one status must be selected");
      return;
    }
    if (groupForm.key === "official_booked" && groupForm.statuses.length === 0) {
      alert("The official_booked group cannot be empty");
      return;
    }
    await base44.functions.invoke("saveStatusSettings", {
      action: "upsert_group",
      data: { ...groupForm, entity_key: "event", id: editingGroup?.id },
    });
    queryClient.invalidateQueries({ queryKey: ["status-settings"] });
    setGroupForm({ key: "", label: "", description: "", statuses: [], required: false });
    setEditingGroup(null);
  };

  const handleDeleteGroup = async (group) => {
    if (group.key === "official_booked") {
      alert("The official_booked group is required and cannot be deleted.");
      return;
    }
    if (confirm(`Delete group "${group.label}"?`)) {
      await base44.functions.invoke("saveStatusSettings", {
        action: "delete_group",
        data: { id: group.id },
      });
      queryClient.invalidateQueries({ queryKey: ["status-settings"] });
    }
  };

  if (!user || user.role !== "admin") {
    return <div className="p-6 text-center text-gray-600">Admin access only</div>;
  }

  if (isLoading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Status Settings</h1>

      <Tabs defaultValue="statuses" className="space-y-4">
        <TabsList className="bg-white border">
          <TabsTrigger value="statuses">Event Statuses</TabsTrigger>
          <TabsTrigger value="groups">Event Groups</TabsTrigger>
        </TabsList>

        {/* Statuses Tab */}
        <TabsContent value="statuses">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Manage Statuses</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-600">Key</label>
                  <Input
                    placeholder="e.g., booked_pending"
                    value={statusForm.key}
                    onChange={(e) => setStatusForm({ ...statusForm, key: e.target.value })}
                    disabled={!!editingStatus}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-600">Label</label>
                  <Input
                    placeholder="e.g., Booked Pending"
                    value={statusForm.label}
                    onChange={(e) => setStatusForm({ ...statusForm, label: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-600">Tailwind Color Class</label>
                  <Input
                    placeholder="e.g., bg-sky-50 text-sky-700 border-sky-200"
                    value={statusForm.color}
                    onChange={(e) => setStatusForm({ ...statusForm, color: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-600">Sort Order</label>
                  <Input
                    type="number"
                    value={statusForm.sort_order}
                    onChange={(e) => setStatusForm({ ...statusForm, sort_order: Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={statusForm.is_active}
                    onChange={(e) => setStatusForm({ ...statusForm, is_active: e.target.checked })}
                  />
                  <label htmlFor="is_active" className="text-xs font-semibold text-gray-600">Active</label>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={handleSaveStatus}>
                    {editingStatus ? "Update" : "Create"}
                  </Button>
                  {editingStatus && (
                    <Button size="sm" variant="outline" onClick={() => {
                      setEditingStatus(null);
                      setStatusForm({ key: "", label: "", color: "", sort_order: 0, is_active: true });
                    }}>
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Statuses</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {allStatuses.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-sm">{s.label}</div>
                      <div className="text-xs text-gray-400">{s.key}</div>
                      {!s.is_active && <Badge variant="secondary" className="text-[10px] mt-1">Inactive</Badge>}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingStatus(s);
                          setStatusForm(s);
                        }}
                      >
                        <Edit2 className="w-3.5 h-3.5 text-gray-400" />
                      </Button>
                      {s.is_active && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeactivateStatus(s.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Groups Tab */}
        <TabsContent value="groups">
          <p className="text-xs text-gray-500 mb-4">
            Event Groups let you classify statuses into logical sets. The <strong>official_booked</strong> group
            is required — it determines when a quote snapshot and payment schedule are triggered.
          </p>
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  {editingGroup ? `Edit: ${editingGroup.label}` : "Create New Group"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-600">Key</label>
                  <Input
                    placeholder="e.g., official_booked"
                    value={groupForm.key}
                    onChange={(e) => setGroupForm({ ...groupForm, key: e.target.value })}
                    disabled={!!editingGroup}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-600">Label</label>
                  <Input
                    placeholder="e.g., Official Booked Statuses"
                    value={groupForm.label}
                    onChange={(e) => setGroupForm({ ...groupForm, label: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-600">Description</label>
                  <Input
                    placeholder="Explanation of this group"
                    value={groupForm.description}
                    onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-600">Statuses</label>
                  <div className="flex flex-wrap gap-2">
                    {allStatuses.filter(s => s.is_active).map((s) => (
                      <Badge
                        key={s.id}
                        variant={groupForm.statuses.includes(s.key) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          const updated = groupForm.statuses.includes(s.key)
                            ? groupForm.statuses.filter(k => k !== s.key)
                            : [...groupForm.statuses, s.key];
                          setGroupForm({ ...groupForm, statuses: updated });
                        }}
                      >
                        {s.label}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="required"
                    checked={groupForm.required}
                    onChange={(e) => setGroupForm({ ...groupForm, required: e.target.checked })}
                  />
                  <label htmlFor="required" className="text-xs font-semibold text-gray-600">Required (cannot be empty)</label>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={handleSaveGroup}>
                    {editingGroup ? "Update" : "Create"}
                  </Button>
                  {editingGroup && (
                    <Button size="sm" variant="outline" onClick={() => {
                      setEditingGroup(null);
                      setGroupForm({ key: "", label: "", description: "", statuses: [], required: false });
                    }}>
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Event Groups</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {groups.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">No groups yet. Groups are seeded automatically on first load.</p>
                )}
                {groups.map((g) => {
                  const isOfficialBooked = g.key === "official_booked";
                  return (
                    <div key={g.id} className={`p-3 rounded-lg border ${isOfficialBooked ? "bg-violet-50 border-violet-200" : "bg-gray-50 border-transparent"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-medium text-sm flex items-center gap-2">
                            {g.label}
                            {isOfficialBooked && <Badge className="text-[10px] bg-violet-100 text-violet-700 border-violet-300">System</Badge>}
                          </div>
                          <div className="text-xs text-gray-400">{g.key}</div>
                          {g.required && <Badge variant="secondary" className="text-[10px] mt-1">Required</Badge>}
                          {g.description && <div className="text-xs text-gray-500 mt-1">{g.description}</div>}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditingGroup(g);
                              setGroupForm({ ...g });
                            }}
                          >
                            <Edit2 className="w-3.5 h-3.5 text-gray-400" />
                          </Button>
                          {!isOfficialBooked && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteGroup(g)}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(g.statuses || []).map((statusKey) => {
                          const status = allStatuses.find(s => s.key === statusKey);
                          return (
                            <Badge key={statusKey} variant="outline" className="text-[10px]">
                              {status ? status.label : statusKey}
                            </Badge>
                          );
                        })}
                        {(!g.statuses || g.statuses.length === 0) && (
                          <span className="text-xs text-red-500">No statuses assigned</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}