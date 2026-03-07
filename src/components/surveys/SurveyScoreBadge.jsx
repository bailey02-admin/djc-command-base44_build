import React from "react";

export default function SurveyScoreBadge({ score, size = "sm" }) {
  if (score == null) return <span className="text-gray-400 text-xs">—</span>;

  const color = score >= 8
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : score >= 6
    ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-red-50 text-red-700 border-red-200";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-semibold ${color}`}>
      {score}<span className="font-normal opacity-60 ml-0.5">/10</span>
    </span>
  );
}