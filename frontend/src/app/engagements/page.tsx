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
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-slate-700" />
              <h1 className="text-xl font-bold font-display text-slate-900">Customer Engagements</h1>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">All active customer delivery workspaces and shared work states</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {customers.map((cust) => {
            const isAcme = cust.id === "eng-acme-001";
            const currentStatus = isAcme && approvedAcme ? "HEALTHY" : cust.status;
            return (
              <div key={cust.id} className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-slate-700" />
                      <h2 className="text-base font-bold text-slate-900 font-display">{cust.customerName}</h2>
                    </div>
                    <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded border ${
                      currentStatus === "HEALTHY" 
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                        : "bg-amber-50 text-amber-800 border-amber-200"
                    }`}>
                      {currentStatus}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-800">{cust.engagementName}</p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {isAcme
                      ? "Automating onboarding workflow and integrating SAML SSO API endpoints."
                      : "Migrating 50M records to GCP Cloud SQL with zero data loss."}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-mono font-medium">Outcome Version: {isAcme && approvedAcme ? 2 : 1}</span>
                  <Link
                    href={`/`}
                    onClick={() => setActiveCustomer(cust)}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs"
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
