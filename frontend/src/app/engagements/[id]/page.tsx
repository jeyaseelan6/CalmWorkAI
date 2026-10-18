"use client";

import React from "react";
import AppShell from "@/components/layout/AppShell";
import MyDayView from "@/components/engagement/MyDayView";
import ChangeAnalysisPanel from "@/components/intelligence/ChangeAnalysisPanel";
import KnowledgePanel from "@/components/knowledge/KnowledgePanel";
import CustomerUpdatePanel from "@/components/delivery/CustomerUpdatePanel";
import WorkPlanSection from "@/components/engagement/WorkPlanSection";
import TimelinePanel from "@/components/timeline/TimelinePanel";
import { useEngagement } from "@/context/EngagementContext";
import { useParams, useSearchParams } from "next/navigation";
import { Sun } from "lucide-react";

function EngagementDetailContent() {
  const routeParams = useParams();
  const searchParams = useSearchParams();
  const engagementId = (routeParams?.id as string) || "eng-acme-001";
  const tabParam = searchParams?.get("tab");

  const {
    customers,
    activeCustomer,
    setActiveCustomer,
    activeEngagementData,
    approvedAcme,
    fetchEngagementDetail,
    activeTab,
    setActiveTab,
    runMorningBrief,
    briefLoading,
    lastRefreshed
  } = useEngagement();

  // Sync route parameter and query tab with active engagement context
  React.useEffect(() => {
    if (engagementId && activeCustomer.id !== engagementId) {
      const matching = customers.find((c) => c.id === engagementId);
      if (matching) {
        setActiveCustomer(matching);
      }
    }

    if (tabParam && ["myday", "plan", "knowledge", "changes", "updates", "timeline"].includes(tabParam)) {
      setActiveTab(tabParam as "myday" | "plan" | "knowledge" | "changes" | "updates" | "timeline");
    } else if (!tabParam) {
      setActiveTab("myday");
    }
  }, [engagementId, tabParam, customers, activeCustomer.id, setActiveCustomer, setActiveTab]);

  const isAcme = engagementId === "eng-acme-001";

  const currentOutcomeStatement =
    activeEngagementData?.outcome?.statement ||
    activeEngagementData?.outcome?.work_plan?.engagement_objective ||
    activeCustomer.engagementName;

  const currentOutcomeVersion =
    activeEngagementData?.outcome?.version ?? (isAcme && approvedAcme ? 2 : 1);

  const currentOutcomeStatus =
    activeEngagementData?.engagement?.status ?? (isAcme && approvedAcme ? "HEALTHY" : activeCustomer.status);
  const isHealthy = currentOutcomeStatus === "HEALTHY";

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Calm Workspace Header */}
        <div className="pb-3 border-b border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold font-display text-slate-900 truncate">
                  {activeCustomer.customerName}
                </h1>
                <span className="text-slate-300">·</span>
                <span className="text-xs sm:text-sm text-slate-600 font-medium truncate">
                  {activeCustomer.engagementName}
                </span>
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border ${
                  isHealthy
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isHealthy ? "bg-emerald-500" : "bg-amber-500"}`} />
                  <span>{isHealthy ? "Healthy" : "Needs Review"}</span>
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate">
                {activeEngagementData?.engagement?.current_work_cycle || "Step 1: Understand the Business Reality"}
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {activeTab === "myday" && (
                <div className="flex flex-col items-end gap-0.5">
                  <button
                    type="button"
                    onClick={runMorningBrief}
                    disabled={briefLoading}
                    title="Run Morning Brief Skill across PLAN, KNOW, and MOVE agents"
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    <Sun className={`h-4 w-4 text-slate-950 ${briefLoading ? "animate-spin" : ""}`} />
                    <span>{briefLoading ? "Running Agents..." : "Morning Brief"}</span>
                  </button>
                  {lastRefreshed && (
                    <span className="text-[10px] font-mono text-slate-500">
                      Last updated: {lastRefreshed}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 1. MY DAY TAB: Focus Hero Action, Ordered Tasks, Velocity & MOVE Agent intelligence */}
        {activeTab === "myday" && (
          <div className="space-y-6">
            <MyDayView key={engagementId} embedded={true} />
          </div>
        )}

        {/* 2. PLAN & TASKS TAB: Natural language planning + structured milestones */}
        {activeTab === "plan" && (
          <div className="space-y-6">
            <WorkPlanSection
              key={engagementId}
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
            <KnowledgePanel key={engagementId} engagementId={activeCustomer.id} customerName={activeCustomer.customerName} />
          </div>
        )}

        {/* 4. CHANGES & RISKS TAB: Live scope drift, reasoning, and approval */}
        {activeTab === "changes" && (
          <div className="space-y-6">
            <ChangeAnalysisPanel
              key={engagementId}
              engagementId={engagementId}
              customerName={activeCustomer.customerName}
              outcomeVersion={currentOutcomeVersion}
              onPlanUpdated={() => {
                fetchEngagementDetail(engagementId);
              }}
            />
          </div>
        )}

        {/* 5. CUSTOMER UPDATES TAB: Executive update drafting & approval */}
        {activeTab === "updates" && (
          <div className="space-y-6">
            <CustomerUpdatePanel
              key={engagementId}
              engagementId={activeCustomer.id}
              customerName={activeCustomer.customerName}
              engagementName={activeCustomer.engagementName}
            />
          </div>
        )}

        {/* 6. TIMELINE TAB: Chronological audit trail & shared memory */}
        {activeTab === "timeline" && (
          <TimelinePanel
            key={engagementId}
            engagementId={engagementId}
            customerName={activeCustomer.customerName}
            timeline={activeEngagementData?.timeline || []}
            onRefresh={() => fetchEngagementDetail(engagementId, false)}
          />
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
