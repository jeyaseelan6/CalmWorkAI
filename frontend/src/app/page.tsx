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
  X
} from "lucide-react";
import Link from "next/link";
import { MorningBriefData, WhatChangedItem } from "@/components/engagement/DailyWorkBriefing";
import { formatISTTime, formatISTDate, formatISTDateTime, getNowISTTime } from "@/utils/date";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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

  // Fetch sequential Morning Brief from Supervisor Coordinator
  const fetchBrief = useCallback(async () => {
    if (!activeCustomer?.id) return;
    setBriefLoading(true);
    try {
      const res = await fetch(`${API_BASE}/engagements/${activeCustomer.id}/supervisor/brief`, {
        method: "POST"
      });
      const data = await res.json();
      if (data.success && data.data) {
        setBrief(data.data);
        setLastRefreshed(getNowISTTime(true));
      }
    } catch (err) {
      console.warn("Failed to fetch Morning Brief:", err);
    } finally {
      setBriefLoading(false);
    }
  }, [activeCustomer?.id]);

  useEffect(() => {
    fetchBrief();
  }, [fetchBrief]);

  const handleSyncAll = () => {
    fetchEngagementDetail(activeCustomer.id);
    fetchBrief();
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

  // Daily Work Plan values directly derived from Morning Brief
  const proposedPlan = brief?.proposed_work_plan;
  const primaryAction =
    proposedPlan?.recommended_first_action ||
    activeEngagementData?.outcome?.work_plan?.next_actions?.[0] ||
    nextActionData?.recommendation ||
    `Complete active delivery iteration for ${activeCustomer.customerName}.`;

  const workItems = proposedPlan?.work_items || [];
  const [localTasks, setLocalTasks] = useState<any[]>([]);

  useEffect(() => {
    if (proposedPlan?.work_items) {
      setLocalTasks(proposedPlan.work_items);
    }
  }, [proposedPlan?.work_items]);

  const effectiveTasks = localTasks.length > 0 ? localTasks : workItems;

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

  const editingTask = effectiveTasks.find((t) => t.id === editingDueDateTaskId);

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
      await fetchBrief();
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
      await fetchBrief();
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
  const fallbackEvents = (activeEngagementData?.timeline || []).slice(0, 3);

  const isLoading = briefLoading || engagementLoading;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-7 py-2">
        {/* Manager Pending Alert (Quiet & Unobtrusive) */}
        {role === "MANAGER" && pendingApprovalsCount > 0 && (
          <div className="flex items-center justify-between p-3 rounded-md bg-amber-50 border border-amber-200 text-xs">
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
                <h1 className="text-xl font-display font-bold text-slate-900">My Day</h1>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeCustomer.customerName} &middot; {activeCustomer.engagementName}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <span className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded border ${
                outcomeStatus === "HEALTHY"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-amber-50 text-amber-800 border-amber-200"
              }`}>
                {outcomeStatus === "HEALTHY" ? "Healthy" : "Reassessment"} &middot; v{outcomeVersion}
              </span>

              <button
                onClick={handleSyncAll}
                disabled={isLoading}
                title="Refresh State & Morning Brief"
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer shadow-2xs disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin text-amber-600" : ""}`} />
                <span>{isLoading ? "Refreshing..." : "Refresh"}</span>
              </button>

              <Link
                href={`/engagements/${activeCustomer.id}`}
                className="text-xs text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1 pl-2 border-l border-slate-200 transition"
              >
                <span>Workspace</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* 1. Daily Work Plan (Priority Focus — Powered by Morning Brief) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-500 text-slate-950 rounded-md shrink-0 shadow-2xs">
                <Sun className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-display font-bold text-slate-900">
                  Daily Work Plan
                </h2>
                <p className="text-[11px] text-slate-500">
                  Synthesized by Plan Agent &middot; {lastRefreshed ? `Refreshed at ${lastRefreshed}` : "Active"}
                </p>
              </div>
            </div>

            {proposedPlan?.plan_id && (
              <span className="font-mono text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200">
                Plan {proposedPlan.plan_id}
              </span>
            )}
          </div>

          <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800 shadow-xs space-y-3">
            {/* Active Engagement Outcome Goal Statement */}
            <div className="flex items-center justify-between text-xs pb-2.5 border-b border-slate-800/80">
              <span className="text-slate-300 italic text-xs leading-snug">
                &ldquo;{outcomeStatement}&rdquo;
              </span>
              <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-3">
                {progressPct}% Progress
              </span>
            </div>

            {/* Recommended First Action Highlight */}
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-1">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider">
                  Recommended First Action Today:
                </span>
              </div>
              <p className="text-xs font-semibold text-white leading-relaxed">
                {primaryAction}
              </p>
            </div>

            {/* Ordered Work Sequence with Calm Task Tracking */}
            {effectiveTasks.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                    Ordered Tasks & IST Due Targets:
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {effectiveTasks.filter((t) => t.status === "COMPLETED").length}/{effectiveTasks.length} Done
                  </span>
                </div>

                <div className="space-y-2">
                  {effectiveTasks.map((item) => {
                    const isDone = item.status === "COMPLETED";
                    const inProgress = item.status === "IN_PROGRESS";
                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg space-y-2 text-xs transition border ${
                          isDone
                            ? "bg-slate-800/40 border-slate-700/40 text-slate-400"
                            : "bg-slate-800/90 border-slate-700/80 text-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <button
                              type="button"
                              onClick={() => handleToggleTaskStatus(item)}
                              className="mt-0.5 shrink-0 focus:outline-none cursor-pointer"
                              title={isDone ? "Mark as To Do" : "Mark as Completed"}
                            >
                              {isDone ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                              ) : (
                                <Circle className="h-4 w-4 text-slate-500 hover:text-amber-400 transition" />
                              )}
                            </button>
                            <div className="min-w-0">
                              <span
                                className={`font-semibold text-xs leading-snug block ${
                                  isDone ? "line-through text-slate-400" : "text-slate-100"
                                }`}
                              >
                                #{item.sequence_order}. {item.title}
                              </span>
                              {item.why_it_matters && (
                                <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
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
                              className="flex items-center gap-1.5 font-mono text-[10px] text-amber-300 bg-amber-950/60 hover:bg-amber-900/90 px-2 py-0.5 rounded border border-amber-800/60 hover:border-amber-600 transition cursor-pointer group"
                              title="Click to edit IST due date"
                            >
                              <Clock className="h-3 w-3 text-amber-400 group-hover:scale-110 transition shrink-0" />
                              <span>Due: {item.due_date || "Set target"}</span>
                              <Edit2 className="h-2.5 w-2.5 text-amber-400/60 group-hover:text-amber-200 transition shrink-0" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleTaskStatus(item)}
                              className={`text-[9px] font-mono px-2 py-0.5 rounded border transition cursor-pointer font-bold ${
                                isDone
                                  ? "bg-emerald-950 text-emerald-300 border-emerald-700 hover:bg-emerald-900"
                                  : inProgress
                                  ? "bg-amber-950 text-amber-300 border-amber-700 hover:bg-amber-900"
                                  : "bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800"
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
              </div>
            )}
          </div>
        </div>

        {/* 2. Context & Guardrails: Gating Blockers & Latest Updates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Active Gating Blockers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider font-mono font-bold text-slate-400 block">
                Active Gating Blockers
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                {briefBlockers.length > 0 ? `${briefBlockers.length} Active` : "Cleared"}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2.5 min-h-[140px]">
              {briefBlockers.length > 0 ? (
                <div className="space-y-2.5 text-xs">
                  {briefBlockers.map((b, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg space-y-1 text-amber-950"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-xs">
                          <ShieldAlert className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                          <span>{b.title}</span>
                        </div>
                        <span className="text-[9px] font-mono bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-300 font-bold">
                          {b.dependency_type}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-900 leading-snug">
                        <strong>Impact:</strong> {b.impact_description}
                      </p>
                      {b.evidence_snippet && (
                        <p className="text-[10px] font-mono text-slate-600 bg-white/70 p-1 rounded border border-amber-200/60 truncate">
                          {b.evidence_snippet}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : fallbackBlockers.length > 0 ? (
                <ul className="space-y-2 text-xs">
                  {fallbackBlockers.map((blocker: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-slate-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                      <span className="leading-relaxed">{blocker}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex items-center gap-2 text-xs text-slate-500 py-3">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>No active blockers gating execution.</span>
                </div>
              )}
            </div>
          </div>

          {/* Latest Updates & Worknotes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider font-mono font-bold text-slate-400 block">
                Latest Updates & Worknotes
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                {briefChanges.length > 0 ? `${briefChanges.length} Recorded` : "Baseline"}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2.5 min-h-[140px]">
              {briefChanges.length > 0 ? (
                <div className="space-y-2 text-xs">
                  {briefChanges.slice(0, 5).map((item, idx) => {
                    const isWorknote = item.category === "WORKNOTE";
                    return (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-lg border space-y-1 transition ${
                          isWorknote
                            ? "bg-emerald-50/70 border-emerald-200/90 text-emerald-950"
                            : "bg-slate-50 border-slate-200 text-slate-900"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span
                            className={`font-mono font-bold px-1.5 py-0.5 rounded border ${
                              isWorknote
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                : "bg-white text-slate-700 border-slate-200"
                            }`}
                          >
                            {item.category}
                          </span>
                          <span className="text-slate-400 font-mono">{item.date_recorded}</span>
                        </div>
                        <p className="font-medium text-xs leading-snug">{item.summary}</p>
                      </div>
                    );
                  })}
                </div>
              ) : fallbackEvents.length > 0 ? (
                <ul className="space-y-2 text-xs">
                  {fallbackEvents.map((evt: any) => (
                    <li key={evt.id} className="space-y-0.5 text-slate-800">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>{evt.actor_type}</span>
                        <span>{formatISTTime(evt.created_at, true)}</span>
                      </div>
                      <p className="font-medium text-xs leading-snug">{evt.title}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500 py-3">Baseline engagement parameters active.</p>
              )}
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
