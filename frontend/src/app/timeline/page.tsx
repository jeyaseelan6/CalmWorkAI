"use client";

import React from "react";
import AppShell from "@/components/layout/AppShell";
import { useEngagement } from "@/context/EngagementContext";
import { Clock, ShieldCheck, AlertTriangle, FileText, CheckCircle } from "lucide-react";

export default function TimelinePage() {
  const { activeCustomer, approvedAcme } = useEngagement();

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-teal-400" />
            <h1 className="text-xl font-bold text-slate-100">Audit Trail Timeline</h1>
          </div>
          <p className="text-xs text-slate-400">
            Immutable evidence trail of requirement changes, AI impact analysis, manager approvals, and verified state shifts for {activeCustomer.customerName}.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
          <ul className="space-y-6 relative border-l-2 border-slate-800 ml-3 pl-6">
            {approvedAcme && (
              <li className="relative">
                <span className="absolute -left-[31px] top-0 h-4 w-4 rounded-full bg-emerald-400 border-4 border-slate-900" />
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-300 uppercase tracking-wider">Outcome Version 2 Activated</span>
                    <span className="text-slate-500 font-mono">Just Now</span>
                  </div>
                  <p className="text-xs text-slate-200">
                    Manager (David Miller) approved transition to Outcome Version 2. Enterprise SSO checklist criteria added to Definition of Done.
                  </p>
                </div>
              </li>
            )}

            <li className="relative">
              <span className="absolute -left-[31px] top-0 h-4 w-4 rounded-full bg-amber-400 border-4 border-slate-900" />
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-400 uppercase tracking-wider">Customer Requirement Added</span>
                  <span className="text-slate-500 font-mono">10m ago</span>
                </div>
                <p className="text-xs text-slate-200">
                  Customer IT security team input received: "Enterprise SSO configuration & validation is mandatory before production cutover."
                </p>
              </div>
            </li>

            <li className="relative">
              <span className="absolute -left-[31px] top-0 h-4 w-4 rounded-full bg-teal-400 border-4 border-slate-900" />
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-teal-400 uppercase tracking-wider">Outcome Version 1 Established</span>
                  <span className="text-slate-500 font-mono">2 Days Ago</span>
                </div>
                <p className="text-xs text-slate-200">
                  Initial outcome statement established: "Reduce manual onboarding time from 30 min to under 5 min."
                </p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
