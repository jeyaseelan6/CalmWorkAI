"use client";

import React from "react";
import AppShell from "@/components/layout/AppShell";
import OutcomeCard from "@/components/engagement/OutcomeCard";
import WorkCycleStepper from "@/components/engagement/WorkCycleStepper";
import DailyWorkBriefing from "@/components/engagement/DailyWorkBriefing";
import WorkPlanSection from "@/components/engagement/WorkPlanSection";
import { useAuth } from "@/context/AuthContext";
import { useEngagement } from "@/context/EngagementContext";
import { 
  Building2, 
  RefreshCw, 
  CheckCircle, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  AlertTriangle,
  Zap,
  BookOpen,
  Send
} from "lucide-react";
import Link from "next/link";

function parseStepNumber(workCycle?: string): number {
  if (!workCycle) return 1;
  const match = workCycle.match(/Step\s*(\d)/i);
  if (match) return parseInt(match[1], 10);
  if (workCycle.includes("Understand")) return 1;
  if (workCycle.includes("Problem")) return 2;
  if (workCycle.includes("Design")) return 3;
  if (workCycle.includes("Build")) return 4;
  if (workCycle.includes("Deploy")) return 5;
  if (workCycle.includes("Own")) return 6;
  return 1;
}

export default function HomePage() {
  const { role } = useAuth();
  const {
    customers,
    activeCustomer,
    activeEngagementData,
    nextActionData,
    loading,
    approvedAcme,
    fetchEngagementDetail
  } = useEngagement();

  const isAcme = activeCustomer.id === "eng-acme-001";
  const currentStepNumber = parseStepNumber(activeEngagementData?.engagement?.current_work_cycle || (isAcme ? "Step 4" : "Step 1"));

  // Dynamic Outcome & DoD Data from database / active engagement
  const outcomeStatement =
    activeEngagementData?.outcome?.statement ||
    activeEngagementData?.outcome?.work_plan?.engagement_objective ||
    activeCustomer.engagementName;
  const outcomeVersion = activeEngagementData?.outcome?.version ?? (isAcme && approvedAcme ? 2 : 1);
  const outcomeStatus = activeEngagementData?.engagement?.status ?? (isAcme && approvedAcme ? "HEALTHY" : activeCustomer.status);

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
    if (isAcme) {
      return approvedAcme
        ? [
            { id: "sc-1", title: "Automated onboarding workflow implemented", completed: true },
            { id: "sc-2", title: "API integration complete", completed: true },
            { id: "sc-3", title: "Production validation complete", completed: false },
            { id: "sc-4", title: "Enterprise SSO configuration & validation (Added v2)", completed: false }
          ]
        : [
            { id: "sc-1", title: "Automated onboarding workflow implemented", completed: true },
            { id: "sc-2", title: "API integration complete", completed: true },
            { id: "sc-3", title: "Production validation complete", completed: false }
          ];
    }
    return [
      { id: "sc-1", title: `Baseline architecture assessment completed for ${activeCustomer.customerName}`, completed: false },
      { id: "sc-2", title: "Core migration workflows implemented and validated", completed: false },
      { id: "sc-3", title: "Production verification and signoff completed", completed: false }
    ];
  }, [activeEngagementData, isAcme, approvedAcme, activeCustomer.customerName]);

  const completedCount = successCriteria.filter((c: any) => c.completed).length;
  const outcomeProgress = successCriteria.length > 0
    ? Math.round((completedCount / successCriteria.length) * 100)
    : (activeEngagementData?.engagement?.progress ?? (outcomeStatus === "HEALTHY" ? 75 : 10));

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

  // MANAGER VIEW: Section 16 Manager Control Center Summary
  if (role === "MANAGER") {
    return (
      <AppShell>
        <div className="max-w-5xl mx-auto space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-amber-700" />
                <h1 className="text-xl font-bold font-display text-slate-900">Manager Control Center</h1>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Attention & Approvals Overview across Customer Engagements
              </p>
            </div>

            <Link
              href="/approvals"
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-md transition flex items-center gap-1.5"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Open Approval Center ({pendingApprovalsCount})</span>
            </Link>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-2 font-mono">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
              Attention Required ({pendingApprovalsCount} Pending)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <Link href="/approvals" className="bg-slate-50 p-3.5 rounded-md border border-slate-200 hover:bg-slate-100 transition space-y-1 block">
                <span className="text-2xl font-bold text-amber-800 font-mono block">{pendingApprovalsCount}</span>
                <span className="font-semibold text-slate-900 block text-xs">Outcome Version Changes</span>
                <p className="text-[11px] text-slate-500">
                  {pendingApprovalsCount > 0 ? "Scope changes awaiting manager review" : "All outcome versions approved"}
                </p>
              </Link>

              <Link href="/actions" className="bg-slate-50 p-3.5 rounded-md border border-slate-200 hover:bg-slate-100 transition space-y-1 block">
                <span className="text-2xl font-bold text-slate-900 font-mono block">{pendingApprovalsCount > 0 ? 1 : 0}</span>
                <span className="font-semibold text-slate-900 block text-xs">Consequential Actions</span>
                <p className="text-[11px] text-slate-500">Gating dependency oversight</p>
              </Link>

              <Link href="/delivery" className="bg-slate-50 p-3.5 rounded-md border border-slate-200 hover:bg-slate-100 transition space-y-1 block">
                <span className="text-2xl font-bold text-slate-900 font-mono block">1</span>
                <span className="font-semibold text-slate-900 block text-xs">Customer Updates Awaiting Review</span>
                <p className="text-[11px] text-slate-500">DELIVER drafts for external sharing</p>
              </Link>
            </div>
          </div>

          {/* Customer Engagements Portfolio Overview */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 font-mono">
                <Building2 className="h-4 w-4 text-slate-500" />
                <span>Customer Engagements Portfolio</span>
              </h2>
              <span className="text-[11px] font-mono text-slate-500">{customers.length} Active Accounts</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              {customers.map((c) => (
                <div key={c.id} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">{c.customerName}</span>
                    <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                      c.status === "HEALTHY" 
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300" 
                        : "bg-amber-100 text-amber-800 border border-amber-300"
                    }`}>
                      {c.status}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px] line-clamp-1">{c.engagementName}</p>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[11px]">
                    <span className="text-slate-500 font-mono">ID: {c.id.substring(0, 12)}...</span>
                    <Link href={`/`} className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1">
                      <span>Cockpit</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Natural-Language Work Planning (Supervisor Led) */}
          <WorkPlanSection
            engagementId={activeCustomer.id}
            customerName={activeCustomer.customerName}
            initialWorkPlan={activeEngagementData?.outcome?.work_plan}
            outcomeVersion={outcomeVersion}
            onPlanApproved={() => {
              fetchEngagementDetail(activeCustomer.id);
            }}
          />

          {/* Active Outcome Definition & DoD Card (Manager View) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 font-mono">
                Active FDE Cockpit Context ({activeCustomer.customerName})
              </span>
              <span className="text-[11px] text-slate-500 font-mono">Outcome Version {outcomeVersion}</span>
            </div>
            <OutcomeCard
              customerName={activeCustomer.customerName}
              engagementName={activeCustomer.engagementName}
              outcomeStatement={outcomeStatement}
              version={outcomeVersion}
              status={outcomeStatus}
              progress={outcomeProgress}
              successCriteria={successCriteria}
              onToggleCriterion={handleToggleCriterion}
              outcomesList={activeEngagementData?.outcome?.work_plan?.outcomes || []}
            />
          </div>
        </div>
      </AppShell>
    );
  }

  // FDE VIEW: Clean, Focused My Work Cockpit
  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Top Header Summary */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-slate-700 shrink-0" />
              <h1 className="font-display text-xl font-bold text-slate-900 tracking-tight">{activeCustomer.customerName} Cockpit</h1>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Active outcome statement and FDE execution workflow for {activeCustomer.engagementName}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => fetchEngagementDetail(activeCustomer.id)}
              className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded-md transition font-semibold"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-slate-700" : ""}`} />
              <span>Sync API</span>
            </button>

            {outcomeVersion >= 2 && (
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3 py-1 rounded-md font-semibold">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                <span>Outcome v{outcomeVersion} Active</span>
              </div>
            )}
          </div>
        </div>

        {/* 1. Active Outcome Definition & DoD Card */}
        <OutcomeCard
          customerName={activeCustomer.customerName}
          engagementName={activeCustomer.engagementName}
          outcomeStatement={outcomeStatement}
          version={outcomeVersion}
          status={outcomeStatus}
          progress={outcomeProgress}
          successCriteria={successCriteria}
          onToggleCriterion={handleToggleCriterion}
          outcomesList={activeEngagementData?.outcome?.work_plan?.outcomes || []}
        />

        {/* 2. Clean 6-Step FDE Work Cycle Stepper */}
        <WorkCycleStepper currentStepNumber={currentStepNumber} customerName={activeCustomer.customerName} />

        {/* 3. Proactive Intelligence Daily Work Briefing */}
        <DailyWorkBriefing />

        {/* 4. Natural-Language Work Planning (Supervisor Led) */}
        <WorkPlanSection
          engagementId={activeCustomer.id}
          customerName={activeCustomer.customerName}
          initialWorkPlan={activeEngagementData?.outcome?.work_plan}
          outcomeVersion={outcomeVersion}
          onPlanApproved={() => {
            fetchEngagementDetail(activeCustomer.id);
          }}
        />

        {/* 4. Specialized AI Agent Workspaces Navigation Grid */}
        <div className="space-y-2.5">
          <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-500">
            Dedicated Agent Intelligence Workspaces
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* MOVE Agent Link */}
            <Link
              href="/actions"
              className="bg-white border border-slate-200 hover:bg-slate-50/80 rounded-lg p-4 group transition space-y-2 block shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-display font-bold text-slate-900 text-sm">
                  <Zap className="h-4 w-4 text-slate-700" />
                  <span>MOVE Agent — Next Best Action</span>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 group-hover:text-slate-900 transition" />
              </div>
              <p className="text-slate-600 leading-relaxed text-xs">
                Determines the single highest-impact Next Best Action and resolves gating blockers.
              </p>
              <div className="text-[11px] text-slate-800 font-mono bg-slate-50 p-2 rounded border border-slate-200 line-clamp-1">
                Action: {nextActionData?.recommendation || "Review active Definition of Done criteria."}
              </div>
            </Link>

            {/* UNDERSTAND Agent Link */}
            <Link
              href="/intelligence"
              className="bg-white border border-slate-200 hover:bg-slate-50/80 rounded-lg p-4 group transition space-y-2 block shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-display font-bold text-slate-900 text-sm">
                  <Sparkles className="h-4 w-4 text-slate-700" />
                  <span>UNDERSTAND Agent — Scope Impact</span>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 group-hover:text-slate-900 transition" />
              </div>
              <p className="text-slate-600 leading-relaxed text-xs">
                Evaluates requirement changes using Evidence &rarr; Reasoning &rarr; Recommendation.
              </p>
              <div className="text-[11px] text-amber-900 font-mono bg-amber-50 p-2 rounded border border-amber-200 font-semibold">
                Status: {outcomeStatus === "HEALTHY" ? `Outcome v${outcomeVersion} DoD Active` : "Pending Scope Re-Assessment"}
              </div>
            </Link>

            {/* KNOW Agent Link */}
            <Link
              href="/knowledge"
              className="bg-white border border-slate-200 hover:bg-slate-50/80 rounded-lg p-4 group transition space-y-2 block shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-display font-bold text-slate-900 text-sm">
                  <BookOpen className="h-4 w-4 text-slate-700" />
                  <span>KNOW Agent — Grounded RAG</span>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 group-hover:text-slate-900 transition" />
              </div>
              <p className="text-slate-600 leading-relaxed text-xs">
                Semantic search across architecture specs and customer documentation with source citations.
              </p>
              <div className="text-[11px] text-slate-700 font-mono bg-slate-50 p-2 rounded border border-slate-200">
                Docs: {activeEngagementData?.documents_count ?? 1} Indexed Tech Specs
              </div>
            </Link>

            {/* DELIVER Agent Link */}
            <Link
              href="/delivery"
              className="bg-white border border-slate-200 hover:bg-slate-50/80 rounded-lg p-4 group transition space-y-2 block shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-display font-bold text-slate-900 text-sm">
                  <Send className="h-4 w-4 text-slate-700" />
                  <span>DELIVER Agent — Customer Studio</span>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 group-hover:text-slate-900 transition" />
              </div>
              <p className="text-slate-600 leading-relaxed text-xs">
                Generates executive updates, technical logs, and release notes for Manager approval.
              </p>
              <div className="text-[11px] text-slate-700 font-mono bg-slate-50 p-2 rounded border border-slate-200">
                Draft: {activeCustomer.customerName} Executive Update
              </div>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
