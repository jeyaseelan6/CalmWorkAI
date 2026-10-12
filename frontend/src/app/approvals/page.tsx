"use client";

import React, { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { useEngagement } from "@/context/EngagementContext";
import { useAuth } from "@/context/AuthContext";
import { ShieldCheck, CheckCircle, AlertTriangle, ArrowRight, XCircle, Lock } from "lucide-react";

export default function ApprovalsPage() {
  const { activeCustomer, approvedAcme, handleApproveChange } = useEngagement();
  const { isManager, isFDE } = useAuth();
  const [rejected, setRejected] = useState(false);

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                  {isManager ? "Manager Governance Center (Full Authority)" : "Governance Center (FDE Read-Only Oversight)"}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-slate-100">
                {isManager ? "Unified Manager Approval Center" : "Engagement Approvals & DoD Status"}
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                {isManager 
                  ? "Review and authorize consequential outcome version transitions, gating actions, and customer communication drafts. No state change bypasses this approval boundary."
                  : "Monitor active outcome change proposals and Definition of Done upgrade requests. As an FDE, you can propose changes; manager sign-off is required to activate them."}
              </p>
            </div>

            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono">
              <span className="text-amber-400 font-bold">{approvedAcme ? 0 : 1}</span>
              <span className="text-slate-400">Pending Approvals</span>
            </div>
          </div>
        </div>

        {/* Approvals List */}
        <div className="space-y-4">
          {!approvedAcme && !rejected ? (
            <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                  <span className="text-xs font-mono font-bold uppercase text-amber-400">
                    TYPE: OUTCOME_CHANGE (v1 → v2)
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-mono">Customer: {activeCustomer.customerName}</span>
              </div>

              {/* Recommendation, Why, Evidence, Impact, Confidence */}
              <div className="space-y-3 text-xs">
                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-[10px] text-teal-400 font-mono font-bold block uppercase">
                    1. Recommendation
                  </span>
                  <p className="text-slate-100 font-semibold text-sm">
                    Upgrade Definition of Done checklist for {activeCustomer.customerName} to Version 2 by adding "Enterprise SSO configuration & validation".
                  </p>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-[10px] text-amber-400 font-mono font-bold block uppercase">
                    2. Why Now
                  </span>
                  <p className="text-slate-300">
                    Customer IT security team added a mandatory authentication requirement. Production validation step is currently blocked until this criteria is satisfied.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 font-mono font-bold block uppercase">
                      3. Evidence
                    </span>
                    <ul className="text-slate-300 pl-3 list-disc text-[11px] space-y-0.5">
                      <li>Customer requirement input received</li>
                      <li>Current outcome v1 lacks SSO clause</li>
                    </ul>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 font-mono font-bold block uppercase">
                      4. Impact
                    </span>
                    <p className="text-slate-300 text-[11px]">
                      +2 days timeline shift; gates Step 4 production rollout cleanly.
                    </p>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 font-mono font-bold block uppercase">
                      5. Confidence
                    </span>
                    <span className="text-emerald-400 font-bold font-mono block text-sm">High (96.4%)</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons — Gated by Role */}
              <div className="pt-3 border-t border-slate-800">
                {isManager ? (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-amber-400/90 font-mono flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Manager Role: Full Decision Authority</span>
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setRejected(true)}
                        className="px-4 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-lg text-xs transition flex items-center gap-1.5"
                      >
                        <XCircle className="h-4 w-4 text-rose-400" />
                        <span>Reject Proposal</span>
                      </button>
                      <button
                        onClick={handleApproveChange}
                        className="px-5 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg text-xs transition flex items-center gap-1.5 shadow-md"
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span>Approve Version 2 DoD Upgrade</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 text-slate-300">
                      <Lock className="h-4 w-4 text-amber-400 shrink-0" />
                      <span className="leading-relaxed">
                        <strong className="text-amber-400 font-semibold">Manager Sign-Off Required:</strong> As an FDE, you can review this proposed Definition of Done change, but only an Engineering Manager can authorize the state transition.
                      </span>
                    </div>
                    <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded font-mono text-[11px] font-semibold shrink-0 ml-3">
                      FDE (Read-Only)
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-3">
              <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto" />
              <h3 className="text-base font-bold text-slate-100">All Approvals Up to Date</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No pending outcome version changes or consequential action approvals required for {activeCustomer.customerName}.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
