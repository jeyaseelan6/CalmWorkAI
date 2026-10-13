"use client";

import React, { useState } from "react";
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
  Check
} from "lucide-react";
import Link from "next/link";
import AiLifecycleTracker from "@/components/engagement/AiLifecycleTracker";

export default function MyDayPage() {
  const { role } = useAuth();
  const {
    activeCustomer,
    activeEngagementData,
    nextActionData,
    loading,
    approvedAcme,
    fetchEngagementDetail
  } = useEngagement();

  const [showEvidence, setShowEvidence] = useState(false);

  const isAcme = activeCustomer.id === "eng-acme-001";
  const outcomeStatement =
    activeEngagementData?.outcome?.statement ||
    activeEngagementData?.outcome?.work_plan?.engagement_objective ||
    activeCustomer.engagementName;
  const outcomeVersion = activeEngagementData?.outcome?.version ?? (isAcme && approvedAcme ? 2 : 1);
  const outcomeStatus = activeEngagementData?.engagement?.status ?? (isAcme && approvedAcme ? "HEALTHY" : activeCustomer.status);

  // Success criteria / Definition of Done
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

  const handleToggleCriterion = async (criterionId: string) => {
    try {
      await fetch(`http://localhost:8000/api/v1/engagements/${activeCustomer.id}/dod/${criterionId}/toggle`, {
        method: "PATCH"
      });
      fetchEngagementDetail(activeCustomer.id);
    } catch (e) {
      console.warn("Failed to toggle criterion:", e);
    }
  };

  const pendingApprovalsCount = activeEngagementData?.pending_approvals_count ?? (approvedAcme ? 0 : 1);
  const activePlan = activeEngagementData?.outcome?.work_plan;

  // Next action calculation
  const primaryAction =
    activePlan?.next_actions?.[0] ||
    nextActionData?.recommendation ||
    `Complete discovery and requirements alignment for ${activeCustomer.customerName}.`;

  const actionWhyNow =
    activePlan?.timeline_summary ||
    nextActionData?.why_now ||
    "Highest-impact gating dependency for active delivery cycle.";

  // Blockers calculation
  const blockersList: string[] = (activePlan?.risks && activePlan.risks.length > 0)
    ? activePlan.risks
    : nextActionData?.gating_blocker
    ? [String(nextActionData.gating_blocker.title || nextActionData.gating_blocker)]
    : isAcme && !approvedAcme
    ? ["SSO Configuration — Waiting on Customer Security Team"]
    : [];

  // Recent timeline events
  const recentEvents = (activeEngagementData?.timeline || []).slice(0, 3);

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-7 py-2">
        {/* Manager Pending Alert (Quiet & Unobtrusive) */}
        {role === "MANAGER" && pendingApprovalsCount > 0 && (
          <div className="flex items-center justify-between p-3 rounded-md bg-amber-50 border border-amber-200 text-xs">
            <div className="flex items-center gap-2 text-amber-900">
              <ShieldCheck className="h-4 w-4 text-amber-700 shrink-0" />
              <span>
                <strong>{pendingApprovalsCount} approval required:</strong> Scope or Definition of Done upgrade awaiting authorization.
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

        {/* Page Identity & Active Focus */}
        <div className="border-b border-slate-200 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-display font-bold text-slate-900">My Day</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeCustomer.customerName} &middot; {activeCustomer.engagementName}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded border ${
                outcomeStatus === "HEALTHY"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-amber-50 text-amber-800 border-amber-200"
              }`}>
                {outcomeStatus === "HEALTHY" ? "Healthy" : "Reassessment"} &middot; v{outcomeVersion}
              </span>

              <button
                onClick={() => fetchEngagementDetail(activeCustomer.id)}
                disabled={loading}
                title="Sync state"
                className="text-slate-400 hover:text-slate-600 transition p-1 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
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

        {/* End-to-End Gen AI Lifecycle Tracker */}
        <AiLifecycleTracker 
          engagementId={activeCustomer.id} 
          customerName={activeCustomer.customerName} 
        />

        {/* 1. Primary Next Best Action (Highest-Impact Focus) */}
        <div className="space-y-2">
          <span className="text-[11px] uppercase tracking-wider font-mono font-bold text-slate-400 block">
            Today's Priority Action
          </span>
          <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-2.5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-slate-900 leading-snug">
                  {primaryAction}
                </h2>
                <p className="text-xs text-slate-600">
                  <strong className="text-slate-700">Why now:</strong> {actionWhyNow}
                </p>
              </div>
            </div>

            {/* Progressive Disclosure: Expandable Context */}
            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowEvidence(!showEvidence)}
                className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium transition cursor-pointer"
              >
                {showEvidence ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <span>{showEvidence ? "Hide evidence & context" : "Show evidence & context"}</span>
              </button>

              {showEvidence && (
                <div className="mt-2.5 p-3 rounded bg-slate-50 border border-slate-100 space-y-2 text-xs text-slate-600">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="font-mono text-slate-400 uppercase text-[10px] block">Impact Context:</span>
                      <span>{nextActionData?.impact || `Advances delivery towards target acceptance criteria.`}</span>
                    </div>
                    <div>
                      <span className="font-mono text-slate-400 uppercase text-[10px] block">Confidence:</span>
                      <span>{nextActionData?.confidence || "High (98%)"} &middot; Bound to Outcome v{outcomeVersion}</span>
                    </div>
                  </div>
                  {nextActionData?.evidence && nextActionData.evidence.length > 0 && (
                    <div className="pt-1.5 border-t border-slate-200/60">
                      <span className="font-mono text-slate-400 uppercase text-[10px] block mb-1">Grounded Evidence:</span>
                      <ul className="space-y-0.5 text-[11px]">
                        {nextActionData.evidence.map((ev: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-1.5 text-slate-700">
                            <span className="text-slate-400">&bull;</span>
                            <span>{ev}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. Actionable Blockers & Meaningful Changes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Actionable Blockers */}
          <div className="space-y-2">
            <span className="text-[11px] uppercase tracking-wider font-mono font-bold text-slate-400 block">
              Gating Blockers & Risks
            </span>
            <div className="p-4 rounded-lg bg-white border border-slate-200">
              {blockersList.length > 0 ? (
                <ul className="space-y-2 text-xs">
                  {blockersList.map((blocker: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-slate-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                      <span className="leading-relaxed">{blocker}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>No active blockers gating execution.</span>
                </div>
              )}
            </div>
          </div>

          {/* Meaningful Changes */}
          <div className="space-y-2">
            <span className="text-[11px] uppercase tracking-wider font-mono font-bold text-slate-400 block">
              Recent Activity & Changes
            </span>
            <div className="p-4 rounded-lg bg-white border border-slate-200">
              {recentEvents.length > 0 ? (
                <ul className="space-y-2 text-xs">
                  {recentEvents.map((evt: any) => (
                    <li key={evt.id} className="space-y-0.5 text-slate-800">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>{evt.actor_type}</span>
                        <span>{new Date(evt.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <p className="font-medium text-xs leading-snug">{evt.title}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500 py-1">Baseline engagement parameters active.</p>
              )}
            </div>
          </div>
        </div>

        {/* 3. Definition of Done (DoD) Checklist */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-mono font-bold text-slate-400 block">
              Definition of Done Checklist ({completedCount}/{successCriteria.length})
            </span>
            <span className="text-xs font-mono text-slate-500">{progressPct}% Complete</span>
          </div>

          <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-3">
            <p className="text-xs text-slate-600 italic">
              &ldquo;{outcomeStatement}&rdquo;
            </p>

            <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
              <div
                className="bg-slate-900 h-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <ul className="space-y-1.5 pt-1 text-xs">
              {successCriteria.map((item: any) => (
                <li
                  key={item.id}
                  onClick={() => handleToggleCriterion(item.id)}
                  className={`flex items-start gap-2.5 p-1.5 rounded transition cursor-pointer hover:bg-slate-50 ${
                    item.completed ? "text-slate-400" : "text-slate-800"
                  }`}
                >
                  <button type="button" className="mt-0.5 shrink-0 focus:outline-none">
                    {item.completed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Circle className="h-4 w-4 text-slate-300 hover:text-slate-500 transition" />
                    )}
                  </button>
                  <span className={`flex-1 leading-snug ${item.completed ? "line-through text-slate-400" : "font-medium"}`}>
                    {item.title}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer Link to Dedicated Workspace */}
        <div className="pt-2 pb-6 text-center">
          <Link
            href={`/engagements/${activeCustomer.id}`}
            className="text-xs text-slate-500 hover:text-slate-900 font-medium inline-flex items-center gap-1.5 transition"
          >
            <span>Open {activeCustomer.customerName} workspace for plan, knowledge, and customer updates</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
