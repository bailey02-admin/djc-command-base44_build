import React from "react";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, AlertTriangle, CheckCircle2, DollarSign, FileText, ClipboardList, User } from "lucide-react";
import { getEventNextBestAction } from "../crm/taskEngine";

const ICONS = {
  phone:  <Phone className="w-4 h-4" />,
  alert:  <AlertTriangle className="w-4 h-4" />,
  check:  <CheckCircle2 className="w-4 h-4" />,
  dollar: <DollarSign className="w-4 h-4" />,
  file:   <FileText className="w-4 h-4" />,
  task:   <ClipboardList className="w-4 h-4" />,
  user:   <User className="w-4 h-4" />,
};

const TYPE_STYLES = {
  urgent: "bg-red-50 border-red-200 text-red-700",
  action: "bg-violet-50 border-violet-200 text-violet-700",
  task:   "bg-amber-50 border-amber-200 text-amber-700",
  ok:     "bg-emerald-50 border-emerald-200 text-emerald-700",
};

export default function EventNextBestAction({ event, tasks = [] }) {
  const nba = getEventNextBestAction(event, tasks);
  if (!nba) return null;
  const style = TYPE_STYLES[nba.type] || TYPE_STYLES.action;
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border ${style}`}>
      <div className="flex-shrink-0 mt-0.5">{ICONS[nba.icon] || ICONS.task}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide opacity-60 mb-0.5">Next Best Action</p>
        <p className="text-sm font-semibold leading-tight">{nba.label}</p>
        {nba.detail && <p className="text-xs opacity-70 mt-0.5">{nba.detail}</p>}
      </div>
      {nba.type === "urgent" && <Badge className="bg-red-600 text-white text-[9px] flex-shrink-0">NOW</Badge>}
    </div>
  );
}