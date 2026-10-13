"use client";

import React, { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { useEngagement } from "@/context/EngagementContext";
import { useAuth } from "@/context/AuthContext";
import { ShieldCheck, CheckCircle, AlertTriangle, ArrowRight, XCircle, Lock } from "lucide-react";

export default function ApprovalsPage() {
  const { activeCustomer, activeEngagementData, approvedAcme, handleApproveChange } = useEngagement();
  const { isManager, isFDE } = useAuth();
  const [rejected, setRejected] = useState(false);

  const isAcme = activeCustomer.id === "eng-acme-001";
  const hasPending = isAcme 
    ? (!approvedAcme && !rejected) 
    : (activeEngagementData?.pending_approvals_count > 0 && !rejected);

  const nextVersion = (activeEngagementData?.outcome?.version || 1) + 1;
  const recommendationText = isAcme
    ? `Upgrade Definition of Done checklist for ${activeCustomer.customerName} to Version 2 by adding "Enterprise SSO configuration & validation".`
    : `Upgrade Definition of Done checklist for ${activeCustomer.customerName} to Version ${nextVersion} with updated requirement criteria.`;

  const whyNowText = isAcme
    ? "Customer IT security team added a mandatory authentication requirement. Production validation step is currently blocked until this criteria is satisfied."
    : `New requirement criteria identified for ${activeCustomer.customerName}. Progression is paused until manager authorizes the updated Definition of Done.`;

  const evidenceList = isAcme
    ? ["Customer requirement input received", "Current outcome v1 lacks SSO clause"]
    : [
        activeEngagementData?.timeline?.[0]?.description || "Customer requirement shift logged",
        `Current outcome v${activeEngagementData?.outcome?.version || 1} Definition of Done affected`
      ];

  const impactText = isAcme
    ? "+2 days timeline shift; gates Step 4 production rollout cleanly."
    : `Updates Definition of Done and unlocks execution in ${activeEngagementData?.engagement?.current_work_cycle || "active work cycle"}.`;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Calm Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-display text-slate-900">Approvals</h1>
              <span className="text-slate-300">·</span>
              <span className="text-sm text-slate-600 font-medium">{activeCustomer.customerName}</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Outcome version transitions and Definition of Done authorization boundary
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-md font-mono border ${
              hasPending
                ? "bg-amber-50 text-amber-800 border-amber-200 font-semibold"
                : "bg-slate-100 text-slate-600 border-slate-200"
            }`}>
              {hasPending ? "1 Pending Review" : "All Clear"}
            </span>
          </div>
        </div>

        {/* Approvals Content */}
        <div className="space-y-4">
          {hasPending ? (
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-900 font-display">
                    Proposed Definition of Done Upgrade
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                    v{activeEngagementData?.outcome?.version || 1} &rarr; v{nextVersion}
                  </span>
                </div>
                <span className="text-xs text-slate-500 font-mono">Confidence: 96.4%</span>
              </div>

              {/* Clear Sequence: Change -> Impact -> Recommendation */}
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase font-mono block mb-1">
                    1. Recommended Action
                  </span>
                  <p className="text-slate-900 font-semibold text-sm leading-snug">
                    {recommendationText}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase font-mono block mb-1">
                    2. Why Now & Impact
                  </span>
                  <p className="text-slate-700 leading-relaxed">
                    {whyNowText}
                  </p>
                  <p className="text-slate-500 text-[11px] mt-1 font-mono">
                    Impact: {impactText}
                  </p>
                </div>

                {/* Evidence Progressive Disclosure */}
                <details className="pt-2 border-t border-slate-100 group">
                  <summary className="text-[11px] font-semibold text-slate-600 cursor-pointer hover:text-slate-900 list-none flex items-center justify-between py-1">
                    <span>Show Grounded Evidence ({evidenceList.length} items)</span>
                    <span className="text-slate-400 group-open:rotate-180 transition-transform text-xs">▼</span>
                  </summary>
                  <ul className="mt-2 space-y-1 text-slate-600 pl-4 list-disc text-xs">
                    {evidenceList.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </details>
              </div>

              {/* Action Buttons — Gated by Role */}
              <div className="pt-3 border-t border-slate-100">
                {isManager ? (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-mono">
                      Manager Authority Required
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setRejected(true)}
                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium transition cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        onClick={handleApproveChange}
                        className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-md text-xs transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span>Authorize Version {nextVersion}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-md p-3 flex items-center justify-between text-xs text-slate-600">
                    <span>Manager sign-off required to authorize Definition of Done upgrades.</span>
                    <span className="text-slate-500 font-mono text-[11px]">FDE View</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center space-y-2">
              <CheckCircle className="h-8 w-8 text-emerald-600 mx-auto" />
              <h2 className="text-sm font-semibold text-slate-900">All Approvals Up to Date</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No pending outcome version changes or gating approvals required for {activeCustomer.customerName}.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
