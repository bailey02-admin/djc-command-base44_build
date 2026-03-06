import React, { useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export default function ResultsTable({ columns, rows }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const av = a[sortKey] ?? "";
        const bv = b[sortKey] ?? "";
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      })
    : rows;

  const fmt = (val) => {
    if (val === null || val === undefined) return "";
    if (typeof val === "boolean") return val ? "Yes" : "No";
    if (typeof val === "number") return val.toLocaleString();
    return String(val);
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                className="px-4 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap cursor-pointer hover:text-gray-900 select-none"
                onClick={() => handleSort(col.key)}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  {sortKey === col.key
                    ? sortDir === "asc"
                      ? <ArrowUp className="w-3.5 h-3.5 text-violet-600" />
                      : <ArrowDown className="w-3.5 h-3.5 text-violet-600" />
                    : <ArrowUpDown className="w-3.5 h-3.5 text-gray-300" />
                  }
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {sorted.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50/50">
              {columns.map(col => (
                <td key={col.key} className="px-4 py-2.5 text-gray-700 whitespace-nowrap max-w-48 truncate">
                  {fmt(row[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}