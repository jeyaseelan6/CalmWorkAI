"use client";

import React from "react";
import AppShell from "@/components/layout/AppShell";
import OutcomeCard from "@/components/engagement/OutcomeCard";
import WorkCycleStepper from "@/components/engagement/WorkCycleStepper";
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
        <div className="max-w-5xl mx-auto space-y-6">
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

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Needs Your Attention
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <Link href="/approvals" className="bg-slate-950 p-4 rounded-lg border border-slate-800 hover:border-amber-500/40 transition space-y-1 block">
                <span className="text-2xl font-bold text-amber-400 font-mono">{approvedAcme ? 0 : 1}</span>
                <span className="font-semibold text-slate-200 block">Outcome Version Changes</span>
                <p className="text-[11px] text-slate-400">DoD v2 upgrade awaiting approval</p>
              </Link>

              <Link href="/actions" className="bg-slate-950 p-4 rounded-lg border border-slate-800 hover:border-teal-500/40 transition space-y-1 block">
                <span className="text-2xl font-bold text-teal-400 font-mono">1</span>
                <span className="font-semibold text-slate-200 block">Consequential Actions</span>
                <p className="text-[11px] text-slate-400">Security configuration dependency gating</p>
              </Link>

              <Link href="/delivery" className="bg-slate-950 p-4 rounded-lg border border-slate-800 hover:border-teal-500/40 transition space-y-1 block">
                <span className="text-2xl font-bold text-slate-200 font-mono">1</span>
                <span className="font-semibold text-slate-200 block">Customer Updates Awaiting Review</span>
                <p className="text-[11px] text-slate-400">DELIVER draft ready for external sharing</p>
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
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Header Summary */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-teal-400" />
              <h1 className="text-xl font-bold text-slate-100">{activeCustomer.customerName} Cockpit</h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Active outcome statement and FDE execution workflow for {activeCustomer.engagementName}
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
                <span>Outcome Version 2 Active</span>
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

        {/* 3. Specialized AI Agent Workspaces Navigation Grid */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Dedicated Agent Intelligence Workspaces
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* MOVE Agent Link */}
            <Link
              href="/actions"
              className="bg-slate-900 border border-slate-800 hover:border-teal-500/40 rounded-xl p-5 group transition space-y-2 block shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-teal-300 text-sm">
                  <Zap className="h-4 w-4 text-teal-400" />
                  <span>MOVE Agent — Next Best Action</span>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500 group-hover:translate-x-1 group-hover:text-teal-400 transition" />
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Determines the single highest-impact Next Best Action and resolves gating blockers.
              </p>
              <div className="text-[10px] text-teal-400 font-mono bg-slate-950 p-2 rounded border border-slate-800">
                Action: {approvedAcme ? "Execute cutover dry-run test" : "Request SSO configuration from security owner"}
              </div>
            </Link>

            {/* UNDERSTAND Agent Link */}
            <Link
              href="/intelligence"
              className="bg-slate-900 border border-slate-800 hover:border-teal-500/40 rounded-xl p-5 group transition space-y-2 block shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-teal-300 text-sm">
                  <Sparkles className="h-4 w-4 text-teal-400" />
                  <span>UNDERSTAND Agent — Scope Impact</span>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500 group-hover:translate-x-1 group-hover:text-teal-400 transition" />
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Evaluates requirement changes using Evidence $\rightarrow$ Reasoning $\rightarrow$ Recommendation.
              </p>
              <div className="text-[10px] text-amber-400 font-mono bg-slate-950 p-2 rounded border border-slate-800">
                Status: {approvedAcme ? "Outcome v2 DoD Active" : "Pending Scope Re-Assessment (v1 → v2)"}
              </div>
            </Link>

            {/* KNOW Agent Link */}
            <Link
              href="/knowledge"
              className="bg-slate-900 border border-slate-800 hover:border-teal-500/40 rounded-xl p-5 group transition space-y-2 block shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-teal-300 text-sm">
                  <BookOpen className="h-4 w-4 text-teal-400" />
                  <span>KNOW Agent — Grounded RAG</span>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500 group-hover:translate-x-1 group-hover:text-teal-400 transition" />
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Semantic search across architecture specs and customer documentation with source citations.
              </p>
              <div className="text-[10px] text-slate-400 font-mono bg-slate-950 p-2 rounded border border-slate-800">
                Docs: 3 Indexed Specs (SAML 2.0, Architecture, Logs)
              </div>
            </Link>

            {/* DELIVER Agent Link */}
            <Link
              href="/delivery"
              className="bg-slate-900 border border-slate-800 hover:border-teal-500/40 rounded-xl p-5 group transition space-y-2 block shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-teal-300 text-sm">
                  <Send className="h-4 w-4 text-teal-400" />
                  <span>DELIVER Agent — Customer Studio</span>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500 group-hover:translate-x-1 group-hover:text-teal-400 transition" />
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Generates executive updates, technical logs, and release notes for Manager approval.
              </p>
              <div className="text-[10px] text-slate-300 font-mono bg-slate-950 p-2 rounded border border-slate-800">
                Draft: Executive Update (Pending Manager Review)
              </div>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
