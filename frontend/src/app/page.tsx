"use client";

import React from "react";
import AppShell from "@/components/layout/AppShell";
import OutcomeCard from "@/components/engagement/OutcomeCard";
import WorkCycleStepper from "@/components/engagement/WorkCycleStepper";
import DailyWorkBriefing from "@/components/engagement/DailyWorkBriefing";
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

export default function HomePage() {
  const { role } = useAuth();
  const {
    activeCustomer,
    loading,
    approvedAcme,
    fetchEngagementDetail
  } = useEngagement();

  const isAcme = activeCustomer.id === "eng-acme-001";
  const currentStepNumber = isAcme ? 4 : 5;

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
              <span>Open Approval Center ({approvedAcme ? 0 : 1})</span>
            </Link>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-2 font-mono">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
              Attention Required ({approvedAcme ? 0 : 1} Pending)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <Link href="/approvals" className="bg-slate-50 p-3.5 rounded-md border border-slate-200 hover:bg-slate-100 transition space-y-1 block">
                <span className="text-2xl font-bold text-amber-800 font-mono block">{approvedAcme ? 0 : 1}</span>
                <span className="font-semibold text-slate-900 block text-xs">Outcome Version Changes</span>
                <p className="text-[11px] text-slate-500">DoD v2 upgrade awaiting approval</p>
              </Link>

              <Link href="/actions" className="bg-slate-50 p-3.5 rounded-md border border-slate-200 hover:bg-slate-100 transition space-y-1 block">
                <span className="text-2xl font-bold text-slate-900 font-mono block">1</span>
                <span className="font-semibold text-slate-900 block text-xs">Consequential Actions</span>
                <p className="text-[11px] text-slate-500">Security configuration dependency gating</p>
              </Link>

              <Link href="/delivery" className="bg-slate-50 p-3.5 rounded-md border border-slate-200 hover:bg-slate-100 transition space-y-1 block">
                <span className="text-2xl font-bold text-slate-900 font-mono block">1</span>
                <span className="font-semibold text-slate-900 block text-xs">Customer Updates Awaiting Review</span>
                <p className="text-[11px] text-slate-500">DELIVER draft ready for external sharing</p>
              </Link>
            </div>
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

            {isAcme && approvedAcme && (
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3 py-1 rounded-md font-semibold">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                <span>Outcome v2 Active</span>
              </div>
            )}
          </div>
        </div>

        {/* 1. Active Outcome Definition & DoD Card */}
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

        {/* 2. Clean 6-Step FDE Work Cycle Stepper */}
        <WorkCycleStepper currentStepNumber={currentStepNumber} customerName={activeCustomer.customerName} />

        {/* 3. Proactive Intelligence Daily Work Briefing */}
        <DailyWorkBriefing />

        {/* 3. Specialized AI Agent Workspaces Navigation Grid */}
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
              <div className="text-[11px] text-slate-800 font-mono bg-slate-50 p-2 rounded border border-slate-200">
                Action: {approvedAcme ? "Execute cutover dry-run test" : "Request SSO configuration from security owner"}
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
                Evaluates requirement changes using Evidence $\rightarrow$ Reasoning $\rightarrow$ Recommendation.
              </p>
              <div className="text-[11px] text-amber-900 font-mono bg-amber-50 p-2 rounded border border-amber-200 font-semibold">
                Status: {approvedAcme ? "Outcome v2 DoD Active" : "Pending Scope Re-Assessment (v1 → v2)"}
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
                Docs: 3 Indexed Specs (SAML 2.0, Architecture, Logs)
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
                Draft: Executive Update (Pending Manager Review)
              </div>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
