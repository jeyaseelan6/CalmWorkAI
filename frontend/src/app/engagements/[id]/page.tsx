"use client";

import React, { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import OutcomeCard from "@/components/engagement/OutcomeCard";
import WorkCycleStepper from "@/components/engagement/WorkCycleStepper";
import EvidenceReasoningCard from "@/components/engagement/EvidenceReasoningCard";
import KnowledgePanel from "@/components/knowledge/KnowledgePanel";
import CustomerUpdatePanel from "@/components/delivery/CustomerUpdatePanel";
import WorkPlanSection from "@/components/engagement/WorkPlanSection";
import { useEngagement } from "@/context/EngagementContext";
import { 
  Building2, 
  CheckCircle, 
  Sparkles, 
  Clock, 
  BookOpen, 
  FileText, 
  Upload, 
  ShieldAlert,
  ArrowRight,
  Layers,
  ListTodo
} from "lucide-react";

import { useParams } from "next/navigation";
import { formatISTDateTime } from "@/utils/date";

function parseStepNumber(workCycle?: string): number {
  if (!workCycle) return 1;
  const match = workCycle.match(/Step\s*(\d)/i);
  if (match) return parseInt(match[1], 10);
  if (workCycle.includes("UNDERSTAND") || workCycle.includes("Understand")) return 1;
  if (workCycle.includes("PROBLEM") || workCycle.includes("Problem")) return 2;
  if (workCycle.includes("DESIGN") || workCycle.includes("Design")) return 3;
  if (workCycle.includes("BUILD") || workCycle.includes("Build")) return 4;
  if (workCycle.includes("DEPLOY") || workCycle.includes("Deploy") || workCycle.includes("VALIDATION")) return 5;
  if (workCycle.includes("OWN") || workCycle.includes("Own")) return 6;
  return 1;
}

function EngagementDetailContent() {
  const routeParams = useParams();
  const engagementId = (routeParams?.id as string) || "eng-acme-001";

  const {
    customers,
    activeCustomer,
    setActiveCustomer,
    activeEngagementData,
    nextActionData,
    approvedAcme,
    handleApproveChange,
    fetchEngagementDetail
  } = useEngagement();
  const [activeTab, setActiveTab] = useState<"overview" | "plan" | "knowledge" | "changes" | "updates" | "timeline">("overview");

  // Sync route parameter with active engagement context
  React.useEffect(() => {
    if (engagementId) {
      if (activeCustomer.id !== engagementId) {
        const matching = customers.find((c) => c.id === engagementId);
        if (matching) {
          setActiveCustomer(matching);
        }
      }
      fetchEngagementDetail(engagementId);
    }
  }, [engagementId, customers]);

  const isAcme = engagementId === "eng-acme-001";

  // Dynamic Outcome statement from DB or active plan
  const currentOutcomeStatement =
    activeEngagementData?.outcome?.statement ||
    activeEngagementData?.outcome?.work_plan?.engagement_objective ||
    activeCustomer.engagementName;

  const currentOutcomeVersion =
    activeEngagementData?.outcome?.version ?? (isAcme && approvedAcme ? 2 : 1);

  const currentOutcomeStatus =
    activeEngagementData?.engagement?.status ?? (isAcme && approvedAcme ? "HEALTHY" : activeCustomer.status);
  const isHealthy = currentOutcomeStatus === "HEALTHY";

  const currentStepNumber = parseStepNumber(
    activeEngagementData?.engagement?.current_work_cycle || (isAcme ? "Step 4" : "Step 1")
  );

  // Dynamic Definition of Done / Success Criteria list
  const currentSuccessCriteria = React.useMemo(() => {
    if (activeEngagementData?.outcome?.success_criteria && activeEngagementData.outcome.success_criteria.length > 0) {
      return activeEngagementData.outcome.success_criteria.map((c: any, idx: number) => {
        if (typeof c === "string") {
          return { id: `sc-${idx + 1}`, title: c, completed: false };
        }
        return {
          id: c.id || `sc-${idx + 1}`,
          title: c.title || c.statement || String(c),
          completed: Boolean(c.completed)
        };
      });
    }
    if (activeEngagementData?.outcome?.work_plan?.definition_of_done && activeEngagementData.outcome.work_plan.definition_of_done.length > 0) {
      return activeEngagementData.outcome.work_plan.definition_of_done.map((d: any, idx: number) => {
        if (typeof d === "string") {
          return { id: `dod-${idx + 1}`, title: d, completed: false };
        }
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

  const completedCount = currentSuccessCriteria.filter((c: any) => c.completed).length;
  const currentProgress = currentSuccessCriteria.length > 0
    ? Math.round((completedCount / currentSuccessCriteria.length) * 100)
    : (activeEngagementData?.engagement?.progress ?? (isHealthy ? 75 : 10));

  const handleToggleCriterion = async (criterionId: string) => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      await fetch(`${apiBase}/engagements/${engagementId}/dod/${criterionId}/toggle`, {
        method: "PATCH"
      });
      fetchEngagementDetail(engagementId);
    } catch (e) {
      console.warn("Failed to toggle criterion:", e);
    }
  };


  const nextActionText =
    activeEngagementData?.outcome?.work_plan?.next_actions?.[0] ||
    nextActionData?.recommendation ||
    (isAcme
      ? (approvedAcme
          ? "Execute cutover dry-run test on staging replica."
          : "Request SSO configuration from customer security owner.")
      : `Initiate discovery interviews with ${activeCustomer.customerName} technical team.`);

  const nextActionWhy =
    activeEngagementData?.outcome?.work_plan?.timeline_summary ||
    nextActionData?.why_now ||
    (isAcme && approvedAcme
      ? "Validates production deployment window."
      : "Gating prerequisite for active work cycle.");

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Calm Workspace Header */}
        <div className="pb-3 border-b border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold font-display text-slate-900">
                  {activeCustomer.customerName}
                </h1>
                <span className="text-slate-300">·</span>
                <span className="text-sm text-slate-600 font-medium">
                  {activeCustomer.engagementName}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Delivery Workspace · {activeEngagementData?.engagement?.current_work_cycle || "Step 4: Build & Integrate"}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border ${
                isHealthy
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isHealthy ? "bg-emerald-500" : "bg-amber-500"}`} />
                <span>{isHealthy ? "Healthy" : "Needs Review"}</span>
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-mono">
                DoD v{currentOutcomeVersion}
              </span>
            </div>
          </div>

          {/* Simple, Consistent Tabs Navigation */}
          <nav className="flex items-center gap-1 border-t border-slate-100 pt-3 overflow-x-auto text-xs">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                activeTab === "overview"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("plan")}
              className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                activeTab === "plan"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              Plan & Tasks
            </button>
            <button
              onClick={() => setActiveTab("knowledge")}
              className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                activeTab === "knowledge"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              Knowledge
            </button>
            <button
              onClick={() => setActiveTab("changes")}
              className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                activeTab === "changes"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              Changes & Risks
            </button>
            <button
              onClick={() => setActiveTab("updates")}
              className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                activeTab === "updates"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              Customer Updates
            </button>
            <button
              onClick={() => setActiveTab("timeline")}
              className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                activeTab === "timeline"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              Timeline
            </button>
          </nav>
        </div>

        {/* 1. OVERVIEW TAB: Outcome + DoD + Action & Blockers */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <OutcomeCard
              customerName={activeCustomer.customerName}
              engagementName={activeCustomer.engagementName}
              outcomeStatement={currentOutcomeStatement}
              version={currentOutcomeVersion}
              status={currentOutcomeStatus}
              progress={currentProgress}
              successCriteria={currentSuccessCriteria}
              onToggleCriterion={handleToggleCriterion}
              outcomesList={activeEngagementData?.outcome?.work_plan?.outcomes || []}
            />

            {/* Next Best Action and Active Blockers in a balanced 2-column layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Primary Recommended Next Action */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 font-mono block">
                  Next Action
                </span>
                <p className="text-xs font-semibold text-slate-900 leading-snug">
                  {nextActionText}
                </p>
                <p className="text-xs text-slate-500 leading-relaxed pt-1 border-t border-slate-100">
                  <span className="font-medium text-slate-700">Why now:</span> {nextActionWhy}
                </p>
              </div>

              {/* Actionable Blockers */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 font-mono block">
                  Active Blockers & Dependencies
                </span>
                {nextActionData?.gating_blocker ? (
                  <div className="p-2.5 rounded bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-0.5">
                    <span className="font-semibold block">{nextActionData.gating_blocker.title || nextActionData.gating_blocker}</span>
                    <span className="text-[11px] text-amber-800">Waiting on customer owner</span>
                  </div>
                ) : (isAcme && !approvedAcme) ? (
                  <div className="p-2.5 rounded bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-0.5">
                    <span className="font-semibold block">Enterprise SSO Configuration</span>
                    <span className="text-[11px] text-amber-800">Waiting on customer IT security owner for SAML metadata</span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded bg-emerald-50/60 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Zero gating blockers. Active cycle is proceeding normally.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Evidence & Reasoning chain */}
            {isAcme && !activeEngagementData?.outcome?.work_plan ? (
              <EvidenceReasoningCard
                title="Change Impact Reasoning"
                evidence={[
                  `Customer requirement: Enterprise SSO is mandatory prior to cutover.`,
                  `Outcome v1 Definition of Done lacks authentication clause.`,
                  `Production validation gated on security compliance.`
                ]}
                reasoning={[
                  `Adding Enterprise SSO is a mandatory gating requirement for customer IT security sign-off.`,
                  `DoD completion progress affected: Step 4 requires SSO validation item before Step 5 deployment.`
                ]}
                recommendation={
                  approvedAcme
                    ? "Outcome Version 2 active. Enterprise SSO requirement integrated into Definition of Done checklist."
                    : "Upgrade Outcome to Version 2. Add Enterprise SSO configuration & validation to DoD checklist and request Manager approval."
                }
                confidence="High (96.4%)"
                approvalRequired={!approvedAcme}
                onApprove={!approvedAcme ? handleApproveChange : undefined}
              />
            ) : (
              <EvidenceReasoningCard
                title="Plan Agent Grounding & Alignment"
                evidence={[
                  activeEngagementData?.outcome?.work_plan
                    ? `Manager approved structured work plan with ${activeEngagementData.outcome.work_plan.milestones?.length || 3} milestones.`
                    : `Baseline engagement parameters initialized for ${activeCustomer.customerName}.`,
                  `Objective: ${currentOutcomeStatement.slice(0, 90)}...`,
                  `Definition of Done: ${currentSuccessCriteria.length} acceptance conditions established.`
                ]}
                reasoning={[
                  `Target delivery stages are aligned with customer technical constraints.`,
                  `Progress is tracked deterministically against DoD acceptance criteria.`
                ]}
                recommendation={nextActionText}
                confidence="High (98.2%)"
                approvalRequired={false}
              />
            )}
          </div>
        )}

        {/* 2. PLAN & TASKS TAB: Natural language planning + structured milestones */}
        {activeTab === "plan" && (
          <div className="space-y-6">
            <WorkPlanSection
              engagementId={engagementId}
              customerName={activeCustomer.customerName}
              initialWorkPlan={activeEngagementData?.outcome?.work_plan}
              outcomeVersion={currentOutcomeVersion}
              onPlanApproved={() => {
                fetchEngagementDetail(engagementId);
              }}
            />
          </div>
        )}

        {/* 3. KNOWLEDGE TAB: Grounded semantic search and indexed documents */}
        {activeTab === "knowledge" && (
          <div className="space-y-6">
            <KnowledgePanel engagementId={activeCustomer.id} customerName={activeCustomer.customerName} />
          </div>
        )}

        {/* 4. CHANGES & RISKS TAB: Scope drift, reasoning, and approval */}
        {activeTab === "changes" && (
          <div className="space-y-6">
            <EvidenceReasoningCard
              title="UNDERSTAND Change Impact Reasoning"
              evidence={[
                `Customer requirement input: 'Enterprise SSO is mandatory before cutover.'`,
                `Current Outcome v1 success criteria lacks enterprise authentication clause.`,
                `Step 4 production validation gated on security compliance.`
              ]}
              reasoning={[
                `Adding Enterprise SSO is a mandatory gating requirement for customer IT security sign-off.`,
                `DoD completion progress affected: Step 4 requires SSO validation item before Step 5 deployment.`
              ]}
              recommendation={
                approvedAcme
                  ? "Outcome Version 2 active. Enterprise SSO requirement integrated into Definition of Done checklist."
                  : "Upgrade Outcome to Version 2. Add Enterprise SSO configuration & validation to DoD checklist and request Manager approval."
              }
              confidence="High (96.4%)"
              approvalRequired={!approvedAcme}
              onApprove={!approvedAcme ? handleApproveChange : undefined}
            />
          </div>
        )}

        {/* 5. CUSTOMER UPDATES TAB: Executive update drafting & approval */}
        {activeTab === "updates" && (
          <div className="space-y-6">
            <CustomerUpdatePanel
              engagementId={activeCustomer.id}
              customerName={activeCustomer.customerName}
              engagementName={activeCustomer.engagementName}
            />
          </div>
        )}

        {/* 6. TIMELINE TAB: Chronological audit trail */}
        {activeTab === "timeline" && (
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 font-display">Audit Trail</h2>
            {activeEngagementData?.timeline && activeEngagementData.timeline.length > 0 ? (
              <ul className="divide-y divide-slate-100 text-xs">
                {activeEngagementData.timeline.map((evt: any) => (
                  <li key={evt.id} className="py-2.5 flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <span className="font-semibold text-slate-900 block">{evt.title}</span>
                      <p className="text-slate-600 leading-relaxed">{evt.description}</p>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono shrink-0">
                      {formatISTDateTime(evt.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="divide-y divide-slate-100 text-xs">
                <li className="py-2.5 flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-900 block">Customer requirement change logged</span>
                    <p className="text-slate-600">Enterprise SSO configuration flagged as prerequisite.</p>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono shrink-0">Recent</span>
                </li>
                <li className="py-2.5 flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-900 block">Outcome Version 1 established</span>
                    <p className="text-slate-600">Initial Definition of Done criteria activated.</p>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono shrink-0">Initial</span>
                </li>
              </ul>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function EngagementDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
          <div className="text-xs text-slate-500 font-mono animate-pulse flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-slate-400 animate-ping" />
            <span>Loading workspace...</span>
          </div>
        </div>
      }
    >
      <EngagementDetailContent />
    </React.Suspense>
  );
}
