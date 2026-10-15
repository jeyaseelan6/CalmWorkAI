"use client";

import React, { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import MyDayView from "@/components/engagement/MyDayView";
import EvidenceReasoningCard from "@/components/engagement/EvidenceReasoningCard";
import ChangeAnalysisPanel from "@/components/intelligence/ChangeAnalysisPanel";
import KnowledgePanel from "@/components/knowledge/KnowledgePanel";
import CustomerUpdatePanel from "@/components/delivery/CustomerUpdatePanel";
import WorkPlanSection from "@/components/engagement/WorkPlanSection";
import { useEngagement } from "@/context/EngagementContext";
import { useParams } from "next/navigation";
import { formatISTDateTime } from "@/utils/date";

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
    fetchEngagementDetail,
    activeTab,
    setActiveTab
  } = useEngagement();

  // Sync route parameter and query tab with active engagement context
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

    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get("tab");
      if (tabParam && ["myday", "plan", "knowledge", "changes", "updates", "timeline"].includes(tabParam)) {
        setActiveTab(tabParam as any);
      }
    }
  }, [engagementId, customers]);

  const handleTabChange = (tab: "myday" | "plan" | "knowledge" | "changes" | "updates" | "timeline") => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    }
  };

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
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate">
                Delivery Workspace · {activeEngagementData?.engagement?.current_work_cycle || "Step 4: Build & Integrate"}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border ${
                isHealthy
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isHealthy ? "bg-emerald-500" : "bg-amber-500"}`} />
                <span>{isHealthy ? "Healthy" : "Needs Review"}</span>
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-mono">
                Goals v{currentOutcomeVersion}
              </span>
            </div>
          </div>

          {/* Simple, Consistent Tabs Navigation (Swipeable horizontally on mobile) */}
          <nav className="flex items-center gap-1.5 border-t border-slate-100 pt-2.5 overflow-x-auto text-xs whitespace-nowrap pb-1">
            <button
              onClick={() => handleTabChange("myday")}
              className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                activeTab === "myday"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              My Day
            </button>
            <button
              onClick={() => handleTabChange("plan")}
              className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                activeTab === "plan"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              Plan &amp; Tasks
            </button>
            <button
              onClick={() => handleTabChange("knowledge")}
              className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                activeTab === "knowledge"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              Knowledge
            </button>
            <button
              onClick={() => handleTabChange("changes")}
              className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                activeTab === "changes"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              Changes &amp; Risks
            </button>
            <button
              onClick={() => handleTabChange("updates")}
              className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                activeTab === "updates"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              Customer Updates
            </button>
            <button
              onClick={() => handleTabChange("timeline")}
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
                    <p className="text-slate-600">Initial Outcome Goals criteria activated.</p>
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
