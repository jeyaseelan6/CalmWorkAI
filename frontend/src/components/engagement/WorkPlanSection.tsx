"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Sparkles,
  CheckCircle2,
  Circle,
  Clock,
  ShieldCheck,
  Check,
  AlertTriangle,
  Plus,
  Trash2,
  Lock,
  ListTodo,
  Calendar,
  X,
  ArrowRight,
  Filter,
  CheckSquare
} from "lucide-react";
import AgentProgressStream, { AgentStreamEvent } from "./AgentProgressStream";
import { API_BASE } from "@/utils/api";
import { formatISTDateTime } from "@/utils/date";

export interface WorkTask {
  id: string;
  milestone_id?: string;
  title: string;
  description?: string;
  why_it_matters?: string;
  dependencies?: string[];
  owner?: string | null;
  status: "TODO" | "IN_PROGRESS" | "COMPLETED" | "PLANNED";
  approval_status?: "APPROVED" | "PENDING_APPROVAL";
  due_date?: string;
  sequence_order?: number;
  linked_goal_id?: string;
}

export interface WorkPlanData {
  proposal_id?: string;
  engagement_id?: string;
  customer_name?: string;
  engagement_objective?: string;
  outcomes?: string[];
  definition_of_done?: Array<{ id: string; title: string; completed: boolean } | string>;
  milestones?: any[];
  tasks?: WorkTask[];
  version?: number;
  generated_at?: string;
}

interface WorkPlanSectionProps {
  engagementId: string;
  customerName: string;
  initialWorkPlan?: WorkPlanData | null;
  outcomeVersion?: number;
  onPlanApproved?: () => void;
}

function computePresetDue(offsetDays: number, hour: number, minute: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayPadded = String(d.getDate()).padStart(2, "0");
  const monthName = months[d.getMonth()];
  const year = d.getFullYear();
  const hourPadded = String(hour).padStart(2, "0");
  const minPadded = String(minute).padStart(2, "0");
  return `${dayPadded} ${monthName} ${year}, ${hourPadded}:${minPadded} IST`;
}

function formatCustomISTDueDate(dateStr: string, timeStr: string = "17:00"): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, min] = (timeStr || "17:00").split(":").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayPadded = String(day).padStart(2, "0");
  const monthName = months[month - 1] || "Oct";
  const hourPadded = String(hour || 17).padStart(2, "0");
  const minPadded = String(min || 0).padStart(2, "0");
  return `${dayPadded} ${monthName} ${year}, ${hourPadded}:${minPadded} IST`;
}

const getTodayDateStr = (): string => {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
};

const DUE_PRESETS = [
  { label: "Today EOD", offsetDays: 0, hour: 18, minute: 0 },
  { label: "Tomorrow Midday", offsetDays: 1, hour: 14, minute: 0 },
  { label: "Tomorrow EOD", offsetDays: 1, hour: 18, minute: 0 },
  { label: "+2 Days", offsetDays: 2, hour: 17, minute: 0 },
  { label: "+1 Week", offsetDays: 7, hour: 17, minute: 0 }
];

export default function WorkPlanSection({
  engagementId,
  customerName,
  initialWorkPlan = null,
  outcomeVersion = 1,
  onPlanApproved
}: WorkPlanSectionProps) {
  const { isManager, role, token } = useAuth();

  // Task list state
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [version, setVersion] = useState<number>(outcomeVersion);
  const [objective, setObjective] = useState<string>("");
  const [filter, setFilter] = useState<"ALL" | "TODO" | "IN_PROGRESS" | "COMPLETED" | "PENDING">("ALL");
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Modal states
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [editingDueDateTaskId, setEditingDueDateTaskId] = useState<string | null>(null);

  // Plan Agent Generation State
  const [planPrompt, setPlanPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamEvent, setStreamEvent] = useState<AgentStreamEvent | null>(null);
  const [generatedTasks, setGeneratedTasks] = useState<WorkTask[]>([]);

  // Manual Add Task Form State
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskWhy, setNewTaskWhy] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState(computePresetDue(0, 18, 0));
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  // Custom Due Date Form State
  const [customDate, setCustomDate] = useState(getTodayDateStr());
  const [customTime, setCustomTime] = useState("17:00");

  const notify = (message: string, type: "success" | "error" | "info" = "info") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Sync initialWorkPlan into flat tasks list
  useEffect(() => {
    if (initialWorkPlan) {
      setObjective(initialWorkPlan.engagement_objective || "");
      if (initialWorkPlan.version) setVersion(initialWorkPlan.version);

      let extracted: WorkTask[] = [];
      if (Array.isArray(initialWorkPlan.tasks) && initialWorkPlan.tasks.length > 0) {
        extracted = initialWorkPlan.tasks.map((t: any, idx: number) => ({
          id: t.id || `task-${idx + 1}`,
          milestone_id: t.milestone_id || "m-1",
          title: t.title || `Task ${idx + 1}`,
          description: t.description || t.why_it_matters || "",
          why_it_matters: t.why_it_matters || t.description || "",
          status: t.status === "COMPLETED" ? "COMPLETED" : t.status === "IN_PROGRESS" ? "IN_PROGRESS" : "TODO",
          approval_status: t.approval_status || "APPROVED",
          due_date: t.due_date || computePresetDue(idx, 17, 0),
          sequence_order: t.sequence_order || idx + 1
        }));
      } else if (Array.isArray(initialWorkPlan.milestones)) {
        initialWorkPlan.milestones.forEach((m: any, mIdx: number) => {
          if (Array.isArray(m.deliverables)) {
            m.deliverables.forEach((del: string, dIdx: number) => {
              extracted.push({
                id: `task-ms-${mIdx + 1}-${dIdx + 1}`,
                milestone_id: m.id || `m-${mIdx + 1}`,
                title: del,
                why_it_matters: `Milestone: ${m.title || `Phase ${mIdx + 1}`}`,
                status: "TODO",
                approval_status: "APPROVED",
                due_date: computePresetDue(extracted.length, 17, 0),
                sequence_order: extracted.length + 1
              });
            });
          }
        });
      }
      setTasks(extracted);
    } else if (engagementId) {
      // Fetch plan from backend
      fetch(`${API_BASE}/engagements/${engagementId}/plan`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.success && data?.data) {
            setObjective(data.data.statement || data.data.work_plan?.engagement_objective || "");
            if (data.data.version) setVersion(data.data.version);
            const wpTasks = data.data.work_plan?.tasks || [];
            setTasks(
              wpTasks.map((t: any, idx: number) => ({
                id: t.id || `task-${idx + 1}`,
                title: t.title,
                description: t.description || t.why_it_matters,
                status: t.status || "TODO",
                approval_status: t.approval_status || "APPROVED",
                due_date: t.due_date || computePresetDue(idx, 17, 0),
                sequence_order: t.sequence_order || idx + 1
              }))
            );
          }
        })
        .catch(() => {});
    }
  }, [engagementId, initialWorkPlan, outcomeVersion]);

  // Derived Task Counts
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
  const inProgressTasks = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const pendingApprovalTasks = tasks.filter((t) => t.approval_status === "PENDING_APPROVAL").length;

  const filteredTasks = useMemo(() => {
    switch (filter) {
      case "TODO":
        return tasks.filter((t) => t.status === "TODO");
      case "IN_PROGRESS":
        return tasks.filter((t) => t.status === "IN_PROGRESS");
      case "COMPLETED":
        return tasks.filter((t) => t.status === "COMPLETED");
      case "PENDING":
        return tasks.filter((t) => t.approval_status === "PENDING_APPROVAL");
      default:
        return tasks;
    }
  }, [tasks, filter]);

  // Status toggle handler
  const handleToggleTaskStatus = async (task: WorkTask) => {
    if (task.approval_status === "PENDING_APPROVAL") {
      notify("Task is awaiting Manager approval before it can be started.", "error");
      return;
    }

    const nextStatus = task.status === "COMPLETED" ? "TODO" : task.status === "IN_PROGRESS" ? "COMPLETED" : "IN_PROGRESS";

    // Optimistic UI update
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/engagements/${engagementId}/tasks/${task.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: nextStatus })
      });

      if (!res.ok) throw new Error("Failed to update status on server");
      notify(`Task updated: ${task.title} ➔ ${nextStatus}`, "success");
      if (onPlanApproved) onPlanApproved();
    } catch {
      // Revert optimistic update
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)));
      notify("Could not update task status.", "error");
    }
  };

  // Manager Approve Task
  const handleApproveTask = async (task: WorkTask) => {
    if (!isManager && role !== "MANAGER") {
      notify("Only Engineering Managers can approve tasks.", "error");
      return;
    }

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/engagements/${engagementId}/tasks/${task.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ approval_status: "APPROVED" })
      });

      if (res.ok) {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, approval_status: "APPROVED" } : t)));
        notify(`Task approved: '${task.title}' is now authorized work!`, "success");
        if (onPlanApproved) onPlanApproved();
      } else {
        throw new Error("Approval rejected by server");
      }
    } catch (e: any) {
      notify(e.message || "Failed to approve task.", "error");
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId: string, title: string) => {
    if (!confirm(`Are you sure you want to remove task: "${title}"?`)) return;

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/engagements/${engagementId}/tasks/${taskId}`, {
        method: "DELETE",
        headers
      });

      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        notify(`Task removed: "${title}"`, "info");
        if (onPlanApproved) onPlanApproved();
      } else {
        throw new Error("Server rejected deletion");
      }
    } catch {
      notify("Failed to delete task.", "error");
    }
  };

  // Manual Add Task Submit
  const handleCreateManualTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    setIsSubmittingTask(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/engagements/${engagementId}/tasks`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          description: newTaskWhy.trim() || `Operational work task for ${customerName}`,
          due_date: newTaskDueDate,
          status: "TODO"
        })
      });

      if (res.ok) {
        const json = await res.json();
        const created: WorkTask = json.data;
        setTasks((prev) => [...prev, created]);
        setShowAddTaskModal(false);
        setNewTaskTitle("");
        setNewTaskWhy("");
        notify(
          isManager || role === "MANAGER"
            ? `Task created & approved: "${created.title}"`
            : `Task created & submitted for Manager approval: "${created.title}"`,
          "success"
        );
        if (onPlanApproved) onPlanApproved();
      } else {
        throw new Error("Server rejected new task");
      }
    } catch {
      notify("Failed to create task.", "error");
    } finally {
      setIsSubmittingTask(false);
    }
  };

  // Plan Agent Generation Trigger
  const handleGeneratePlanTasks = async () => {
    if (!planPrompt.trim()) return;
    setIsGenerating(true);
    setStreamEvent({
      agent: "PLAN",
      stage: "INIT",
      message: "Plan Agent analyzing requirements, architecture specs, and sequencing tasks...",
      step: 1,
      total_steps: 4
    });
    setGeneratedTasks([]);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/engagements/${engagementId}/plan/propose/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          natural_language_description: planPrompt.trim(),
          session_id: `plan-gen-${Date.now()}`
        })
      });

      if (!res.ok || !res.body) throw new Error("Streaming unavailable");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ")) {
            try {
              const event: AgentStreamEvent = JSON.parse(trimmed.slice(6));
              if (event.type === "progress") {
                setStreamEvent(event);
              } else if (event.type === "complete" && event.data) {
                const prop = event.data;
                const newItems: WorkTask[] = [];

                if (Array.isArray(prop.tasks) && prop.tasks.length > 0) {
                  prop.tasks.forEach((t: any, idx: number) => {
                    newItems.push({
                      id: `task-gen-${Date.now()}-${idx + 1}`,
                      title: t.title,
                      description: t.description || t.why_it_matters || `Generated by Plan Agent for ${customerName}`,
                      status: "TODO",
                      approval_status: "APPROVED",
                      due_date: t.due_date || computePresetDue(idx + 1, 17, 0),
                      sequence_order: idx + 1
                    });
                  });
                } else if (Array.isArray(prop.milestones)) {
                  prop.milestones.forEach((m: any, mIdx: number) => {
                    if (Array.isArray(m.deliverables)) {
                      m.deliverables.forEach((del: string, dIdx: number) => {
                        newItems.push({
                          id: `task-gen-${Date.now()}-${mIdx + 1}-${dIdx + 1}`,
                          title: del,
                          description: `Milestone: ${m.title || `Phase ${mIdx + 1}`}`,
                          status: "TODO",
                          approval_status: "APPROVED",
                          due_date: computePresetDue(newItems.length + 1, 17, 0),
                          sequence_order: newItems.length + 1
                        });
                      });
                    }
                  });
                }

                setGeneratedTasks(newItems);
                setStreamEvent(null);
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    } catch {
      notify("Plan Agent was unable to generate tasks right now. Try again shortly.", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  // Ingest Plan Agent Generated Tasks to Active Database Plan
  const handleIngestGeneratedTasks = async () => {
    if (generatedTasks.length === 0) return;
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/engagements/${engagementId}/tasks`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          tasks: generatedTasks
        })
      });

      if (res.ok) {
        const json = await res.json();
        const serverTasks = (json.data && json.data.length > 0) ? json.data : generatedTasks;
        setTasks((prev) => [...prev, ...serverTasks]);
        setShowGenerateModal(false);
        setPlanPrompt("");
        setGeneratedTasks([]);
        notify(json.message || `Ingested ${generatedTasks.length} tasks into active work plan!`, "success");
        if (onPlanApproved) onPlanApproved();
      } else {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || errJson.message || `Failed to save tasks (${res.status})`);
      }
    } catch (err: any) {
      notify(err?.message || "Failed to save generated tasks to plan.", "error");
    }
  };

  // Quick Due Date Reschedule
  const handleSaveDueDate = async (newDue: string) => {
    if (!editingDueDateTaskId) return;
    const task = tasks.find((t) => t.id === editingDueDateTaskId);
    if (!task) return;

    setTasks((prev) => prev.map((t) => (t.id === editingDueDateTaskId ? { ...t, due_date: newDue } : t)));

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      await fetch(`${API_BASE}/engagements/${engagementId}/tasks/${editingDueDateTaskId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ due_date: newDue })
      });
      notify(`Due date set to ${newDue}`, "success");
      setEditingDueDateTaskId(null);
      if (onPlanApproved) onPlanApproved();
    } catch {
      notify("Failed to update due date.", "error");
    }
  };

  const editingTask = tasks.find((t) => t.id === editingDueDateTaskId);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 p-3 rounded-lg text-xs font-semibold shadow-lg flex items-center gap-2 animate-fadeIn border ${
            notification.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-300"
              : notification.type === "error"
              ? "bg-rose-50 text-rose-900 border-rose-300"
              : "bg-slate-900 text-white border-slate-800"
          }`}
        >
          {notification.type === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-rose-600" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-indigo-600" />
            <h1 className="text-xl font-bold font-display text-slate-900">Plan &amp; Tasks</h1>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-semibold border border-slate-200">
              Active Plan v{version}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative delivery tasks, target due dates, and manager approval governance for {customerName}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Plan Agent Generation Trigger */}
          <button
            type="button"
            onClick={() => setShowGenerateModal(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-200" />
            <span>Generate Tasks with Plan Agent</span>
          </button>

          {/* Manual Add Task Button */}
          <button
            type="button"
            onClick={() => setShowAddTaskModal(true)}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ Add Task</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Total Tasks</span>
          <p className="text-xl font-bold font-display text-slate-900 mt-0.5">{totalTasks}</p>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase">Completed</span>
          <p className="text-xl font-bold font-display text-emerald-700 mt-0.5">{completedTasks}</p>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-mono font-bold text-blue-600 uppercase">In Progress</span>
          <p className="text-xl font-bold font-display text-blue-700 mt-0.5">{inProgressTasks}</p>
        </div>
        <div className={`p-3 border rounded-xl shadow-2xs ${pendingApprovalTasks > 0 ? "bg-amber-50 border-amber-300" : "bg-white border-slate-200"}`}>
          <span className={`text-[10px] font-mono font-bold uppercase ${pendingApprovalTasks > 0 ? "text-amber-800" : "text-slate-400"}`}>
            Pending Approval
          </span>
          <p className={`text-xl font-bold font-display mt-0.5 ${pendingApprovalTasks > 0 ? "text-amber-900 font-black" : "text-slate-900"}`}>
            {pendingApprovalTasks}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 text-xs overflow-x-auto no-scrollbar">
        <button
          onClick={() => setFilter("ALL")}
          className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
            filter === "ALL" ? "bg-slate-900 text-white font-bold" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          All Tasks ({totalTasks})
        </button>
        <button
          onClick={() => setFilter("TODO")}
          className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
            filter === "TODO" ? "bg-slate-900 text-white font-bold" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          To Do ({tasks.filter((t) => t.status === "TODO").length})
        </button>
        <button
          onClick={() => setFilter("IN_PROGRESS")}
          className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
            filter === "IN_PROGRESS" ? "bg-slate-900 text-white font-bold" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          In Progress ({inProgressTasks})
        </button>
        <button
          onClick={() => setFilter("COMPLETED")}
          className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
            filter === "COMPLETED" ? "bg-slate-900 text-white font-bold" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Completed ({completedTasks})
        </button>
        {pendingApprovalTasks > 0 && (
          <button
            onClick={() => setFilter("PENDING")}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
              filter === "PENDING" ? "bg-amber-500 text-slate-950 shadow-sm" : "bg-amber-100 text-amber-900 hover:bg-amber-200"
            }`}
          >
            <span>Needs Manager Approval</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-amber-400 text-slate-950 rounded-full font-mono">{pendingApprovalTasks}</span>
          </button>
        )}
      </div>

      {/* Tasks List */}
      <div className="space-y-2.5">
        {filteredTasks.length === 0 ? (
          <div className="p-8 text-center bg-white border border-slate-200 rounded-xl space-y-3">
            <ListTodo className="h-8 w-8 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-500 font-medium">No tasks found in this view.</p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                onClick={() => setShowGenerateModal(true)}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded text-xs transition"
              >
                Generate with Plan Agent
              </button>
              <button
                onClick={() => setShowAddTaskModal(true)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded text-xs transition"
              >
                + Add Manual Task
              </button>
            </div>
          </div>
        ) : (
          filteredTasks.map((task, idx) => {
            const isCompleted = task.status === "COMPLETED";
            const isInProgress = task.status === "IN_PROGRESS";
            const isPending = task.approval_status === "PENDING_APPROVAL";

            return (
              <div
                key={task.id}
                className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isPending
                    ? "bg-amber-50/70 border-amber-300 shadow-2xs"
                    : isCompleted
                    ? "bg-slate-50 border-slate-200 opacity-80"
                    : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
                }`}
              >
                {/* Left side: Status toggle & Task details */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => handleToggleTaskStatus(task)}
                    className="mt-0.5 text-slate-400 hover:text-slate-900 transition shrink-0 cursor-pointer focus:outline-none"
                    title={isPending ? "Awaiting Manager Approval" : "Click to advance status"}
                  >
                    {isPending ? (
                      <Lock className="h-4 w-4 text-amber-600" />
                    ) : isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : isInProgress ? (
                      <div className="h-4 w-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                    ) : (
                      <Circle className="h-4 w-4 text-slate-300 hover:text-slate-600" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold ${isCompleted ? "line-through text-slate-400" : "text-slate-900"}`}>
                        {task.title}
                      </span>

                      {/* Approval Status Badge */}
                      {isPending ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-900 font-bold flex items-center gap-1">
                          <Lock className="h-3 w-3 text-amber-700" />
                          <span>Pending Approval</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
                          Approved
                        </span>
                      )}

                      {/* Status Pill */}
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                          isCompleted
                            ? "bg-emerald-100 text-emerald-800"
                            : isInProgress
                            ? "bg-blue-100 text-blue-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {task.status}
                      </span>
                    </div>

                    {task.description && (
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{task.description}</p>
                    )}
                  </div>
                </div>

                {/* Right side: Target Due Date & Actions */}
                <div className="flex items-center gap-2 sm:self-center shrink-0">
                  {/* Clickable Target Due Date Badge */}
                  <button
                    type="button"
                    onClick={() => setEditingDueDateTaskId(task.id)}
                    title="Click to reschedule due date"
                    className="flex items-center gap-1 text-[11px] font-mono font-medium px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition cursor-pointer shadow-2xs"
                  >
                    <Clock className="h-3 w-3 text-slate-400" />
                    <span>{task.due_date || "Set due date"}</span>
                  </button>

                  {/* Manager Quick-Approve Button (Shown only for Manager when task is pending approval) */}
                  {(isManager || role === "MANAGER") && isPending && (
                    <button
                      type="button"
                      onClick={() => handleApproveTask(task)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold flex items-center gap-1 shadow-2xs transition cursor-pointer"
                      title="Manager Authorization: Approve task for production work"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Approve Task</span>
                    </button>
                  )}

                  {/* Delete Task */}
                  <button
                    type="button"
                    onClick={() => handleDeleteTask(task.id, task.title)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                    title="Delete task"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL 1: Generate Tasks with Plan Agent */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-slate-900 text-sm">Plan Agent Task Generator</h3>
                  <p className="text-[10px] text-slate-500">Autonomous requirement breakdown &amp; task sequencing</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowGenerateModal(false);
                  setGeneratedTasks([]);
                  setStreamEvent(null);
                }}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">
                Describe deployment scope or deliverables:
              </label>
              <textarea
                rows={3}
                value={planPrompt}
                onChange={(e) => setPlanPrompt(e.target.value)}
                placeholder="e.g. Migrate 50M records to Cloud SQL. Verify failover with under 15 min cutover window. Security team requires architecture signoff."
                className="w-full text-xs p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-600 shadow-2xs resize-none"
              />
              {/* Quick suggestions */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] text-slate-400">Examples:</span>
                <button
                  type="button"
                  onClick={() =>
                    setPlanPrompt(
                      `Execute database migration for ${customerName} to Cloud SQL with zero data loss, dry run rehearsals, and cutover testing.`
                    )
                  }
                  className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 transition"
                >
                  Database Cutover
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPlanPrompt(
                      `Implement SSO security integration, RBAC auditing, and compliance verification for ${customerName}.`
                    )
                  }
                  className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 transition"
                >
                  SSO &amp; Security
                </button>
              </div>
            </div>

            {/* Live Streaming Indicator */}
            {isGenerating && (
              <div className="p-3 rounded-lg bg-slate-900 text-white space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
                    <span>Plan Agent Sequencing Tasks...</span>
                  </div>
                  <span className="text-[10px] font-mono text-indigo-300">Step {streamEvent?.step || 1} of 4</span>
                </div>
                <p className="text-[11px] text-slate-300">{streamEvent?.message || "Analyzing enterprise architecture specs..."}</p>
              </div>
            )}

            {/* Generated Tasks Preview */}
            {generatedTasks.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    Generated Tasks ({generatedTasks.length}):
                  </span>
                  <span className="text-[10px] text-emerald-700 font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Target Due Dates Assigned
                  </span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
                  {generatedTasks.map((t, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-900 truncate pr-2">{t.title}</span>
                      <span className="text-[10px] font-mono text-slate-500 shrink-0">{t.due_date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 transition"
              >
                Cancel
              </button>
              {generatedTasks.length > 0 ? (
                <button
                  type="button"
                  onClick={handleIngestGeneratedTasks}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Ingest {generatedTasks.length} Tasks to Plan</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGeneratePlanTasks}
                  disabled={isGenerating || !planPrompt.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{isGenerating ? "Generating..." : "Generate Tasks"}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Manual Task */}
      {showAddTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-fadeIn">
          <form
            onSubmit={handleCreateManualTask}
            className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-slate-900" />
                <h3 className="font-display font-bold text-slate-900 text-sm">Create New Work Task</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddTaskModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Role Governance Banner */}
            <div
              className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                isManager || role === "MANAGER"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
                  : "bg-amber-50 border border-amber-200 text-amber-900"
              }`}
            >
              {isManager || role === "MANAGER" ? (
                <>
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Manager Mode:</strong> Task will be created as <em>Approved Work</em>.
                  </span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>FDE Mode:</strong> Task will be submitted for Manager authorization.
                  </span>
                </>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g. Complete schema validation for payments database"
                  className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 shadow-2xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Why it matters (Description)</label>
                <textarea
                  rows={2}
                  value={newTaskWhy}
                  onChange={(e) => setNewTaskWhy(e.target.value)}
                  placeholder="e.g. Required before initiating the migration pipeline rehearsal."
                  className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 shadow-2xs resize-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Target Due Date (IST)</label>
                {/* Presets */}
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  {DUE_PRESETS.map((p) => {
                    const presetStr = computePresetDue(p.offsetDays, p.hour, p.minute);
                    const isSelected = newTaskDueDate === presetStr;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setNewTaskDueDate(presetStr)}
                        className={`text-[10px] px-2 py-1 rounded font-mono transition cursor-pointer ${
                          isSelected
                            ? "bg-slate-900 text-white font-bold"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                <div className="p-2 rounded bg-slate-50 border border-slate-200 text-[11px] font-mono font-medium text-slate-800">
                  {newTaskDueDate}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddTaskModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingTask || !newTaskTitle.trim()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-50"
              >
                {isSubmittingTask ? "Saving..." : "Create Task"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: Reschedule Task Due Date */}
      {editingDueDateTaskId && editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-700" />
                <h3 className="font-bold text-slate-900 text-xs">Reschedule Task Due Date</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingDueDateTaskId(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs font-medium text-slate-800 line-clamp-1">{editingTask.title}</p>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Quick Presets:</span>
              <div className="grid grid-cols-2 gap-1.5">
                {DUE_PRESETS.map((p) => {
                  const val = computePresetDue(p.offsetDays, p.hour, p.minute);
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => handleSaveDueDate(val)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left text-xs text-slate-800 transition cursor-pointer font-medium"
                    >
                      <div className="font-bold">{p.label}</div>
                      <div className="text-[10px] font-mono text-slate-500">{val.split(",")[1]}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Date / Time */}
            <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Custom IST Date:</span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="p-2 border border-slate-200 rounded text-xs"
                />
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="p-2 border border-slate-200 rounded text-xs"
                />
              </div>
              <button
                type="button"
                onClick={() => handleSaveDueDate(formatCustomISTDueDate(customDate, customTime))}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Apply Custom Date
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
