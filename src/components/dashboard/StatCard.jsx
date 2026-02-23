import React from "react";
import { Card } from "@/components/ui/card";

export default function StatCard({ title, value, subtitle, icon: Icon, color = "violet", trend }) {
  const colorMap = {
    violet: "from-violet-500 to-indigo-600",
    emerald: "from-emerald-500 to-teal-600",
    amber: "from-amber-500 to-orange-600",
    rose: "from-rose-500 to-pink-600",
    blue: "from-blue-500 to-cyan-600",
    slate: "from-slate-500 to-gray-600",
  };

  return (
    <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorMap[color]} flex items-center justify-center shadow-lg shadow-${color}-500/20`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
        {trend && (
          <div className="mt-3 flex items-center text-xs">
            <span className={`font-semibold ${trend.positive ? "text-emerald-600" : "text-rose-600"}`}>
              {trend.positive ? "↑" : "↓"} {trend.value}
            </span>
            <span className="text-gray-400 ml-1">{trend.label}</span>
          </div>
        )}
      </div>
    </Card>
  );
}