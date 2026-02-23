import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const statusColors = {
  new: "bg-blue-50 text-blue-700",
  attempted_contact: "bg-yellow-50 text-yellow-700",
  contacted: "bg-indigo-50 text-indigo-700",
  qualified: "bg-violet-50 text-violet-700",
  proposal_sent: "bg-purple-50 text-purple-700",
  follow_up: "bg-orange-50 text-orange-700",
  booked: "bg-emerald-50 text-emerald-700",
  lost: "bg-red-50 text-red-700",
  ghosted: "bg-gray-50 text-gray-600",
  disqualified: "bg-gray-100 text-gray-500",
};

export default function LeadTable({ leads }) {
  return (
    <div className="rounded-xl border border-gray-200/60 overflow-hidden bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50/80">
            <TableHead className="text-xs font-semibold">Name</TableHead>
            <TableHead className="text-xs font-semibold">Event</TableHead>
            <TableHead className="text-xs font-semibold">Date</TableHead>
            <TableHead className="text-xs font-semibold">City</TableHead>
            <TableHead className="text-xs font-semibold">Source</TableHead>
            <TableHead className="text-xs font-semibold">Status</TableHead>
            <TableHead className="text-xs font-semibold">Rep</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map(lead => (
            <TableRow key={lead.id} className="hover:bg-gray-50/50 cursor-pointer">
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
                <Badge variant="secondary" className={`text-[10px] ${statusColors[lead.status]}`}>
                  {lead.status?.replace(/_/g, " ")}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-gray-500">{lead.assigned_rep || "—"}</TableCell>
            </TableRow>
          ))}
          {leads.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-10 text-gray-400 text-sm">
                No leads match your filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}