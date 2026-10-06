"use client";

import React, { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import OutcomeCard from "@/components/engagement/OutcomeCard";
import ChangeImpactCard from "@/components/intelligence/ChangeImpactCard";
import { AlertCircle, ArrowUpRight, CheckCircle, Clock, ShieldAlert, Sparkles } from "lucide-react";

export default function Home() {
  const [approved, setApproved] = useState(false);

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Welcome & Top Summary Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-100">My Work Cockpit</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Outcome-driven work intelligence for Forward-Deployed Engineers
            </p>
          </div>
          {approved && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-3 py-1.5 rounded-lg">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <span>Manager approved outcome DoD transition to Version 2.</span>
            </div>
          )}
        </div>

        {/* Current Engagement & Outcome Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Outcome Card */}
            <OutcomeCard
              version={approved ? 2 : 1}
              status={approved ? "HEALTHY" : "NEEDS_REASSESSMENT"}
              progress={approved ? 75 : 70}
              successCriteria={[
                { id: "sc-1", title: "Automated onboarding workflow implemented", completed: true },
                { id: "sc-2", title: "API integration complete", completed: true },
                { id: "sc-3", title: "Production validation complete", completed: false },
                ...(approved ? [{ id: "sc-4", title: "Enterprise SSO configuration & validation (Added v2)", completed: false }] : [])
              ]}
            />

            {/* Signature Change Impact Analysis Component */}
            {!approved ? (
              <ChangeImpactCard
                onApprove={() => setApproved(true)}
                onReject={() => alert("Outcome recommendation rejected.")}
              />
            ) : (
              <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-5 shadow-lg space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                  <span>Outcome Version 2 Transition Completed</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Enterprise SSO requirement has been integrated into success criteria. Active dependency recorded:
                  <strong className="text-slate-100"> Waiting on customer security owner for configuration.</strong>
                </p>
              </div>
            )}
          </div>

          {/* Right Sidebar: Blockers & Next Actions */}
          <div className="space-y-6">
            {/* Next Best Action Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  Next Best Action
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 font-mono">
                  High Priority
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-100">
                Follow up with customer security owner for required SSO configuration.
              </p>
              <div className="text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded border border-slate-800 leading-relaxed">
                <strong>Why now:</strong> This is currently the primary blocker preventing production validation.
              </div>
            </div>

            {/* Active Blockers & Dependencies */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Active Blockers & Dependencies
              </h3>
              <ul className="space-y-2.5 text-xs">
                <li className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between font-medium text-slate-200">
                    <span className="text-amber-400">● SSO Configuration</span>
                    <span className="text-[10px] text-slate-500">Waiting on Customer</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Customer security team owns the dependency.</p>
                </li>
                <li className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between font-medium text-slate-200">
                    <span className="text-slate-400">○ Production Credentials</span>
                    <span className="text-[10px] text-slate-500">Pending Validation</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Depends on SSO configuration approval.</p>
                </li>
              </ul>
            </div>

            {/* Audit Timeline Quick Reference */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Recent Timeline Events</span>
                <Clock className="h-3.5 w-3.5 text-slate-500" />
              </h3>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="border-l-2 border-amber-400 pl-2.5 py-0.5">
                  <span className="text-[11px] text-slate-400 block font-mono">10m ago</span>
                  <span>Customer requirement added: Enterprise SSO required.</span>
                </li>
                <li className="border-l-2 border-teal-400 pl-2.5 py-0.5">
                  <span className="text-[11px] text-slate-400 block font-mono">25m ago</span>
                  <span>API integration completed and verified.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
