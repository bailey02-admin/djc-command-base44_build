import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TaskAPI } from "../components/api/secureApi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Loader2, Save, CalendarDays, Pencil, Trash2, CheckSquare } from "lucide-react";
import { format, isPast } from "date-fns";
import { toast } from "sonner";
import ConfirmDialog from "../components/common/ConfirmDialog";
import EmptyState from "../components/common/EmptyState";

const priorityColors = { low: "bg-gray-100 text-gray-600", medium: "bg-blue-50 text-blue-700", high: "bg-amber-50 text-amber-700", urgent: "bg-red-50 text-red-700" };
const EMPTY = { title: "", description: "", due_date: "", priority: "medium", category: "other", assigned_to: "", notes: "" };

export default function Tasks() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["all-tasks"],
    queryFn: () => TaskAPI.list({}, "-due_date", 300),
  });

  const filtered = tasks.filter(t => {
    const matchSearch = !search || t.title?.toLowerCase().includes(search.toLowerCase()) || t.assigned_to?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all"
      || (statusFilter === "active" && t.status !== "completed" && t.status !== "cancelled")
      || t.status === statusFilter;
    const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  const overdueCount = tasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && t.status !== "completed" && t.status !== "cancelled").length;

  const openNew = () => { setEditingId(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (t) => { setEditingId(t.id); setForm({ ...EMPTY, ...t }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.title) return toast.error("Title is required.");
    setSaving(true);
    if (editingId) {
      await TaskAPI.update(editingId, form);
      toast.success("Task updated.");
    } else {
      await TaskAPI.create(form);
      toast.success("Task created.");
    }
    setSaving(false);
    setDialogOpen(false);
    queryClient.invalidateQueries(["all-tasks"]);
  };

  const toggleTask = async (task) => {
    if (task.status === "completed") {
      await TaskAPI.update(task.id, { status: "pending", completed_date: null });
    } else {
      await TaskAPI.complete(task.id);
    }
    queryClient.invalidateQueries(["all-tasks"]);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await TaskAPI.delete(confirmDelete.id);
    toast.success("Task deleted.");
    setDeleting(false);
    setConfirmDelete(null);
    queryClient.invalidateQueries(["all-tasks"]);
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Tasks</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length} tasks
            {overdueCount > 0 && <span className="ml-2 text-red-600 font-medium">{overdueCount} overdue</span>}
          </p>
        </div>
        <Button onClick={openNew} className="bg-gradient-to-r from-violet-600 to-indigo-600 text-sm h-9">
          <Plus className="w-4 h-4 mr-1.5" /> New Task
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm bg-white" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-32 h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={CheckSquare} title="No tasks found" description="Create a task to get started." actionLabel={statusFilter === "active" && !search ? "New Task" : undefined} onAction={openNew} />
      ) : (
        <div className="space-y-2">
          {filtered.map(task => {
            const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== "completed" && task.status !== "cancelled";
            return (
              <Card key={task.id} className={`border-0 shadow-sm ${task.status === "completed" ? "opacity-60" : isOverdue ? "ring-1 ring-red-200" : ""}`}>
                <CardContent className="p-4 flex items-start gap-3">
                  <Checkbox checked={task.status === "completed"} onCheckedChange={() => toggleTask(task)} className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${task.status === "completed" ? "line-through text-gray-400" : "text-gray-900"}`}>{task.title}</p>
                    {task.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>}
                    {task.related_name && <p className="text-xs text-violet-600 mt-0.5">↳ {task.related_name}</p>}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {task.due_date && (
                        <span className={`text-xs flex items-center gap-1 ${isOverdue ? "text-red-600 font-medium" : "text-gray-400"}`}>
                          <CalendarDays className="w-3 h-3" />
                          {isOverdue ? "Overdue: " : ""}{format(new Date(task.due_date), "MMM d")}
                        </span>
                      )}
                      <Badge variant="secondary" className={`text-[10px] ${priorityColors[task.priority]}`}>{task.priority}</Badge>
                      <Badge variant="outline" className="text-[10px] capitalize">{task.category?.replace(/_/g, " ")}</Badge>
                      {task.assigned_to && <span className="text-[10px] text-gray-400">→ {task.assigned_to}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(task)}>
                      <Pencil className="w-3.5 h-3.5 text-gray-400" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => setConfirmDelete(task)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingId ? "Edit Task" : "New Task"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-xs">Title *</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="mt-1" /></div>
            <div><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} className="mt-1" /></div>
              <div><Label className="text-xs">Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm({...form, priority: v})}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Category</Label>
                <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["follow_up","call","email","planning","finalization","dj_prep","payment","contract","survey","review","other"].map(c => (
                      <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Assigned To</Label><Input value={form.assigned_to} onChange={e => setForm({...form, assigned_to: e.target.value})} className="mt-1" placeholder="email or name" /></div>
            </div>
            {editingId && (
              <div><Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div><Label className="text-xs">Notes</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="mt-1" /></div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !form.title} className="bg-violet-600 hover:bg-violet-700">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                {editingId ? "Update Task" : "Create Task"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Task?"
        description={`"${confirmDelete?.title}" will be permanently removed.`}
        confirmLabel="Delete Task"
      />
    </div>
  );
}