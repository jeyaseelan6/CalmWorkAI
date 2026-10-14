"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useEngagement } from "@/context/EngagementContext";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  RefreshCw,
  ShieldCheck,
  Sun,
  Sparkles,
  Clock,
  Zap,
  X,
  Target,
  Plus,
  Building2,
  Check,
  Edit2
} from "lucide-react";
import Link from "next/link";
import { MorningBriefData, WhatChangedItem } from "@/components/engagement/DailyWorkBriefing";
import CreateEngagementModal from "@/components/engagement/CreateEngagementModal";
import { formatISTDateTime, getNowISTTime } from "@/utils/date";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function formatWorkCycle(cycle?: string): string {
  if (!cycle) return "";
  let clean = cycle.replace(/^WorkCycleStep\./, "").replace(/^STEP_\d+_/, "");
  clean = clean.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  return clean;
}

function formatRoleName(role?: string): string {
  if (!role) return "";
  let clean = role.replace(/_/g, " ");
  return clean.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
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

const DUE_PRESET_CONFIG = [
  { label: "Today EOD", shortTime: "18:00 IST", offsetDays: 0, hour: 18, minute: 0 },
  { label: "Tomorrow Midday", shortTime: "14:00 IST", offsetDays: 1, hour: 14, minute: 0 },
  { label: "Tomorrow EOD", shortTime: "18:00 IST", offsetDays: 1, hour: 18, minute: 0 },
  { label: "+2 Days", shortTime: "17:00 IST", offsetDays: 2, hour: 17, minute: 0 },
  { label: "+3 Days", shortTime: "17:00 IST", offsetDays: 3, hour: 17, minute: 0 },
  { label: "+1 Week", shortTime: "17:00 IST", offsetDays: 7, hour: 17, minute: 0 }
];

interface MyDayViewProps {
  embedded?: boolean;
}

export default function MyDayView({ embedded = false }: MyDayViewProps) {
  const { role } = useAuth();
  const {
    activeCustomer,
    activeEngagementData,
    nextActionData,
    loading: engagementLoading,
    approvedAcme,
    fetchEngagementDetail
  } = useEngagement();

  const [brief, setBrief] = useState<MorningBriefData | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");
  const [showEvidence, setShowEvidence] = useState(false);
  const [streamEvent, setStreamEvent] = useState<{
    agent?: string;
    stage?: string;
    message?: string;
    step?: number;
    total_steps?: number;
  } | null>(null);

  // Clear brief and local tasks when active customer changes so it never auto-runs
  useEffect(() => {
    setBrief(null);
    setLastRefreshed("");
    setStreamEvent(null);
    setLocalTasks([]);
  }, [activeCustomer?.id]);

  // Run sequential Morning Brief (UNDERSTAND -> PLAN/KNOW -> MOVE) only on explicit click
  const runMorningBrief = useCallback(async () => {
    if (!activeCustomer?.id) return;
    setBriefLoading(true);
    setStreamEvent({
      agent: "SUPERVISOR",
      stage: "INIT",
      message: "Starting sequential Morning Brief across UNDERSTAND, PLAN, and MOVE agents...",
      step: 1,
      total_steps: 5
    });

    try {
      const res = await fetch(`${API_BASE}/engagements/${activeCustomer.id}/supervisor/brief/stream`, {
        method: "POST"
      });

      if (!res.ok || !res.body) {
        throw new Error("Stream not available, using fallback");
      }

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
              const event = JSON.parse(trimmed.slice(6));
              if (event.type === "progress") {
                setStreamEvent(event);
              } else if (event.type === "complete" && event.data) {
                setBrief(event.data);
                setLastRefreshed(getNowISTTime(true));
                setStreamEvent(null);
                fetchEngagementDetail(activeCustomer.id);
              }
            } catch (e) {
              console.warn("SSE parse error in brief stream:", e);
            }
          }
        }
      }
    } catch (err) {
      console.warn("Streaming morning brief encountered error, using standard fallback:", err);
      try {
        const fallbackRes = await fetch(`${API_BASE}/engagements/${activeCustomer.id}/supervisor/brief`, {
          method: "POST"
        });
        const fallbackData = await fallbackRes.json();
        if (fallbackData.success && fallbackData.data) {
          setBrief(fallbackData.data);
          setLastRefreshed(getNowISTTime(true));
          fetchEngagementDetail(activeCustomer.id);
        }
      } catch (fallbackErr) {
        console.error("Failed to generate Morning Brief:", fallbackErr);
      }
    } finally {
      setBriefLoading(false);
      setStreamEvent(null);
    }
  }, [activeCustomer?.id, fetchEngagementDetail]);

  const handleSyncAll = () => {
    fetchEngagementDetail(activeCustomer.id);
    if (brief) {
      runMorningBrief();
    }
  };

  const isAcme = activeCustomer.id === "eng-acme-001";
  const outcomeStatement =
    brief?.what_matters_today_outcome ||
    activeEngagementData?.outcome?.statement ||
    activeEngagementData?.outcome?.work_plan?.engagement_objective ||
    activeCustomer.engagementName;

  const outcomeVersion =
    brief?.source_state_version ??
    activeEngagementData?.outcome?.version ??
    (isAcme && approvedAcme ? 2 : 1);

  const rawStatus = brief?.outcome_health ?? activeEngagementData?.engagement?.status ?? activeCustomer.status;
  const outcomeStatus = rawStatus === "HEALTHY" ? "HEALTHY" : "NEEDS_REASSESSMENT";

  // Success criteria / Outcome Goals
  const successCriteria = React.useMemo(() => {
    if (activeEngagementData?.outcome?.success_criteria && activeEngagementData.outcome.success_criteria.length > 0) {
      return activeEngagementData.outcome.success_criteria.map((c: any, idx: number) => {
        if (typeof c === "string") return { id: `sc-${idx + 1}`, title: c, completed: false };
        return {
          id: c.id || `sc-${idx + 1}`,
          title: c.title || c.statement || String(c),
          completed: Boolean(c.completed)
        };
      });
    }
    if (activeEngagementData?.outcome?.work_plan?.definition_of_done && activeEngagementData.outcome.work_plan.definition_of_done.length > 0) {
      return activeEngagementData.outcome.work_plan.definition_of_done.map((d: any, idx: number) => {
        if (typeof d === "string") return { id: `dod-${idx + 1}`, title: d, completed: false };
        return {
          id: d.id || `dod-${idx + 1}`,
          title: d.title || String(d),
          completed: Boolean(d.completed)
        };
      });
    }
    return [
      { id: "sc-1", title: `Baseline architecture assessment completed for ${activeCustomer.customerName}`, completed: false },
      { id: "sc-2", title: "Core migration workflows implemented and validated", completed: false },
      { id: "sc-3", title: "Production verification and signoff completed", completed: false }
    ];
  }, [activeEngagementData, activeCustomer.customerName]);

  const completedCount = successCriteria.filter((c: any) => c.completed).length;
  const progressPct = successCriteria.length > 0
    ? Math.round((completedCount / successCriteria.length) * 100)
    : 0;

  const pendingApprovalsCount = activeEngagementData?.pending_approvals_count ?? (approvedAcme ? 0 : 1);

  // Complete MOVE Agent output (from Morning Brief if run, fallback to nextActionData)
  const moveData = brief?.next_best_action || nextActionData;

  // Daily Work Plan values directly derived from Morning Brief
  const proposedPlan = brief?.proposed_work_plan;
  const primaryAction =
    moveData?.recommendation ||
    moveData?.action_title ||
    proposedPlan?.recommended_first_action ||
    activeEngagementData?.outcome?.work_plan?.next_actions?.[0] ||
    nextActionData?.recommendation ||
    `Complete active delivery iteration for ${activeCustomer.customerName}.`;

  // Baseline tasks directly from active engagement data so tasks are always visible on load
  const baselineTasks = React.useMemo(() => {
    if (!activeEngagementData || (activeEngagementData?.engagement?.id && activeEngagementData.engagement.id !== activeCustomer.id)) {
      return [];
    }
    const outcome = activeEngagementData?.outcome;
    const wp = outcome?.work_plan;
    const criteria = outcome?.success_criteria || [];

    const existingTaskMap: Record<string, any> = {};
    if (wp?.tasks && Array.isArray(wp.tasks)) {
      wp.tasks.forEach((t: any) => {
        if (t && typeof t === "object") {
          if (t.id) existingTaskMap[t.id] = t;
          if (t.linked_goal_id) existingTaskMap[t.linked_goal_id] = t;
        }
      });
    }

    if (criteria.length > 0) {
      return criteria.map((c: any, idx: number) => {
        const critId = typeof c === "object" && c.id ? c.id : `sc-${idx + 1}`;
        const critTitle = typeof c === "object" ? (c.title || c.statement || `Milestone ${idx + 1}`) : String(c);
        const isDone = typeof c === "object" ? Boolean(c.completed) : false;
        const matched = existingTaskMap[critId] || existingTaskMap[`task-${idx + 1}`];
        const taskDue = matched?.due_date || (typeof c === "object" && c.due_date) || computePresetDue(idx === 0 ? 0 : idx, 17, 0);
        const taskStatus = isDone ? "COMPLETED" : (matched?.status || "TODO");
        const finalTitle = matched?.title && !matched.title.startsWith("task-") ? matched.title : critTitle;

        return {
          id: critId,
          title: finalTitle,
          sequence_order: idx + 1,
          why_it_matters: `Fulfills Outcome Goal criterion for ${activeCustomer.customerName}.`,
          status: taskStatus === "COMPLETED" ? "COMPLETED" : taskStatus === "IN_PROGRESS" ? "IN_PROGRESS" : "TODO",
          due_date: taskDue,
          linked_goal_id: critId
        };
      });
    }

    if (wp?.tasks && Array.isArray(wp.tasks) && wp.tasks.length > 0) {
      return wp.tasks
        .filter((t: any) => t && t.title && !t.title.startsWith("task-"))
        .map((t: any, idx: number) => ({
          id: t.id || `task-${idx + 1}`,
          title: t.title,
          sequence_order: t.sequence_order || idx + 1,
          why_it_matters: t.why_it_matters || `Fulfills Outcome Goal criterion for ${activeCustomer.customerName}.`,
          status: t.status === "COMPLETED" ? "COMPLETED" : t.status === "IN_PROGRESS" ? "IN_PROGRESS" : "TODO",
          due_date: t.due_date || computePresetDue(idx, 17, 0),
          linked_goal_id: t.linked_goal_id || t.id
        }));
    }

    return [];
  }, [activeEngagementData, activeCustomer.customerName]);

  const workItems = proposedPlan?.work_items || [];
  const [localTasks, setLocalTasks] = useState<any[]>([]);

  useEffect(() => {
    if (proposedPlan?.work_items && proposedPlan.work_items.length > 0) {
      setLocalTasks(proposedPlan.work_items);
    } else if (baselineTasks.length > 0 && localTasks.length === 0) {
      setLocalTasks(baselineTasks);
    }
  }, [proposedPlan?.work_items, baselineTasks, localTasks.length]);

  const effectiveTasks = localTasks.length > 0 ? localTasks : (workItems.length > 0 ? workItems : baselineTasks);

  const [editingDueDateTaskId, setEditingDueDateTaskId] = useState<string | null>(null);
  const [customDate, setCustomDate] = useState<string>("");
  const [customTime, setCustomTime] = useState<string>("17:00");
  const [alertNotification, setAlertNotification] = useState<string | null>(null);

  useEffect(() => {
    setCustomDate(getTodayDateStr());
  }, []);

  useEffect(() => {
    if (alertNotification) {
      const timer = setTimeout(() => {
        setAlertNotification(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [alertNotification]);

  const [showCreateEngagementModal, setShowCreateEngagementModal] = useState(false);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskWhy, setNewTaskWhy] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState(computePresetDue(0, 18, 0));
  const [addTaskSubmitting, setAddTaskSubmitting] = useState(false);
  const [adoptingTasks, setAdoptingTasks] = useState(false);

  const editingTask = effectiveTasks.find((t: any) => t.id === editingDueDateTaskId);

  // Manager & FDE Manual Task Creation
  const handleCreateManualTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setAddTaskSubmitting(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("calmwork_auth_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/engagements/${activeCustomer.id}/tasks`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          why_it_matters: newTaskWhy.trim() || `Operational task for ${activeCustomer.customerName}`,
          due_date: newTaskDueDate || computePresetDue(0, 18, 0),
          status: "TODO"
        })
      });

      if (res.ok) {
        const json = await res.json();
        const created = json.data;
        setLocalTasks((prev) => [...prev, created]);
        setAlertNotification(`Task added: '${created.title}'`);
        setIsAddTaskModalOpen(false);
        setNewTaskTitle("");
        setNewTaskWhy("");
        await fetchEngagementDetail(activeCustomer.id);
      }
    } catch (err) {
      console.error("Failed to add task:", err);
    } finally {
      setAddTaskSubmitting(false);
    }
  };

  // Adding Plan Agent Generated Tasks directly without Manager approval
  const handleAdoptPlanAgentTasks = async () => {
    if (!brief?.proposed_work_plan?.work_items || brief.proposed_work_plan.work_items.length === 0) return;
    setAdoptingTasks(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("calmwork_auth_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/engagements/${activeCustomer.id}/tasks`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          tasks: brief.proposed_work_plan.work_items
        })
      });

      if (res.ok) {
        setAlertNotification(`${brief.proposed_work_plan.work_items.length} Plan Agent tasks added to work plan!`);
        await fetchEngagementDetail(activeCustomer.id);
      }
    } catch (err) {
      console.error("Failed to adopt Plan Agent tasks:", err);
    } finally {
      setAdoptingTasks(false);
    }
  };

  const handleUpdateDueDate = async (task: any, newDueDate: string) => {
    setEditingDueDateTaskId(null);

    setLocalTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, due_date: newDueDate } : t))
    );

    setAlertNotification(`Due date updated for '${task.title}' to ${newDueDate}.`);

    try {
      await fetch(`${API_BASE}/engagements/${activeCustomer.id}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          due_date: newDueDate,
          status: task.status,
          linked_goal_id: task.linked_goal_id || task.id
        })
      });
      await fetchEngagementDetail(activeCustomer.id);
      if (brief) {
        await runMorningBrief();
      }
    } catch (e) {
      console.warn("Failed to update task due date:", e);
    }
  };

  const handleToggleTaskStatus = async (task: any) => {
    const isCurrentlyDone = task.status === "COMPLETED";
    const nextStatus = isCurrentlyDone ? "TODO" : "COMPLETED";

    setLocalTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
    );

    if (nextStatus === "COMPLETED") {
      setAlertNotification(`Worknote logged: '${task.title}' marked as Done.`);
      const nowISTStr = formatISTDateTime(new Date(), { shortMonth: false, includeZone: false }) || "Just now";
      const newWorknote: WhatChangedItem = {
        summary: `Worknote: ${role || "FDE"} marked task '${task.title}' as completed.`,
        category: "WORKNOTE",
        date_recorded: nowISTStr,
        timeline_ref: `temp-${Date.now()}`
      };
      setBrief((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          what_changed: [newWorknote, ...(prev.what_changed || [])]
        };
      });
    } else {
      setAlertNotification(`Task '${task.title}' reopened as To Do.`);
    }

    try {
      await fetch(`${API_BASE}/engagements/${activeCustomer.id}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          linked_goal_id: task.linked_goal_id || task.id,
          due_date: task.due_date
        })
      });
      await fetchEngagementDetail(activeCustomer.id);
      if (brief) {
        await runMorningBrief();
      }
    } catch (e) {
      console.warn("Failed to toggle task status:", e);
    }
  };

  // Active blockers from Morning Brief
  const briefBlockers = brief?.what_is_blocking_progress || [];
  const fallbackBlockers = (activeEngagementData?.outcome?.work_plan?.risks && activeEngagementData.outcome.work_plan.risks.length > 0)
    ? activeEngagementData.outcome.work_plan.risks
    : nextActionData?.gating_blocker
    ? [String(nextActionData.gating_blocker.title || nextActionData.gating_blocker)]
    : isAcme && !approvedAcme
    ? ["SSO Configuration — Waiting on Customer Security Team"]
    : [];

  const isLoading = briefLoading || engagementLoading;

  return (
    <div className={`space-y-6 ${embedded ? "" : "max-w-6xl mx-auto py-3 px-4 sm:px-6"}`}>
      {/* Manager Pending Alert (Quiet & Unobtrusive) */}
      {role === "MANAGER" && pendingApprovalsCount > 0 && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs">
          <div className="flex items-center gap-2 text-amber-900">
            <ShieldCheck className="h-4 w-4 text-amber-700 shrink-0" />
            <span>
              <strong>{pendingApprovalsCount} approval required:</strong> Scope or Outcome Goals upgrade awaiting authorization.
            </span>
          </div>
          <Link
            href="/approvals"
            className="text-amber-800 hover:text-amber-950 font-medium flex items-center gap-1 transition"
          >
            <span>Review</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* Page Identity & Actions Header */}
      {!embedded ? (
        <div className="border-b border-slate-200 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-display font-bold text-slate-900">My Day</h1>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                {activeCustomer.customerName} &middot; {activeCustomer.engagementName}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className={`text-xs font-mono font-medium px-2.5 py-1 rounded-md border ${
                outcomeStatus === "HEALTHY"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-amber-50 text-amber-800 border-amber-200"
              }`}>
                {outcomeStatus === "HEALTHY" ? "Healthy" : "Reassessment"} &middot; v{outcomeVersion}
              </span>

              <button
                type="button"
                onClick={runMorningBrief}
                disabled={briefLoading}
                title="Run UNDERSTAND, PLAN, and MOVE agents to generate Morning Brief"
                className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer shadow-2xs disabled:opacity-50"
              >
                <Sun className={`h-4 w-4 text-slate-950 ${briefLoading ? "animate-spin" : ""}`} />
                <span>{briefLoading ? "Running Agents..." : brief ? "Re-run Brief" : "Morning Brief"}</span>
              </button>

              <button
                onClick={handleSyncAll}
                disabled={isLoading}
                title="Refresh State"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer shadow-2xs disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-amber-600" : ""}`} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCreateEngagementModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer shadow-2xs"
                title="Create a new customer engagement (Manager & FDE)"
              >
                <Building2 className="h-3.5 w-3.5 text-slate-500" />
                <span>+ New Engagement</span>
              </button>

              <Link
                href={`/engagements/${activeCustomer.id}`}
                className="text-xs text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1 pl-2.5 border-l border-slate-200 transition"
              >
                <span>Workspace</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* Embedded Action Ribbon inside Engagement Workspace */
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider">
              Daily Work Sequence
            </span>
            {lastRefreshed && (
              <span className="text-[11px] font-mono text-slate-400">
                · Brief updated at {lastRefreshed}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={runMorningBrief}
              disabled={briefLoading}
              title="Run UNDERSTAND, PLAN, and MOVE agents to generate Morning Brief"
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer shadow-2xs disabled:opacity-50"
            >
              <Sun className={`h-4 w-4 text-slate-950 ${briefLoading ? "animate-spin" : ""}`} />
              <span>{briefLoading ? "Running Agents..." : brief ? "Re-run Morning Brief" : "Morning Brief"}</span>
            </button>

            <button
              onClick={handleSyncAll}
              disabled={isLoading}
              title="Refresh State"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer shadow-2xs disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-amber-600" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      )}

      {/* Live Multi-Agent Execution Progress Banner (UNDERSTAND -> PLAN/KNOW -> MOVE) */}
      {briefLoading && (
        <div className="p-5 rounded-xl bg-slate-900 text-white border border-slate-800 shadow-md space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
              <div>
                <h3 className="text-sm font-display font-bold text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400 animate-pulse" />
                  Running Morning Brief Multi-Agent Orchestration
                </h3>
                <p className="text-[11px] text-slate-400">
                  Executing UNDERSTAND, PLAN (KNOW), and MOVE agents sequentially
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800/60">
              Step {streamEvent?.step || 1} of {streamEvent?.total_steps || 5}
            </span>
          </div>

          {/* 3 Core Agent Stages */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Agent 1: UNDERSTAND */}
            <div className={`p-3 rounded-lg border transition ${
              streamEvent?.agent === "UNDERSTAND"
                ? "bg-sky-950/70 border-sky-500 text-sky-100 shadow-sm"
                : streamEvent?.step && streamEvent.step > 2
                ? "bg-slate-800/40 border-slate-700/60 text-slate-300"
                : "bg-slate-800/20 border-slate-800 text-slate-500"
            }`}>
              <div className="flex items-center justify-between text-xs font-bold mb-1">
                <span>1. UNDERSTAND</span>
                {streamEvent?.agent === "UNDERSTAND" ? (
                  <span className="text-[10px] font-mono text-sky-300 animate-pulse">Analyzing...</span>
                ) : streamEvent?.step && streamEvent.step > 2 ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : null}
              </div>
              <p className="text-[11px] leading-snug">
                Evaluates requirement shifts and scope drift.
              </p>
            </div>

            {/* Agent 2: PLAN & KNOW */}
            <div className={`p-3 rounded-lg border transition ${
              streamEvent?.agent === "KNOW" || (streamEvent?.agent === "SUPERVISOR" && streamEvent?.stage === "SYNTHESIS")
                ? "bg-emerald-950/70 border-emerald-500 text-emerald-100 shadow-sm"
                : streamEvent?.step && streamEvent.step > 3
                ? "bg-slate-800/40 border-slate-700/60 text-slate-300"
                : "bg-slate-800/20 border-slate-800 text-slate-500"
            }`}>
              <div className="flex items-center justify-between text-xs font-bold mb-1">
                <span>2. PLAN &amp; KNOW</span>
                {streamEvent?.agent === "KNOW" || (streamEvent?.agent === "SUPERVISOR" && streamEvent?.stage === "SYNTHESIS") ? (
                  <span className="text-[10px] font-mono text-emerald-300 animate-pulse">Synthesizing...</span>
                ) : streamEvent?.step && streamEvent.step > 4 ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : null}
              </div>
              <p className="text-[11px] leading-snug">
                Grounded evidence retrieval &amp; daily work sequence.
              </p>
            </div>

            {/* Agent 3: MOVE */}
            <div className={`p-3 rounded-lg border transition ${
              streamEvent?.agent === "MOVE"
                ? "bg-amber-950/70 border-amber-500 text-amber-100 shadow-sm"
                : streamEvent?.step && streamEvent.step > 4
                ? "bg-slate-800/40 border-slate-700/60 text-slate-300"
                : "bg-slate-800/20 border-slate-800 text-slate-500"
            }`}>
              <div className="flex items-center justify-between text-xs font-bold mb-1">
                <span>3. MOVE</span>
                {streamEvent?.agent === "MOVE" ? (
                  <span className="text-[10px] font-mono text-amber-300 animate-pulse">Evaluating...</span>
                ) : streamEvent?.step && streamEvent.step > 4 ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : null}
              </div>
              <p className="text-[11px] leading-snug">
                Identifies gating blockers &amp; next best action.
              </p>
            </div>
          </div>

          {streamEvent?.message && (
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs font-mono text-amber-300 flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
              <span>{streamEvent.message}</span>
            </div>
          )}
        </div>
      )}

      {/* Loading Skeleton during state wipe & fetch: Zero cached or old data displayed */}
      {(!activeEngagementData || engagementLoading || (activeEngagementData?.engagement?.id && activeEngagementData.engagement.id !== activeCustomer.id)) ? (
        <div className="space-y-6 py-4 animate-pulse">
          <div className="p-5 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-3 w-28 bg-slate-200 rounded" />
              <div className="h-5 w-72 bg-slate-200 rounded" />
            </div>
            <div className="h-8 w-24 bg-slate-200 rounded" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
            <div className="lg:col-span-7 space-y-5">
              <div className="p-6 rounded-2xl bg-slate-100 border border-slate-200/80 space-y-3">
                <div className="h-4 w-44 bg-slate-200 rounded" />
                <div className="h-6 w-full bg-slate-200 rounded" />
                <div className="h-4 w-2/3 bg-slate-200 rounded" />
              </div>
              <div className="space-y-3">
                <div className="h-5 w-40 bg-slate-200 rounded" />
                <div className="p-4 rounded-xl bg-slate-100 border border-slate-200/80 h-20" />
                <div className="p-4 rounded-xl bg-slate-100 border border-slate-200/80 h-20" />
              </div>
            </div>
            <div className="lg:col-span-5 space-y-4">
              <div className="h-5 w-36 bg-slate-200 rounded" />
              <div className="p-5 rounded-2xl bg-slate-100 border border-slate-200/80 h-72" />
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Active Outcome Goal Context Ribbon */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
            <Target className="h-4 w-4" />
          </div>
          <div>
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
              Active Outcome Goal
            </span>
            <p className="text-sm sm:text-base font-semibold text-slate-900 leading-snug">
              &ldquo;{outcomeStatement}&rdquo;
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
          <div className="text-right">
            <span className="text-xs font-mono font-bold text-slate-700">
              {completedCount}/{successCriteria.length} Criteria Met
            </span>
            <div className="w-28 h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-md border border-emerald-300">
            {progressPct}%
          </span>
        </div>
      </div>

      {/* Core Layout: Left Main Column (Action & Tasks) + Right Side Column (MOVE Agent) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* Main Column (lg:col-span-7): Recommended Action & Today's Tasks */}
        <div className="lg:col-span-7 space-y-6">
          {/* Recommended First Action Today (Hero Focus Card) */}
          <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-amber-50/90 via-white to-amber-50/40 border border-amber-200/90 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500 text-slate-950 shadow-2xs">
                  <Zap className="h-4 w-4 fill-slate-950" />
                </div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-900">
                  Recommended First Action Today
                </span>
              </div>
              <div className="flex items-center gap-2">
                {moveData?.confidence && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200 shadow-2xs">
                    {moveData.confidence} Conf
                  </span>
                )}
                {moveData?.priority_level && (
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                    moveData.priority_level === "CRITICAL"
                      ? "bg-rose-50 text-rose-800 border-rose-300"
                      : moveData.priority_level === "HIGH_PRIORITY"
                      ? "bg-amber-100 text-amber-900 border-amber-300 font-bold"
                      : "bg-slate-100 text-slate-700 border-slate-200"
                  }`}>
                    {moveData.priority_level}
                  </span>
                )}
              </div>
            </div>

            <p className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              {primaryAction}
            </p>

            {(moveData?.target_work_cycle || moveData?.affected_role) && (
              <div className="pt-2.5 border-t border-amber-200/60 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-600">
                {moveData.target_work_cycle && (
                  <span>Cycle: {formatWorkCycle(moveData.target_work_cycle)}</span>
                )}
                {moveData.affected_role && (
                  <span>Role: {formatRoleName(moveData.affected_role)}</span>
                )}
              </div>
            )}
          </div>

          {/* Today's Tasks (Ordered Work Sequence) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-display font-bold text-slate-900">
                    Today&apos;s Ordered Tasks
                  </h2>
                  <span className="text-xs font-mono text-slate-500">
                    ({effectiveTasks.filter((t: any) => t.status === "COMPLETED").length}/{effectiveTasks.length} Done)
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {brief
                    ? `Synthesized by Plan Agent &middot; Refreshed at ${lastRefreshed}`
                    : "Active Engagement Work Plan &middot; Click 'Morning Brief' to re-prioritize"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {brief?.proposed_work_plan?.work_items && brief.proposed_work_plan.work_items.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAdoptPlanAgentTasks}
                    disabled={adoptingTasks}
                    className="px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                    title="Add tasks generated by Plan Agent directly to work plan without manager approval"
                  >
                    <Sparkles className="h-3 w-3 text-emerald-600" />
                    <span>{adoptingTasks ? "Adding..." : `Add ${brief.proposed_work_plan.work_items.length} Plan Tasks`}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsAddTaskModalOpen(true)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-900 hover:bg-slate-800 text-white transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Add a new work task to this engagement (Manager &amp; FDE authorized)"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>+ Add Task</span>
                </button>
                {proposedPlan?.plan_id && (
                  <span className="font-mono text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md border border-slate-200 hidden sm:inline-block">
                    Plan {proposedPlan.plan_id}
                  </span>
                )}
              </div>
            </div>

            {effectiveTasks.length === 0 && !briefLoading && (
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-500 text-center space-y-1">
                <p className="font-medium text-slate-700">No active tasks in work plan</p>
                <p className="text-xs text-slate-400">Click &lsquo;Morning Brief&rsquo; in the header to synthesize today&apos;s tasks &amp; IST targets.</p>
              </div>
            )}

            {effectiveTasks.length > 0 && (
              <div className="space-y-3">
                {effectiveTasks.map((item: any) => {
                  const isDone = item.status === "COMPLETED";
                  const inProgress = item.status === "IN_PROGRESS";
                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl space-y-2.5 text-sm transition border ${
                        isDone
                          ? "bg-slate-50/80 border-slate-200 text-slate-500"
                          : "bg-white border-slate-200/90 hover:border-slate-300 shadow-2xs text-slate-900"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleTaskStatus(item)}
                            className="mt-0.5 shrink-0 focus:outline-none cursor-pointer"
                            title={isDone ? "Mark as To Do" : "Mark as Completed"}
                          >
                            {isDone ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            ) : (
                              <Circle className="h-5 w-5 text-slate-400 hover:text-amber-500 transition" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <span
                              className={`font-semibold text-sm sm:text-base leading-snug block ${
                                isDone ? "line-through text-slate-400" : "text-slate-900"
                              }`}
                            >
                              #{item.sequence_order}. {item.title}
                            </span>
                            {item.why_it_matters && (
                              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mt-1">
                                {item.why_it_matters}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDueDateTaskId(editingDueDateTaskId === item.id ? null : item.id);
                            }}
                            className="flex items-center gap-1.5 font-mono text-xs text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-md border border-amber-200 hover:border-amber-300 transition cursor-pointer group"
                            title="Click to edit IST due date"
                          >
                            <Clock className="h-3.5 w-3.5 text-amber-600 group-hover:scale-110 transition shrink-0" />
                            <span>Due: {item.due_date || "Set target"}</span>
                            <Edit2 className="h-3 w-3 text-amber-500 group-hover:text-amber-700 transition shrink-0" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleTaskStatus(item)}
                            className={`text-xs font-mono px-2.5 py-1 rounded-md border transition cursor-pointer font-bold ${
                              isDone
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                : inProgress
                                ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                            }`}
                          >
                            {isDone ? "Done" : inProgress ? "In Progress" : "To Do"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Side Column (lg:col-span-5): MOVE Agent Rationale & Velocity Card */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="text-xs uppercase tracking-wider font-mono font-bold text-slate-600 block">
                  MOVE Agent &middot; Rationale
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400">Velocity Intelligence</span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              {moveData ? (
                <div className="space-y-4">
                  {/* Active Delivery Blockers */}
                  <div className="space-y-2">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 block">
                      Active Delivery Blockers
                    </span>
                    {briefBlockers.length > 0 ? (
                      <div className="space-y-2">
                        {briefBlockers.map((b, bIdx) => (
                          <div
                            key={bIdx}
                            className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-rose-950">{b.blocker || b.title}</span>
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-rose-200/70 text-rose-800">
                                {b.severity || "HIGH"}
                              </span>
                            </div>
                            <div className="text-slate-600 text-[11px] flex items-center justify-between pt-1 border-t border-rose-200/50">
                              <span>Owner: {b.owner_role || "Delivery Owner"}</span>
                              <span className="font-medium text-rose-800">{b.unblock_path || b.impact_description || "Action required"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : fallbackBlockers.length > 0 ? (
                      <div className="space-y-1.5">
                        {fallbackBlockers.map((b: any, bIdx: number) => (
                          <div
                            key={bIdx}
                            className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900"
                          >
                            <span className="font-semibold block">{typeof b === "string" ? b : (b.title || b.description || JSON.stringify(b))}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>Zero active blockers detected. Engagement proceeding smoothly.</span>
                      </div>
                    )}
                  </div>

                  {/* Next Critical Milestone */}
                  {(moveData?.next_milestone || activeEngagementData?.outcome?.work_plan?.milestones?.[0]) && (
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                        Next Critical Milestone
                      </span>
                      <p className="text-sm font-bold text-slate-900">
                        {moveData?.next_milestone?.name || activeEngagementData?.outcome?.work_plan?.milestones?.[0]?.title || "Active Work Cycle Milestone"}
                      </p>
                      <div className="flex items-center justify-between text-xs font-mono text-slate-500 pt-1 border-t border-slate-200">
                        <span>Target: {moveData?.next_milestone?.target_completion_date || "Active Cycle"}</span>
                        <span>Criteria: {moveData?.next_milestone?.deliverables_count ?? successCriteria.length} items</span>
                      </div>
                    </div>
                  )}

                  {/* Expected Impact & Delivery Velocity */}
                  {(moveData?.expected_outcome_impact || moveData?.why_now) && (
                    <div className="space-y-1.5 pt-3 border-t border-slate-100">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 block">
                        Why This Moves The Needle Today
                      </span>
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                        {moveData.expected_outcome_impact || moveData.why_now}
                      </p>
                    </div>
                  )}

                  {/* Scope Drift Alert */}
                  {brief?.scope_drift_detected && (
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-900 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <ShieldCheck className="h-4 w-4 text-amber-700" />
                        <span>Scope Drift Flagged by UNDERSTAND Agent</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-amber-800">
                        {brief.scope_drift_explanation || "New customer constraints detected requiring outcome alignment."}
                      </p>
                    </div>
                  )}

                  {/* Evidence & Decision Trail Accordion */}
                  {moveData?.evidence && moveData.evidence.length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setShowEvidence(!showEvidence)}
                        className="w-full flex items-center justify-between text-xs font-mono text-slate-500 hover:text-slate-800 py-1 transition cursor-pointer"
                      >
                        <span>Evidence &amp; Grounding Trail ({moveData.evidence.length})</span>
                        <span>{showEvidence ? "− Hide" : "+ Expand"}</span>
                      </button>
                      {showEvidence && (
                        <div className="mt-2 space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs font-mono text-slate-600">
                          {moveData.evidence.map((ev: string, evIdx: number) => (
                            <div key={evIdx} className="flex items-start gap-2">
                              <span className="text-amber-600 font-bold">•</span>
                              <span className="leading-snug">{ev}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-400 text-center py-6">
                  Click &lsquo;Morning Brief&rsquo; to synthesize MOVE agent velocity analysis.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
        </>
      )}

      {/* Quick Edit Task Target IST Due Date Modal */}
      {editingDueDateTaskId && editingTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 animate-fadeIn"
          onClick={() => setEditingDueDateTaskId(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4 text-slate-900 relative animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                <h3 className="font-display font-bold text-sm text-slate-900">
                  Target Due Date (IST)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingDueDateTaskId(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition cursor-pointer"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Selected Task</span>
              <p className="text-xs font-semibold text-slate-900 leading-snug">
                #{editingTask.sequence_order}. {editingTask.title}
              </p>
            </div>

            {/* 1-Click IST Presets */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                Quick IST Presets:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {DUE_PRESET_CONFIG.map((preset, pIdx) => {
                  const presetVal = computePresetDue(preset.offsetDays, preset.hour, preset.minute);
                  const isCurrent = editingTask.due_date === presetVal;
                  return (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => handleUpdateDueDate(editingTask, presetVal)}
                      className={`p-2 rounded-lg text-xs font-mono text-left transition border cursor-pointer ${
                        isCurrent
                          ? "bg-amber-100 border-amber-300 text-amber-950 font-bold"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                      }`}
                    >
                      <div className="font-semibold text-[11px]">{preset.label}</div>
                      <div className="text-[10px] text-slate-500">{preset.shortTime}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom IST Date & Time Picker */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                Or Pick Custom Date &amp; Time (24h IST):
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono text-slate-400 block mb-1">Date</label>
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-400 block mb-1">Time (24h IST)</label>
                  <input
                    type="time"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (customDate) {
                    const formatted = formatCustomISTDueDate(customDate, customTime);
                    handleUpdateDueDate(editingTask, formatted);
                  }
                }}
                className="w-full mt-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-md transition cursor-pointer"
              >
                Set Custom IST Target
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Task Modal */}
      {isAddTaskModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 animate-fadeIn"
          onClick={() => setIsAddTaskModalOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-lg w-full p-5 space-y-4 text-slate-900 relative animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm text-slate-900">Add Work Task</h3>
                  <p className="text-[11px] text-slate-500">
                    Creates an authoritative task in {activeCustomer.customerName}&apos;s work plan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTaskModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition cursor-pointer"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateManualTask} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 block uppercase font-mono">
                  Task Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Verify Redis cache failover cluster"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-slate-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 block uppercase font-mono">
                  Why It Matters / Operational Note
                </label>
                <textarea
                  placeholder="e.g. Fulfills security audit checklist item for production milestone."
                  value={newTaskWhy}
                  onChange={(e) => setNewTaskWhy(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-slate-400 resize-none"
                />
              </div>

              {/* 1-Click IST Due Target Presets */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                  Target IST Due Date:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {DUE_PRESET_CONFIG.slice(0, 3).map((preset, pIdx) => {
                    const presetVal = computePresetDue(preset.offsetDays, preset.hour, preset.minute);
                    const isSelected = newTaskDueDate === presetVal;
                    return (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => setNewTaskDueDate(presetVal)}
                        className={`p-2 rounded-lg text-xs font-mono text-left transition border cursor-pointer ${
                          isSelected
                            ? "bg-amber-50 border-amber-300 text-amber-900 font-bold"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <div className="font-semibold text-[11px]">{preset.label}</div>
                        <div className="text-[10px] text-slate-500">{preset.shortTime}</div>
                      </button>
                    );
                  })}
                </div>
                <div className="text-[11px] font-mono text-amber-800 bg-amber-50/60 p-2 rounded border border-amber-200/60">
                  Selected Target: {newTaskDueDate || "None"}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddTaskModalOpen(false)}
                  className="px-3 py-1.5 rounded-md text-xs text-slate-600 hover:text-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addTaskSubmitting || !newTaskTitle.trim()}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-md transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{addTaskSubmitting ? "Adding..." : "Add Task to Work Plan"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create New Engagement Modal (Manager & FDE) */}
      <CreateEngagementModal
        isOpen={showCreateEngagementModal}
        onClose={() => setShowCreateEngagementModal(false)}
      />

      {/* Alert Notification Toast */}
      {alertNotification && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 border border-emerald-500/60 text-white rounded-xl shadow-2xl text-xs font-mono animate-fadeIn">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{alertNotification}</span>
          <button
            onClick={() => setAlertNotification(null)}
            className="ml-2 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
