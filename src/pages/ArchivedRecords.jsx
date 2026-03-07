import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArchiveAPI } from "../components/api/secureApi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RotateCcw, Trash2, Loader2, Archive } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import ConfirmDialog from "../components/common/ConfirmDialog";
import EmptyState from "../components/common/EmptyState";

export default function ArchivedRecords() {
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const queryClient = useQueryClient();

  const { data: archived = {}, isLoading: loadingLeads, isLoading: loadingEvents } = useQuery({
    queryKey: ["archived-records"],
    queryFn: async () => {
      const r = await base44.functions.invoke("getArchivedRecords", {});
      return r.data || {};
    },
  });

  const archivedLeads = archived.leads || [];
  const archivedEvents = archived.events || [];

  const handleRestore = async () => {
    setRestoring(true);
    await ArchiveAPI.restore(restoreTarget.entity_type, restoreTarget.id);
    toast.success(`${restoreTarget.entity_type === "lead" ? "Lead" : "Event"} restored successfully.`);
    setRestoring(false);
    setRestoreTarget(null);
    queryClient.invalidateQueries(["archived-records"]);
    queryClient.invalidateQueries(["leads"]);
    queryClient.invalidateQueries(["events"]);
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Archived Records</h1>
        <p className="text-sm text-gray-500 mt-0.5">Soft-deleted leads and events. Restore or review only — permanent deletion requires DB-level access.</p>
      </div>

      <Tabs defaultValue="leads">
        <TabsList className="bg-white border">
          <TabsTrigger value="leads">Leads ({archivedLeads.length})</TabsTrigger>
          <TabsTrigger value="events">Events ({archivedEvents.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="mt-4">
          {loadingLeads ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>
          ) : archivedLeads.length === 0 ? (
            <EmptyState icon={Archive} title="No archived leads" description="Deleted leads will appear here." />
          ) : (
            <Card className="border-0 shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80">
                    <TableHead className="text-xs font-semibold">Client</TableHead>
                    <TableHead className="text-xs font-semibold">Event Type</TableHead>
                    <TableHead className="text-xs font-semibold">Stage</TableHead>
                    <TableHead className="text-xs font-semibold">City</TableHead>
                    <TableHead className="text-xs font-semibold">Archived</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {archivedLeads.map(l => (
                    <TableRow key={l.id} className="hover:bg-red-50/30">
                      <TableCell>
                        <div className="font-medium text-sm">{l.client_first_name} {l.client_last_name}</div>
                        <div className="text-xs text-gray-400">{l.email}</div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 capitalize">{l.event_type?.replace(/_/g, " ")}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px] bg-gray-100 text-gray-500 capitalize">{l.pipeline_stage?.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell className="text-sm text-gray-500">{l.city || "—"}</TableCell>
                      <TableCell className="text-xs text-gray-400">{l.updated_date ? format(new Date(l.updated_date), "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                          onClick={() => setRestoreTarget({ entity_type: "lead", id: l.id, label: `${l.client_first_name} ${l.client_last_name}` })}>
                          <RotateCcw className="w-3 h-3 mr-1" />Restore
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="events" className="mt-4">
          {loadingEvents ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>
          ) : archivedEvents.length === 0 ? (
            <EmptyState icon={Archive} title="No archived events" description="Deleted events will appear here." />
          ) : (
            <Card className="border-0 shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80">
                    <TableHead className="text-xs font-semibold">Event</TableHead>
                    <TableHead className="text-xs font-semibold">Date</TableHead>
                    <TableHead className="text-xs font-semibold">Type</TableHead>
                    <TableHead className="text-xs font-semibold">City</TableHead>
                    <TableHead className="text-xs font-semibold">Archived</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {archivedEvents.map(e => (
                    <TableRow key={e.id} className="hover:bg-red-50/30">
                      <TableCell>
                        <div className="font-medium text-sm">{e.event_name}</div>
                        <div className="text-xs text-gray-400">{e.contact_name}</div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{e.event_date ? format(new Date(e.event_date), "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell className="text-sm text-gray-500 capitalize">{e.event_type?.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-sm text-gray-500">{e.city || "—"}</TableCell>
                      <TableCell className="text-xs text-gray-400">{e.updated_date ? format(new Date(e.updated_date), "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                          onClick={() => setRestoreTarget({ entity_type: "event", id: e.id, label: e.event_name })}>
                          <RotateCcw className="w-3 h-3 mr-1" />Restore
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!restoreTarget}
        onCancel={() => setRestoreTarget(null)}
        onConfirm={handleRestore}
        loading={restoring}
        title="Restore Record?"
        description={`"${restoreTarget?.label}" will be restored to its active list and will appear in normal views again.`}
        confirmLabel="Restore"
        confirmVariant="default"
      />
    </div>
  );
}