"use client";

import React from "react";
import AppShell from "@/components/layout/AppShell";
import { useEngagement } from "@/context/EngagementContext";
import { Zap, ShieldAlert, Sparkles, CheckCircle, Clock, AlertTriangle } from "lucide-react";

export default function ActionsPage() {
  const { activeCustomer, nextActionData, approvedAcme } = useEngagement();
  const isAcme = activeCustomer.id === "eng-acme-001";

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-64 bg-gradient-to-l from-teal-500/10 via-transparent to-transparent pointer-events-none" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400">
                  <Zap className="h-5 w-5" />
                </div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-teal-400">
                  MOVE Agent Engine
                </span>
              </div>
              <h1 className="text-2xl font-bold text-slate-100">
                Next Best Action & Blocker Resolver
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Execution velocity engine for <strong className="text-slate-200">{activeCustomer.customerName}</strong>. Ranks gating blockers, dependency chains, and active work cycles to determine the single highest-impact Next Best Action.
              </p>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
              <span className={`text-xs px-3 py-1 rounded-full font-mono border ${
                approvedAcme ? "bg-teal-500/10 text-teal-300 border-teal-500/30" : "bg-amber-500/20 text-amber-300 border-amber-500/30"
              }`}>
                Priority: {approvedAcme ? "HIGH_PRIORITY" : "CRITICAL"}
              </span>
            </div>
          </div>
        </div>

        {/* 1. Next Best Action Detailed Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-teal-400" />
              <h2 className="text-base font-bold text-slate-100">Primary Next Best Action</h2>
            </div>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Confidence: High (96%)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-1.5">
              <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block">1. Situation</span>
              <p className="text-slate-200 font-semibold leading-relaxed">
                {approvedAcme
                  ? `Outcome Version 2 is active for ${activeCustomer.customerName}. Work cycle Step 4 validation is complete; ready for cutover performance dry-run.`
                  : `Outcome status for ${activeCustomer.customerName} is NEEDS_REASSESSMENT due to pending Enterprise SSO dependency gating Step 4.`}
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-lg border border-teal-500/40 space-y-1.5">
              <span className="text-[10px] font-mono text-teal-400 uppercase font-bold block">2. Recommendation</span>
              <p className="text-teal-300 font-bold text-sm leading-relaxed">
                {approvedAcme
                  ? "Execute cutover performance dry-run test on staging replica."
                  : "Request required Enterprise SSO configuration from customer security owner."}
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-1.5">
              <span className="text-[10px] font-mono text-amber-400 uppercase font-bold block">3. Why Now</span>
              <p className="text-slate-300 leading-relaxed">
                {approvedAcme
                  ? "Performance benchmark data is required to confirm the 15-minute cutover window before Step 5 production deployment."
                  : "Enterprise SSO is currently the primary gating blocker preventing Step 4 production validation."}
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-1.5">
              <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold block">4. Expected Impact</span>
              <p className="text-slate-300 leading-relaxed">
                {approvedAcme
                  ? "Validates zero-downtime replication speed and clears final Step 5 deployment approval."
                  : "Satisfies customer IT security compliance and clears production validation gating."}
              </p>
            </div>
          </div>
        </div>

        {/* 2. Active Blockers & Dependencies Matrix */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-400" />
              Active Blockers & Dependencies ({activeCustomer.customerName})
            </h2>
            <span className="text-xs font-mono text-slate-400">1 Gating Item</span>
          </div>

          <div className="space-y-3 text-xs">
            {!approvedAcme ? (
              <div className="bg-slate-950 p-4 rounded-lg border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-400 text-sm">● Enterprise SSO Configuration</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                      GATING BLOCKER
                    </span>
                  </div>
                  <p className="text-slate-300">Owner: Customer Security Team | Status: Waiting on Customer</p>
                  <p className="text-[11px] text-slate-400">
                    SAML 2.0 / OAuth2 metadata XML file required to configure authentication service in staging environment.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950 p-4 rounded-lg border border-emerald-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-400 text-sm">● Staging Maintenance Window</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                      SCHEDULED
                    </span>
                  </div>
                  <p className="text-slate-300">Owner: FDE Team | Status: Confirmed for Off-Peak Benchmark</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
