import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TaskAPI } from "../components/api/secureApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Loader2, Save, CalendarDays } from "lucide-react";
import { format, isPast } from "date-fns";

const priorityColors = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-50 text-blue-700",
  high: "bg-amber-50 text-amber-700",
  urgent: "bg-red-50 text-red-700",
};

export default function Tasks() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", due_date: "", priority: "medium", category: "other", assigned_to: "" });
  const queryClient = useQueryClient();

  const { data: tasks = [] } = useQuery({
    queryKey: ["all-tasks"],
    queryFn: () => TaskAPI.list({}, "-created_date", 200),
  });

  const filtered = tasks.filter(t => {
    const matchSearch = !search || t.title?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || (statusFilter === "active" && t.status !== "completed" && t.status !== "cancelled") || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleSave = async () => {
    setSaving(true);
    await TaskAPI.create(form);
    setForm({ title: "", description: "", due_date: "", priority: "medium", category: "other", assigned_to: "" });
    setSaving(false);
    setDialogOpen(false);
    queryClient.invalidateQueries(["all-tasks"]);
  };

  const toggleTask = async (task) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    if (newStatus === "completed") {
      await TaskAPI.complete(task.id);
    } else {
      await TaskAPI.update(task.id, { status: "pending", completed_date: null });
    }
    queryClient.invalidateQueries(["all-tasks"]);
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Tasks</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} tasks</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 text-sm h-9">
              <Plus className="w-4 h-4 mr-1.5" /> New Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
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
                <div><Label className="text-xs">Assigned To (email)</Label><Input value={form.assigned_to} onChange={e => setForm({...form, assigned_to: e.target.value})} className="mt-1" /></div>
              </div>
              <Button onClick={handleSave} disabled={saving || !form.title} className="w-full bg-violet-600 hover:bg-violet-700">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Create Task
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filtered.map(task => {
          const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== "completed";
          return (
            <Card key={task.id} className={`border-0 shadow-sm ${task.status === "completed" ? "opacity-60" : isOverdue ? "ring-1 ring-red-200" : ""}`}>
              <CardContent className="p-4 flex items-start gap-3">
                <Checkbox checked={task.status === "completed"} onCheckedChange={() => toggleTask(task)} className="mt-1" />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${task.status === "completed" ? "line-through text-gray-400" : "text-gray-900"}`}>{task.title}</p>
                  {task.description && <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>}
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
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && <div className="text-center py-16 text-gray-400 text-sm">No tasks found.</div>}
      </div>
    </div>
  );
}