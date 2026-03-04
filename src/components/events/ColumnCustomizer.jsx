/**
 * ColumnCustomizer — slide-out panel for adding/removing/reordering/renaming columns.
 * Uses @hello-pangea/dnd for drag-and-drop reordering.
 */
import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { X, GripVertical, Save, RotateCcw, Plus, Loader2 } from "lucide-react";

// Full registry — mirrors backend allowlist
export const COLUMN_REGISTRY = [
  { key: "event_date",       default_label: "Date",         value_type: "date" },
  { key: "status_city",      default_label: "Status – City",value_type: "badge" },
  { key: "contact_name",     default_label: "Client",       value_type: "text" },
  { key: "event_name",       default_label: "Event",        value_type: "text" },
  { key: "event_type",       default_label: "Event Type",   value_type: "badge" },
  { key: "staff_combined",   default_label: "Staff",        value_type: "text" },
  { key: "assigned_dj",      default_label: "DJ",           value_type: "text" },
  { key: "assigned_mc",      default_label: "MC",           value_type: "text" },
  { key: "assigned_finalizer",default_label: "Finalizer",   value_type: "text" },
  { key: "venue_name",       default_label: "Venue",        value_type: "text" },
  { key: "setup_time",       default_label: "Setup Time",   value_type: "text" },
  { key: "start_time",       default_label: "Start Time",   value_type: "text" },
  { key: "end_time",         default_label: "End Time",     value_type: "text" },
  { key: "city",             default_label: "City",         value_type: "text" },
  { key: "lead_source",      default_label: "Source",       value_type: "text" },
  { key: "package_name",     default_label: "Package",      value_type: "text" },
  { key: "total_fee",        default_label: "Total Fee",    value_type: "money", role_min: "finance" },
  { key: "balance_due",      default_label: "Balance Due",  value_type: "money", role_min: "finance" },
  { key: "readiness_score",  default_label: "Readiness",    value_type: "text" },
  { key: "view_action",      default_label: "View",         value_type: "action" },
];

const FINANCE_ROLES = new Set(["admin", "city_manager", "sales_manager", "finance"]);

export default function ColumnCustomizer({ open, onClose, columns, userRole, onSave, onReset, viewName, onViewNameChange }) {
  const [cols, setCols] = useState(columns);
  const [name, setName] = useState(viewName || "My View");
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setCols(columns); }, [columns]);
  useEffect(() => { setName(viewName || "My View"); }, [viewName]);

  if (!open) return null;

  const canSeeFinance = FINANCE_ROLES.has(userRole);

  // Keys already in current config
  const configuredKeys = new Set(cols.map(c => c.key));

  // Available to add (in registry, not already present, role-gated)
  const addable = COLUMN_REGISTRY.filter(r => {
    if (configuredKeys.has(r.key)) return false;
    if (r.role_min === "finance" && !canSeeFinance) return false;
    return true;
  });

  const updateLabel = (key, label) =>
    setCols(prev => prev.map(c => c.key === key ? { ...c, label } : c));

  const toggleVisible = (key) =>
    setCols(prev => prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c));

  const removeCol = (key) =>
    setCols(prev => prev.filter(c => c.key !== key));

  const addCol = (reg) =>
    setCols(prev => [...prev, { key: reg.key, label: reg.default_label, visible: true }]);

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const next = Array.from(cols);
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    setCols(next);
  };

  const handleSave = () => {
    onSave({ name, columns: cols, is_default: saveAsDefault });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-sm bg-white shadow-2xl flex flex-col h-full border-l border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">Customize Columns</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* View name */}
        <div className="px-4 py-3 border-b border-gray-100 space-y-1">
          <label className="text-xs font-medium text-gray-500">View name</label>
          <Input value={name} onChange={e => setName(e.target.value)} className="h-8 text-sm" />
          <label className="flex items-center gap-2 text-xs text-gray-500 mt-2 cursor-pointer">
            <Switch checked={saveAsDefault} onCheckedChange={setSaveAsDefault} />
            Set as default view
          </label>
        </div>

        {/* Column list (drag/drop) */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="text-xs font-medium text-gray-500 mb-2">Drag to reorder · toggle visibility · rename</p>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="columns">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1.5">
                  {cols.map((col, idx) => {
                    const reg = COLUMN_REGISTRY.find(r => r.key === col.key);
                    const isFinance = reg?.role_min === "finance";
                    const allowed = !isFinance || canSeeFinance;
                    if (!allowed) return null;

                    return (
                      <Draggable key={col.key} draggableId={col.key} index={idx}>
                        {(prov) => (
                          <div ref={prov.innerRef} {...prov.draggableProps}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-sm transition-colors ${
                              col.visible ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100 opacity-60"
                            }`}>
                            <span {...prov.dragHandleProps} className="text-gray-300 cursor-grab">
                              <GripVertical className="w-4 h-4" />
                            </span>
                            <Switch checked={!!col.visible} onCheckedChange={() => toggleVisible(col.key)} />
                            <Input
                              value={col.label}
                              onChange={e => updateLabel(col.key, e.target.value)}
                              className="flex-1 h-7 text-xs border-transparent bg-transparent px-1 focus:border-gray-200"
                            />
                            {col.key !== "view_action" && (
                              <button onClick={() => removeCol(col.key)} className="text-gray-300 hover:text-red-400 transition-colors">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {/* Add columns */}
          {addable.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-gray-400 mb-2">Add columns</p>
              <div className="space-y-1">
                {addable.map(reg => (
                  <button key={reg.key} onClick={() => addCol(reg)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border border-dashed border-gray-200 text-xs text-gray-500 hover:border-violet-300 hover:text-violet-600 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> {reg.default_label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2">
          <Button onClick={handleSave} className="flex-1 h-8 text-xs bg-violet-600 hover:bg-violet-700 text-white gap-1">
            <Save className="w-3.5 h-3.5" /> Save View
          </Button>
          <Button variant="outline" size="sm" onClick={onReset} className="h-8 text-xs gap-1">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </Button>
        </div>
      </div>
    </div>
  );
}