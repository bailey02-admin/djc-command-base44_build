import React from "react";
import { GripVertical, X } from "lucide-react";

export default function ColumnPicker({ available, selected, onChange }) {
  const selectedSet = new Set(selected);

  const toggle = (key) => {
    if (selectedSet.has(key)) {
      onChange(selected.filter(k => k !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  const remove = (key) => onChange(selected.filter(k => k !== key));

  return (
    <div className="space-y-3">
      {/* Selected columns (ordered) */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-violet-50 border border-violet-200 rounded-lg min-h-10">
          {selected.map(key => {
            const col = available.find(c => c.key === key);
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-600 text-white text-xs rounded-md font-medium"
              >
                {col?.label || key}
                <button onClick={() => remove(key)} className="hover:opacity-70">
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Available columns grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {available.map(col => {
          const isSelected = selectedSet.has(col.key);
          return (
            <button
              key={col.key}
              onClick={() => toggle(col.key)}
              className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                isSelected
                  ? "border-violet-400 bg-violet-50 text-violet-700 font-medium"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {col.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}