"use client";

import React from "react";
import AppShell from "@/components/layout/AppShell";
import OutcomeCard from "@/components/engagement/OutcomeCard";
import WorkCycleStepper from "@/components/engagement/WorkCycleStepper";
import EvidenceReasoningCard from "@/components/engagement/EvidenceReasoningCard";
import { useAuth } from "@/context/AuthContext";
import { useEngagement } from "@/context/EngagementContext";
import { 
  Building2, 
  RefreshCw, 
  CheckCircle, 
  Sparkles, 
  Clock, 
  ArrowRight, 
  ShieldCheck, 
  AlertTriangle,
  Layers,
  FileText
} from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  const { role } = useAuth();
  const {
    activeCustomer,
    activeEngagementData,
    nextActionData,
    loading,
    approvedAcme,
    fetchEngagementDetail,
    handleApproveChange
  } = useEngagement();

  const isAcme = activeCustomer.id === "eng-acme-001";
  const currentStepNumber = isAcme ? 4 : 5;

  // ----------------------------------------------------
  // MANAGER VIEW: Section 16 Manager Control Center
  // ----------------------------------------------------
  if (role === "MANAGER") {
    return (
      <AppShell>
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Top Banner */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-amber-400" />
                <h1 className="text-xl font-bold text-slate-100">Manager Control Center</h1>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Attention & Approvals Overview across Customer Engagements
              </p>
            </div>

            <Link
              href="/approvals"
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-1.5"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Open Approval Center ({approvedAcme ? 0 : 1})</span>
            </Link>
          </div>

          {/* Section 16: "Needs Your Attention" Summary */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Needs Your Attention
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-1">
                <span className="text-2xl font-bold text-amber-400 font-mono">{approvedAcme ? 0 : 1}</span>
                <span className="font-semibold text-slate-200 block">Outcome Version Changes</span>
                <p className="text-[11px] text-slate-400">Scope shift requiring DoD v2 approval</p>
              </div>

              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-1">
                <span className="text-2xl font-bold text-teal-400 font-mono">1</span>
                <span className="font-semibold text-slate-200 block">Consequential Actions</span>
                <p className="text-[11px] text-slate-400">Security configuration dependency gating</p>
              </div>

              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-1">
                <span className="text-2xl font-bold text-slate-200 font-mono">1</span>
                <span className="font-semibold text-slate-200 block">Customer Updates Awaiting Review</span>
                <p className="text-[11px] text-slate-400">DELIVER draft ready for external sharing</p>
              </div>
            </div>
          </div>

          {/* Engagement Overview List */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Customer Engagements Status & Risk Overview
            </h2>
            <div className="space-y-3">
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100 text-sm">Acme Corp</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      approvedAcme ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                    }`}>
                      {approvedAcme ? "HEALTHY" : "NEEDS_REASSESSMENT"}
                    </span>
                  </div>
                  <p className="text-slate-400">Onboarding Modernization — Outcome Version {approvedAcme ? 2 : 1}</p>
                  <p className="text-[11px] text-slate-300">
                    <strong>What Changed:</strong> {approvedAcme ? "Enterprise SSO DoD v2 approved." : "Customer introduced mandatory Enterprise SSO requirement."}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href="/approvals"
                    className="px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 rounded-lg transition font-semibold"
                  >
                    {approvedAcme ? "View Approval Log" : "Review & Approve (1)"}
                  </Link>
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100 text-sm">Globex Corp</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      HEALTHY
                    </span>
                  </div>
                  <p className="text-slate-400">Legacy Data Migration — Outcome Version 1</p>
                  <p className="text-[11px] text-slate-300">
                    <strong>What Changed:</strong> Zero scope drift. Debezium CDC replication stream active.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href="/engagements/eng-globex-002"
                    className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 rounded-lg transition"
                  >
                    Open Workspace
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  // ----------------------------------------------------
  // FDE VIEW: Section 5 FDE My Work (Outcome-First)
  // ----------------------------------------------------
  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Header Summary */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-teal-400" />
              <h1 className="text-xl font-bold text-slate-100">{activeCustomer.customerName} — My Work</h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Outcome Execution & Next Best Action for {activeCustomer.engagementName}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchEngagementDetail(activeCustomer.id)}
              className="flex items-center gap-1.5 text-xs bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 hover:border-slate-700 px-3 py-1.5 rounded-lg transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-teal-400" : ""}`} />
              <span>Sync REST API</span>
            </button>

            {isAcme && approvedAcme && (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-3 py-1.5 rounded-lg">
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Outcome Version 2 active.</span>
              </div>
            )}
          </div>
        </div>

        {/* 6 FDE Engagement Work Cycles Stepper Context */}
        <WorkCycleStepper currentStepNumber={currentStepNumber} customerName={activeCustomer.customerName} />

        {/* Section 5 FDE Outcome-First Workspace Canvas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* 1. Current Customer Outcome & DoD Card */}
            <OutcomeCard
              customerName={activeCustomer.customerName}
              engagementName={activeCustomer.engagementName}
              outcomeStatement={isAcme ? "Reduce manual onboarding time from 30 min to under 5 min." : "Migrate 50M records to Cloud SQL with zero downtime."}
              version={approvedAcme ? 2 : 1}
              status={approvedAcme ? "HEALTHY" : "NEEDS_REASSESSMENT"}
              progress={approvedAcme ? 75 : 70}
              successCriteria={
                approvedAcme
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
                    ]
              }
            />

            {/* 2. What Changed & Evidence -> Reasoning -> Recommendation */}
            <EvidenceReasoningCard
              title="What Changed? (Change Impact Analysis)"
              evidence={[
                `Customer input: 'Enterprise SSO is required before production deployment.'`,
                `Current Outcome v1 success criteria lacks enterprise authentication clause.`
              ]}
              reasoning={[
                `Adding Enterprise SSO is a mandatory gating requirement for customer IT security sign-off.`,
                `Production validation step in Step 4 requires SSO validation item before Step 5 rollout.`
              ]}
              recommendation={
                approvedAcme
                  ? "Outcome Version 2 activated by Manager. Enterprise SSO integrated into Definition of Done checklist."
                  : "Upgrade Outcome to Version 2. Add Enterprise SSO configuration & validation to DoD checklist and request Manager approval."
              }
              confidence="High (96.4%)"
              approvalRequired={!approvedAcme}
              onApprove={!approvedAcme ? handleApproveChange : undefined}
            />
          </div>

          {/* Right Sidebar: MOVE Next Best Action & Blockers */}
          <div className="space-y-6">
            {/* MOVE Next Best Action Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  Next Best Action (MOVE Agent)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 font-mono">
                  {approvedAcme ? "HIGH_PRIORITY" : "CRITICAL"}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-400 block uppercase">Situation</span>
                  <p className="text-slate-200 font-medium">{approvedAcme ? "Outcome v2 active; ready for cutover dry-run." : "Outcome status NEEDS_REASSESSMENT due to SSO dependency."}</p>
                </div>

                <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                  <span className="text-[10px] font-mono text-teal-400 block uppercase">Recommendation</span>
                  <p className="text-slate-100 font-bold">{approvedAcme ? "Execute cutover dry-run test on staging replica." : "Request SSO configuration from customer security owner."}</p>
                </div>

                <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-400 block uppercase">Why Now</span>
                  <p className="text-slate-300 leading-relaxed">{approvedAcme ? "Confirms 15-minute cutover window." : "Primary blocker gating Step 4 production rollout."}</p>
                </div>
              </div>
            </div>

            {/* Active Blockers */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Active Blockers ({activeCustomer.customerName})
              </h3>
              <ul className="space-y-2 text-xs">
                <li className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between font-medium text-slate-200">
                    <span className="text-amber-400">● SSO Configuration</span>
                    <span className="text-[10px] text-slate-500">Waiting on Customer</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Customer security team owns the dependency.</p>
                </li>
              </ul>
            </div>

            {/* Customer Communication Status */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Customer Status Communication</span>
                <FileText className="h-3.5 w-3.5 text-teal-400" />
              </h3>
              <p className="text-xs text-slate-300">
                Draft Executive Update generated by DELIVER Agent: <strong className="text-slate-100 font-mono">Pending Manager Review</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
