import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import SLABadge from "./SLABadge";
import usePipelineConfig from "@/components/hooks/usePipelineConfig";

export default function LeadTable({ leads }) {
  const { stageMap } = usePipelineConfig();

  return (
    <div className="rounded-xl border border-gray-200/60 overflow-hidden bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50/80">
            <TableHead className="text-xs font-semibold text-gray-400 w-24">Lead ID</TableHead>
            <TableHead className="text-xs font-semibold">Name</TableHead>
            <TableHead className="text-xs font-semibold">Event</TableHead>
            <TableHead className="text-xs font-semibold">Date</TableHead>
            <TableHead className="text-xs font-semibold">City</TableHead>
            <TableHead className="text-xs font-semibold">Source</TableHead>
            <TableHead className="text-xs font-semibold">Stage</TableHead>
            <TableHead className="text-xs font-semibold">SLA</TableHead>
            <TableHead className="text-xs font-semibold">Rep</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => {
            const stage = stageMap[lead.pipeline_stage] || stageMap.new_inquiry;
            return (
              <TableRow key={lead.id} className="hover:bg-gray-50/50 cursor-pointer">
                <TableCell className="font-mono text-[10px] text-gray-400 select-all" title={lead.lead_id || lead.id}>
                  {(lead.lead_id || lead.id || "").slice(-8)}
                </TableCell>
                <TableCell>
                  <Link to={createPageUrl("LeadDetail") + `?id=${lead.id}`} className="text-sm font-medium text-gray-900 hover:text-violet-700">
                    {lead.client_first_name} {lead.client_last_name}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-gray-600 capitalize">{lead.event_type?.replace(/_/g, " ")}</TableCell>
                <TableCell className="text-sm text-gray-500">
                  {lead.event_date ? format(new Date(lead.event_date), "MMM d, yyyy") : "—"}
                </TableCell>
                <TableCell className="text-sm text-gray-500">{lead.city || "—"}</TableCell>
                <TableCell className="text-sm text-gray-500 capitalize">{lead.lead_source?.replace(/_/g, " ") || "—"}</TableCell>
                <TableCell>
                  {stage ? <Badge variant="secondary" className={`text-[10px] ${stage.color}`}>{stage.label}</Badge> : <span className="text-xs text-gray-400">—</span>}
                </TableCell>
                <TableCell><SLABadge lead={lead} /></TableCell>
                <TableCell className="text-sm text-gray-500">{lead.assigned_rep || "—"}</TableCell>
              </TableRow>
            );
          })}
          {leads.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-10 text-gray-400 text-sm">
                No leads match your filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}