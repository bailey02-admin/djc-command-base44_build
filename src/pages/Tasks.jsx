import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TaskAPI } from "../components/api/secureApi";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, ClipboardList, Loader2, Pencil, Trash2, CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { format, isToday, isPast, parseISO } from "date-fns";
import { toast } from "sonner";
import EmptyState from "../components/common/EmptyState";
import ConfirmDialog from "../components/common/ConfirmDialog";

const PRIORITY_COLORS = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-50 text-blue-700",
  high: "bg-amber-50 text-amber-700",
  urgent: "bg-red-50 text-red-700",
};

const STATUS_COLORS = {
  pending: "bg-yellow-50 text-yellow-700",
  in_progress: "bg-blue-50 text-blue-700",
  completed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-gray-100 text-gray-400",
};

const CATEGORIES = ["follow_up","call","email","planning","finalization","dj_prep","payment","contract","survey","review","other"];

const EMPTY = {
  title: "", description: "", assigned_to: "", due_date: "", priority: "medium",
  status: "pending", related_type: "general", related_id: "", related_name: "",
  category: "other", notes: "",
};

export default function Tasks() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("pending");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const qc = useQueryClient();

  const { data: allTasks = [], isLoading } = useQuery({
    queryKey: ["all-tasks"],
    queryFn: () => TaskAPI.list({}, "-due_date", 300),
  });

  const filtered = allTasks.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || t.title?.toLowerCase().includes(q) || t.assigned_to?.toLowerCase().includes(q) || t.related_name?.toLowerCase().includes(q);
    const matchTab =
      tab === "pending" ? ["pending", "in_progress"].includes(t.status) :
      tab === "completed" ? t.status === "completed" :
      tab === "overdue" ? (t.status !== "completed" && t.status !== "cancelled" && t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date))) :
      true;
    return matchSearch && matchTab;
  });

  const counts = {
    pending: allTasks.filter(t => ["pending","in_progress"].includes(t.status)).length,
    overdue: allTasks.filter(t => t.status !== "completed" && t.status !== "cancelled" && t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date))).length,
    completed: allTasks.filter(t => t.status === "completed").length,
  };

  const openNew = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (t) => { setEditing(t); setForm({ ...EMPTY, ...t }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.title) return toast.error("Title is required.");
    setSaving(true);
    if (editing) {
      await TaskAPI.update(editing.id, form);
      toast.success("Task updated.");
    } else {
      await TaskAPI.create(form);
      toast.success("Task created.");
    }
    qc.invalidateQueries({ queryKey: ["all-tasks"] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    setSaving(false);
    setShowModal(false);
  };

  const handleComplete = async (task) => {
    await TaskAPI.complete(task.id);
    toast.success("Task completed.");
    qc.invalidateQueries({ queryKey: ["all-tasks"] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const handleDelete = async () => {
    setDeleting(true);
    await TaskAPI.delete(confirmDelete.id);
    toast.success("Task deleted.");
    setDeleting(false);
    setConfirmDelete(null);
    qc.invalidateQueries({ queryKey: ["all-tasks"] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const getDueBadge = (task) => {
    if (!task.due_date || task.status === "completed") return null;
    const date = parseISO(task.due_date);
    if (isToday(date)) return <Badge className="text-[10px] bg-amber-100 text-amber-700 border-0">Due today</Badge>;
    if (isPast(date)) return <Badge className="text-[10px] bg-red-100 text-red-700 border-0">Overdue</Badge>;
    return null;
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500 mt-0.5">{counts.pending} open · {counts.overdue} overdue</p>
        </div>
        <Button onClick={openNew} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
          <Plus className="w-4 h-4" /> New Task
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input className="pl-9" placeholder="Search tasks…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white border">
          <TabsTrigger value="pending">Open ({counts.pending})</TabsTrigger>
          <TabsTrigger value="overdue" className={counts.overdue > 0 ? "text-red-600" : ""}>
            {counts.overdue > 0 && <AlertTriangle className="w-3 h-3 mr-1" />}
            Overdue ({counts.overdue})
          </TabsTrigger>
          <TabsTrigger value="completed">Completed ({counts.completed})</TabsTrigger>
        </TabsList>

        {["pending","overdue","completed"].map(t => (
          <TabsContent key={t} value={t} className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No tasks" description={t === "pending" ? "Create your first task." : `No ${t} tasks.`} actionLabel={t === "pending" ? "New Task" : undefined} onAction={t === "pending" ? openNew : undefined} />
            ) : (
              <Card className="border-0 shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/80">
                      <TableHead className="w-8" />
                      <TableHead className="text-xs font-semibold">Task</TableHead>
                      <TableHead className="text-xs font-semibold">Priority</TableHead>
                      <TableHead className="text-xs font-semibold">Status</TableHead>
                      <TableHead className="text-xs font-semibold">Due</TableHead>
                      <TableHead className="text-xs font-semibold">Assigned To</TableHead>
                      <TableHead className="text-xs font-semibold">Related</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(task => (
                      <TableRow key={task.id} className={`hover:bg-gray-50/60 ${task.status === "completed" ? "opacity-60" : ""}`}>
                        <TableCell>
                          <button onClick={() => task.status !== "completed" && handleComplete(task)} className="text-gray-300 hover:text-emerald-500 transition-colors">
                            {task.status === "completed"
                              ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              : <Circle className="w-4 h-4" />
                            }
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{task.title}</div>
                          {task.description && <div className="text-xs text-gray-400 truncate max-w-xs">{task.description}</div>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`text-[10px] capitalize ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`text-[10px] capitalize ${STATUS_COLORS[task.status]}`}>{task.status?.replace(/_/g, " ")}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500">{task.due_date ? format(parseISO(task.due_date), "MMM d") : "—"}</span>
                            {getDueBadge(task)}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">{task.assigned_to || "—"}</TableCell>
                        <TableCell>
                          {task.related_name ? (
                            <span className="text-xs text-gray-500">{task.related_name}</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(task)}>
                              <Pencil className="w-3.5 h-3.5 text-gray-400" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => setConfirmDelete(task)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Task" : "New Task"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Task title…" />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => set("priority", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["low","medium","high","urgent"].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["pending","in_progress","completed","cancelled"].map(s => <SelectItem key={s} value={s}>{s.replace(/_/g," ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => set("category", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g," ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Due Date</Label>
                <Input type="date" value={form.due_date} onChange={e => set("due_date", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Assigned To (email)</Label>
              <Input value={form.assigned_to} onChange={e => set("assigned_to", e.target.value)} placeholder="user@company.com" />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.title} className="bg-violet-600 hover:bg-violet-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? "Save Changes" : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Task?"
        description="This task will be permanently removed."
        confirmLabel="Delete"
      />
    </div>
  );
}