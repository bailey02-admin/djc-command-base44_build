import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Plus, Trash2, GripVertical, Save, Loader2, AlertTriangle } from "lucide-react";

export default function PortalTimelineEditor({ bundle, eventId }) {
  const { event, timeline: initialTimeline = [] } = bundle;
  const queryClient = useQueryClient();

  const isLocked = event.planning_lock_at && new Date() >= new Date(event.planning_lock_at);

  // Sort by order
  const [items, setItems] = useState(() =>
    [...initialTimeline].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  );
  const [newItem, setNewItem] = useState({ time: "", segment_name: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(null);

  const save = async (action, data) => {
    const res = await base44.functions.invoke("clientPortalSave", { action, event_id: eventId, data });
    queryClient.invalidateQueries({ queryKey: ["portal-event", eventId] });
    return res.data;
  };

  const handleAdd = async () => {
    if (!newItem.segment_name.trim()) { setError("Segment name is required"); return; }
    setAdding(true); setError(null);
    try {
      const order = items.length;
      const res = await save("timeline_create", { ...newItem, order });
      setItems(prev => [...prev, res.item]);
      setNewItem({ time: "", segment_name: "", notes: "" });
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to add item");
    } finally { setAdding(false); }
  };

  const handleDelete = async (item) => {
    setSaving(true);
    try {
      await save("timeline_delete", { item_id: item.id });
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (e) {
      setError(e?.response?.data?.error || "Failed to delete");
    } finally { setSaving(false); }
  };

  const handleInlineUpdate = async (item, field, value) => {
    // Optimistic update
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, [field]: value } : i));
    try {
      await save("timeline_update", { item_id: item.id, [field]: value });
    } catch (e) {
      setError("Failed to save change");
    }
  };

  // Drag-to-reorder (simple index swap)
  const handleDragStart = (e, index) => { setDragging(index); };
  const handleDragOver = (e, index) => { e.preventDefault(); };
  const handleDrop = async (e, index) => {
    e.preventDefault();
    if (dragging === null || dragging === index) return;
    const reordered = [...items];
    const [moved] = reordered.splice(dragging, 1);
    reordered.splice(index, 0, moved);
    const withOrder = reordered.map((it, i) => ({ ...it, order: i }));
    setItems(withOrder);
    setDragging(null);
    setSaving(true);
    try {
      await save("timeline_reorder", { items: withOrder.map(it => ({ id: it.id, order: it.order })) });
    } catch (e) {
      setError("Failed to reorder");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-900 text-lg">Event Timeline</h2>
        {saving && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
      </div>

      {isLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start">
          <Lock className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-800 text-sm">Timeline is locked</p>
            <p className="text-xs text-amber-600 mt-0.5">Contact your coordinator to make changes.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 items-center text-xs text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Timeline items */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Timeline Segments ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">No timeline items yet. Add your first segment below.</p>
          )}
          {items.map((item, index) => (
            <div
              key={item.id}
              draggable={!isLocked}
              onDragStart={e => handleDragStart(e, index)}
              onDragOver={e => handleDragOver(e, index)}
              onDrop={e => handleDrop(e, index)}
              className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50 group"
            >
              {!isLocked && <GripVertical className="w-4 h-4 text-gray-300 cursor-grab flex-shrink-0" />}
              <Input
                value={item.time || ""}
                onChange={e => handleInlineUpdate(item, "time", e.target.value)}
                disabled={isLocked}
                placeholder="6:00 PM"
                className="w-24 h-7 text-xs font-mono border-0 bg-transparent p-1"
              />
              <Input
                value={item.segment_name || ""}
                onChange={e => handleInlineUpdate(item, "segment_name", e.target.value)}
                disabled={isLocked}
                placeholder="Segment name"
                className="flex-1 h-7 text-xs border-0 bg-transparent p-1"
              />
              <Input
                value={item.notes || ""}
                onChange={e => handleInlineUpdate(item, "notes", e.target.value)}
                disabled={isLocked}
                placeholder="Notes (optional)"
                className="flex-1 h-7 text-xs border-0 bg-transparent p-1 hidden sm:block"
              />
              {!isLocked && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-gray-300 hover:text-red-500 flex-shrink-0"
                  onClick={() => handleDelete(item)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Add new item */}
      {!isLocked && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Add Segment</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={newItem.time}
                onChange={e => setNewItem(p => ({ ...p, time: e.target.value }))}
                placeholder="Time (e.g. 6:00 PM)"
                className="w-32 text-sm"
              />
              <Input
                value={newItem.segment_name}
                onChange={e => setNewItem(p => ({ ...p, segment_name: e.target.value }))}
                placeholder="Segment name *"
                className="flex-1 text-sm"
              />
            </div>
            <Input
              value={newItem.notes}
              onChange={e => setNewItem(p => ({ ...p, notes: e.target.value }))}
              placeholder="Notes (optional)"
              className="text-sm"
            />
            <Button onClick={handleAdd} disabled={adding} className="w-full gap-2 bg-violet-600 hover:bg-violet-700">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Segment
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}