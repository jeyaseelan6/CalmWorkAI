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
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-600">
                  <Zap className="h-5 w-5" />
                </div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-700">
                  MOVE Agent Engine
                </span>
              </div>
              <h1 className="text-2xl font-display font-bold text-slate-900">
                Next Best Action & Blocker Resolver
              </h1>
              <p className="text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Execution velocity engine for <strong className="text-slate-900">{activeCustomer.customerName}</strong>. Ranks gating blockers, dependency chains, and active work cycles to determine the single highest-impact Next Best Action.
              </p>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
              <span className={`text-xs px-3.5 py-1 rounded-full font-mono font-bold border ${
                approvedAcme ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-amber-50 text-amber-800 border-amber-200"
              }`}>
                Priority: {approvedAcme ? "HIGH_PRIORITY" : "CRITICAL"}
              </span>
            </div>
          </div>
        </div>

        {/* 1. Next Best Action Detailed Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              <h2 className="text-base font-display font-bold text-slate-900">Primary Next Best Action</h2>
            </div>
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
              Confidence: High (96%)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
              <span className="text-xs font-mono text-slate-500 uppercase font-bold block">1. Situation</span>
              <p className="text-slate-900 font-bold text-sm leading-relaxed">
                {approvedAcme
                  ? `Outcome Version 2 is active for ${activeCustomer.customerName}. Work cycle Step 4 validation is complete; ready for cutover performance dry-run.`
                  : `Outcome status for ${activeCustomer.customerName} is NEEDS_REASSESSMENT due to pending Enterprise SSO dependency gating Step 4.`}
              </p>
            </div>

            <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-200 space-y-1.5">
              <span className="text-xs font-mono text-blue-800 uppercase font-bold block">2. Recommendation</span>
              <p className="text-blue-900 font-bold text-sm leading-relaxed">
                {approvedAcme
                  ? "Execute cutover performance dry-run test on staging replica."
                  : "Request required Enterprise SSO configuration from customer security owner."}
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
              <span className="text-xs font-mono text-amber-800 uppercase font-bold block">3. Why Now</span>
              <p className="text-slate-700 leading-relaxed font-medium">
                {approvedAcme
                  ? "Performance benchmark data is required to confirm the 15-minute cutover window before Step 5 production deployment."
                  : "Enterprise SSO is currently the primary gating blocker preventing Step 4 production validation."}
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
              <span className="text-xs font-mono text-emerald-800 uppercase font-bold block">4. Expected Impact</span>
              <p className="text-slate-700 leading-relaxed font-medium">
                {approvedAcme
                  ? "Validates zero-downtime replication speed and clears final Step 5 deployment approval."
                  : "Satisfies customer IT security compliance and clears production validation gating."}
              </p>
            </div>
          </div>
        </div>

        {/* 2. Active Blockers & Dependencies Matrix */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-display font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              Active Blockers & Dependencies ({activeCustomer.customerName})
            </h2>
            <span className="text-xs font-mono text-slate-500 font-semibold">1 Gating Item</span>
          </div>

          <div className="space-y-3 text-xs">
            {!approvedAcme ? (
              <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-900 text-sm">● Enterprise SSO Configuration</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-mono font-bold">
                      GATING BLOCKER
                    </span>
                  </div>
                  <p className="text-slate-700 font-medium">Owner: Customer Security Team | Status: Waiting on Customer</p>
                  <p className="text-xs text-slate-600">
                    SAML 2.0 / OAuth2 metadata XML file required to configure authentication service in staging environment.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-900 text-sm">● Staging Maintenance Window</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold">
                      SCHEDULED
                    </span>
                  </div>
                  <p className="text-slate-700 font-medium">Owner: FDE Team | Status: Confirmed for Off-Peak Benchmark</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
