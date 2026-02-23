import React from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { format, isPast } from "date-fns";
import { base44 } from "@/api/base44Client";

const priorityColors = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-50 text-blue-700",
  high: "bg-amber-50 text-amber-700",
  urgent: "bg-red-50 text-red-700",
};

export default function TaskList({ tasks, onUpdate }) {
  const handleToggle = async (task) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    await base44.entities.Task.update(task.id, {
      status: newStatus,
      completed_date: newStatus === "completed" ? new Date().toISOString() : null,
    });
    onUpdate?.();
  };

  if (!tasks?.length) {
    return (
      <div className="text-center py-10 text-gray-400 text-sm">
        No tasks. You're all caught up!
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.slice(0, 8).map(task => {
        const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== "completed";
        return (
          <div
            key={task.id}
            className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
              task.status === "completed" ? "bg-gray-50/50 opacity-60" : isOverdue ? "bg-red-50/30 border-red-200" : "bg-white"
            }`}
          >
            <Checkbox
              checked={task.status === "completed"}
              onCheckedChange={() => handleToggle(task)}
              className="mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${task.status === "completed" ? "line-through text-gray-400" : "text-gray-900"}`}>
                {task.title}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {task.due_date && (
                  <span className={`text-xs ${isOverdue ? "text-red-600 font-medium" : "text-gray-400"}`}>
                    {isOverdue ? "Overdue: " : ""}{format(new Date(task.due_date), "MMM d")}
                  </span>
                )}
                <Badge variant="secondary" className={`text-[10px] ${priorityColors[task.priority]}`}>
                  {task.priority}
                </Badge>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}