"use client";

import React, { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { useAuth } from "@/context/AuthContext";
import { useEngagement } from "@/context/EngagementContext";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Check,
  Sun,
  Sparkles,
  BookOpen,
  Clock,
  AlertTriangle,
  Calendar,
  Edit2,
  Zap,
  Compass,
  X,
  Target,
  FileText
} from "lucide-react";
import Link from "next/link";
import { MorningBriefData, WhatChangedItem } from "@/components/engagement/DailyWorkBriefing";
import { formatISTTime, formatISTDate, formatISTDateTime, getNowISTTime } from "@/utils/date";

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

export default function MyDayPage() {
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

  const editingTask = effectiveTasks.find((t: any) => t.id === editingDueDateTaskId);

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

    // If marked as done, immediately surface a Worknote in Latest Updates & Worknotes
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

  // Latest updates / worknotes from Morning Brief
  const briefChanges = brief?.what_changed || [];
  const uniqueChanges = React.useMemo(() => {
    const seen = new Set<string>();
    return briefChanges.filter((item) => {
      const key = `${item.category}-${item.summary}-${item.date_recorded}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [briefChanges]);
  const fallbackEvents = (activeEngagementData?.timeline || []).slice(0, 3);

  const isLoading = briefLoading || engagementLoading;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-7 py-3 px-4 sm:px-6">
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

        {/* Page Identity & Active Engagement Focus */}
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

              {/* On-Demand Morning Brief Action Button */}
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

        {/* Core Layout: Left Main Column (Action & Tasks) + Right Side Column (MOVE Agent & Worknotes) */}
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
                {proposedPlan?.plan_id && (
                  <span className="font-mono text-xs px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-md border border-slate-200">
                    Plan {proposedPlan.plan_id}
                  </span>
                )}
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

          {/* Side Column (lg:col-span-5): MOVE Agent Rationale & Latest Worknotes */}
          <div className="lg:col-span-5 space-y-6">
            {/* MOVE Agent Rationale & Velocity Card */}
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
                    {/* Why Now */}
                    {moveData.why_now && (
                      <div className="space-y-1">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-800 block">
                          Why Now (Operational Urgency):
                        </span>
                        <p className="text-sm text-slate-700 leading-relaxed font-normal">
                          {moveData.why_now}
                        </p>
                      </div>
                    )}

                    {/* Operational Impact */}
                    {moveData.impact && (
                      <div className="space-y-1 pt-3 border-t border-slate-100">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600 block">
                          Operational Impact:
                        </span>
                        <p className="text-sm text-slate-700 leading-relaxed font-normal">
                          {moveData.impact}
                        </p>
                      </div>
                    )}

                    {/* Work Cycle & Situation */}
                    {(moveData.target_work_cycle || moveData.affected_role) && (
                      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-500">
                        {moveData.target_work_cycle && (
                          <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                            Cycle: {formatWorkCycle(moveData.target_work_cycle)}
                          </span>
                        )}
                        {moveData.affected_role && (
                          <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                            Role: {formatRoleName(moveData.affected_role)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-slate-400 py-6 justify-center">
                    <Compass className="h-4 w-4 animate-spin text-amber-500" />
                    <span>Evaluating MOVE agent velocity recommendation...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Latest Updates & Worknotes on the side */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-500" />
                  <span className="text-xs uppercase tracking-wider font-mono font-bold text-slate-600 block">
                    Latest Worknotes &amp; Updates
                  </span>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {uniqueChanges.length > 0 ? `${uniqueChanges.length} Recorded` : "Baseline"}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                {uniqueChanges.length > 0 ? (
                  <div className="space-y-2.5">
                    {uniqueChanges.slice(0, 4).map((item, idx) => {
                      const isWorknote = item.category === "WORKNOTE";
                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border space-y-1.5 transition ${
                            isWorknote
                              ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                              : "bg-slate-50 border-slate-200 text-slate-900"
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span
                              className={`font-mono font-bold px-1.5 py-0.5 rounded border text-[10px] ${
                                isWorknote
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : "bg-white text-slate-700 border-slate-200"
                              }`}
                            >
                              {item.category}
                            </span>
                            <span className="text-slate-500 font-mono text-xs">{item.date_recorded}</span>
                          </div>
                          <p className="font-medium text-xs sm:text-sm leading-snug">{item.summary}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : fallbackEvents.length > 0 ? (
                  <ul className="space-y-2.5 text-sm">
                    {fallbackEvents.map((evt: any) => (
                      <li key={evt.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-slate-800">
                        <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                          <span className="font-bold">{evt.actor_type}</span>
                          <span>{formatISTTime(evt.created_at, true)}</span>
                        </div>
                        <p className="font-medium text-xs sm:text-sm leading-snug">{evt.title}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500 py-3 text-center">Baseline engagement parameters active.</p>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* 3. Traceability & Reasoning (Progressive Disclosure) */}
        {brief?.evidence_and_confidence && brief.evidence_and_confidence.length > 0 && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <button
              onClick={() => setShowEvidence(!showEvidence)}
              className="w-full flex items-center justify-between text-xs text-slate-600 hover:text-slate-900 font-medium transition cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-slate-500" />
                <span>Evidence & Confidence Traceability ({brief.evidence_and_confidence.length} Sources)</span>
              </div>
              {showEvidence ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>

            {showEvidence && (
              <div className="pt-2 border-t border-slate-200 space-y-2 animate-fadeIn">
                {brief.evidence_and_confidence.map((ev, idx) => (
                  <div key={idx} className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono font-bold text-slate-700">{ev.category}</span>
                      <span className="font-mono text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        {ev.confidence_level} Confidence
                      </span>
                    </div>
                    <p className="font-medium text-slate-900">{ev.claim}</p>
                    <p className="text-[10px] text-slate-500 font-mono">Source: {ev.evidence_source}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer Link to Dedicated Workspace */}
        <div className="pt-2 pb-6 text-center">
          <Link
            href={`/engagements/${activeCustomer.id}`}
            className="text-xs text-slate-500 hover:text-slate-900 font-medium inline-flex items-center gap-1.5 transition"
          >
            <span>Open {activeCustomer.customerName} workspace for architecture diagrams, documents, and customer updates</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Modal Alert Box: Change IST Due Target */}
        {editingDueDateTaskId && editingTask && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 animate-fadeIn"
            onClick={() => setEditingDueDateTaskId(null)}
          >
            <div
              className="bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl max-w-lg w-full p-5 space-y-4 text-white relative animate-scaleUp"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Alert Box Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-sm text-white">Change IST Due Target</h3>
                    <p className="text-[11px] text-slate-400 truncate max-w-[340px]">
                      #{editingTask.sequence_order}. {editingTask.title}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingDueDateTaskId(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition cursor-pointer"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* 1-Click IST Presets */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                  1-Click IST Presets:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {DUE_PRESET_CONFIG.map((preset, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => {
                        const computedVal = computePresetDue(preset.offsetDays, preset.hour, preset.minute);
                        handleUpdateDueDate(editingTask, computedVal);
                      }}
                      className="p-2.5 bg-slate-800/90 hover:bg-amber-950/70 border border-slate-700 hover:border-amber-500/70 text-slate-200 hover:text-amber-300 rounded-lg text-xs font-mono text-left transition flex items-center justify-between cursor-pointer group"
                    >
                      <span className="font-medium group-hover:text-white">{preset.label}</span>
                      <span className="text-[10px] text-slate-400 font-mono group-hover:text-amber-400">{preset.shortTime}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Date & Time Picker */}
              <div className="pt-3 border-t border-slate-800/80 space-y-2">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                  Or Custom IST Target:
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <input
                    type="time"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    className="w-28 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              {/* Alert Box Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setEditingDueDateTaskId(null)}
                  className="px-3.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!customDate) return;
                    const formatted = formatCustomISTDueDate(customDate, customTime || "17:00");
                    handleUpdateDueDate(editingTask, formatted);
                  }}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold font-mono transition cursor-pointer shadow-sm"
                >
                  Set Target
                </button>
              </div>
            </div>
          </div>
        )}

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
    </AppShell>
  );
}
