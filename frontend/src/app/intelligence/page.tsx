"use client";

import React from "react";
import AppShell from "@/components/layout/AppShell";
import ChangeImpactCard from "@/components/intelligence/ChangeImpactCard";
import { useEngagement } from "@/context/EngagementContext";
import { Sparkles, ShieldCheck, CheckCircle, AlertTriangle, Lock, FileText, ArrowUpRight } from "lucide-react";

export default function IntelligencePage() {
  const { activeCustomer, approvedAcme, handleApproveChange } = useEngagement();
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
                  <Sparkles className="h-5 w-5" />
                </div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-teal-400">
                  UNDERSTAND Agent Engine
                </span>
              </div>
              <h1 className="text-2xl font-bold text-slate-100">
                Scope Drift & Change Impact Engine
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Automated change evaluation for <strong className="text-slate-200">{activeCustomer.customerName}</strong>. Analyzes requested requirement shifts against the active outcome contract, assesses technical trade-offs, and manages manager approval for Definition of Done (DoD) outcome versioning.
              </p>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
                <Lock className="h-3.5 w-3.5 text-teal-400" />
                <span className="text-slate-300">Privacy Guardrail Active</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                Model: understand_agent_v1.4 | Pseudonymized Context
              </span>
            </div>
          </div>
        </div>

        {/* Change Assessment Canvas */}
        <div className="space-y-6">
          {isAcme ? (
            !approvedAcme ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Pending Scope Re-Assessment Required
                  </h2>
                  <span className="text-xs px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                    Impact Status: NEEDS_REASSESSMENT
                  </span>
                </div>
                <ChangeImpactCard
                  changeTitle='Customer requirement changed: "Enterprise SSO configuration & validation is required before production deployment."'
                  onApprove={handleApproveChange}
                  onReject={() => alert("Outcome recommendation rejected.")}
                />
              </div>
            ) : (
              <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                      <CheckCircle className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-100">
                        Outcome Definition of Done — Version 2 Approved
                      </h3>
                      <p className="text-xs text-slate-400">
                        Approved by Engineering Manager for {activeCustomer.customerName}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                    Status: Active Outcome Contract (v2)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
                    <span className="text-[11px] text-slate-500 font-mono block">ADDED CRITERIA</span>
                    <p className="font-medium text-slate-200">Enterprise SSO configuration & validation</p>
                  </div>
                  <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
                    <span className="text-[11px] text-slate-500 font-mono block">DELIVERY DELTA</span>
                    <p className="font-medium text-amber-300">+2 Days (Timeline adjusted)</p>
                  </div>
                  <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
                    <span className="text-[11px] text-slate-500 font-mono block">RESOURCE IMPACT</span>
                    <p className="font-medium text-slate-200">Zero additional budget required</p>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-teal-400">
                  <ShieldCheck className="h-5 w-5" />
                  <h3 className="text-sm font-semibold text-slate-100">
                    CDC Replication Stream Scope Check — Healthy
                  </h3>
                </div>
                <span className="text-xs px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                  Zero Scope Drift
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                The UNDERSTAND Agent continuously monitors change requests against <strong className="text-slate-100">{activeCustomer.customerName}</strong>'s current engagement definition. All 3 current success criteria remain stable with no scope drift detected.
              </p>
            </div>
          )}

          {/* Change Impact Analysis Methodology & Logs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <FileText className="h-4 w-4 text-teal-400" />
                Change Trade-Off Evaluation Matrix
              </h3>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="font-semibold block text-slate-200">Schedule Impact</span>
                    <span className="text-[11px] text-slate-400">Timeline shift vs milestone deadline</span>
                  </div>
                  <span className="text-amber-400 font-bold font-mono">+2 Days</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="font-semibold block text-slate-200">Risk Severity Level</span>
                    <span className="text-[11px] text-slate-400">Probability of production block</span>
                  </div>
                  <span className="text-emerald-400 font-bold font-mono">LOW (Manageable)</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="font-semibold block text-slate-200">Value-to-Effort Ratio</span>
                    <span className="text-[11px] text-slate-400">Customer outcome alignment</span>
                  </div>
                  <span className="text-teal-400 font-bold font-mono">9.2 / 10</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Outcome Version History</span>
                <ArrowUpRight className="h-4 w-4 text-slate-500" />
              </h3>
              <ul className="space-y-2.5 text-xs">
                {isAcme && approvedAcme && (
                  <li className="p-2.5 bg-slate-950 rounded-lg border border-emerald-500/30 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-emerald-300">Version 2.0 (Active)</span>
                      <span className="text-[11px] text-slate-400 block">Added Enterprise SSO DoD criteria</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">Just Now</span>
                  </li>
                )}
                <li className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-300">Version 1.0 (Baseline)</span>
                    <span className="text-[11px] text-slate-400 block">Initial Onboarding Modernization DoD</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">2 Days Ago</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
