"use client";

import React from "react";
import AppShell from "@/components/layout/AppShell";
import { useEngagement } from "@/context/EngagementContext";
import { CheckSquare, ArrowRight, Building2, ShieldCheck, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function EngagementsListPage() {
  const { customers, activeCustomer, setActiveCustomer, approvedAcme } = useEngagement();

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-100">Customer Engagements</h1>
            <p className="text-xs text-slate-400">All active customer delivery workspaces</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {customers.map((cust) => {
            const isAcme = cust.id === "eng-acme-001";
            const currentStatus = isAcme && approvedAcme ? "HEALTHY" : cust.status;
            return (
              <div key={cust.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-teal-400" />
                      <h2 className="text-base font-bold text-slate-100">{cust.customerName}</h2>
                    </div>
                    <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border ${
                      currentStatus === "HEALTHY" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                    }`}>
                      {currentStatus}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-teal-300">{cust.engagementName}</p>
                  <p className="text-xs text-slate-400">
                    {isAcme
                      ? "Automating onboarding workflow and integrating SAML SSO API endpoints."
                      : "Migrating 50M records to GCP Cloud SQL with zero data loss."}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-mono">Outcome Version: {isAcme && approvedAcme ? 2 : 1}</span>
                  <Link
                    href={`/engagements/${cust.id}`}
                    onClick={() => setActiveCustomer(cust)}
                    className="px-3 py-1.5 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                  >
                    <span>Open Workspace</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
