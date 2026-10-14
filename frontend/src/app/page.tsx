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
  AlertTriangle
} from "lucide-react";
import Link from "next/link";
import { MorningBriefData } from "@/components/engagement/DailyWorkBriefing";
import { formatISTTime, formatISTDate, formatISTDateTime, getNowISTTime } from "@/utils/date";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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

  const handleToggleTaskStatus = async (task: any) => {
    const isCurrentlyDone = task.status === "COMPLETED";
    const nextStatus = isCurrentlyDone ? "TODO" : "COMPLETED";

    setLocalTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
    );

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
      fetchEngagementDetail(activeCustomer.id);
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
                            {item.due_date && (
                              <span className="flex items-center gap-1 font-mono text-[10px] text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60">
                                <Clock className="h-3 w-3 text-amber-400" />
                                <span>Due: {item.due_date}</span>
                              </span>
                            )}

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
                  {fallbackBlockers.map((blocker, idx) => (
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
                  {briefChanges.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-mono font-bold px-1.5 py-0.5 bg-white text-slate-700 rounded border border-slate-200">
                          {item.category}
                        </span>
                        <span className="text-slate-400 font-mono">{item.date_recorded}</span>
                      </div>
                      <p className="font-medium text-xs text-slate-900 leading-snug">{item.summary}</p>
                    </div>
                  ))}
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
      </div>
    </AppShell>
  );
}
