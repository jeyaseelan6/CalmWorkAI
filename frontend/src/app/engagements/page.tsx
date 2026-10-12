"use client";

import React, { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { useEngagement } from "@/context/EngagementContext";
import { useAuth } from "@/context/AuthContext";
import { 
  Building2, 
  ArrowRight, 
  Plus, 
  X, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Layers,
  Target
} from "lucide-react";
import Link from "next/link";

export default function EngagementsListPage() {
  const { customers, activeCustomer, setActiveCustomer, approvedAcme, createEngagement } = useEngagement();
  const { isManager, isFDE } = useAuth();

  // Create Engagement Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [engagementName, setEngagementName] = useState("");
  const [description, setDescription] = useState("");
  const [outcomeStatement, setOutcomeStatement] = useState("");
  const [criteria1, setCriteria1] = useState("Discovery & baseline architecture completed");
  const [criteria2, setCriteria2] = useState("Core integration pipeline operational");
  const [criteria3, setCriteria3] = useState("Production verification and DoD signoff");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !engagementName.trim()) {
      setErrorMsg("Customer name and initiative title are required.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const res = await createEngagement({
      customerName: customerName.trim(),
      engagementName: engagementName.trim(),
      description: description.trim(),
      initialOutcomeStatement: outcomeStatement.trim(),
      successCriteria: [criteria1, criteria2, criteria3].filter((c) => c.trim().length > 0)
    });

    setSubmitting(false);

    if (res.success) {
      setSuccessMsg(`Engagement for ${customerName} initialized and synced!`);
      setTimeout(() => {
        setShowCreateModal(false);
        setSuccessMsg(null);
        setCustomerName("");
        setEngagementName("");
        setDescription("");
        setOutcomeStatement("");
      }, 1200);
    } else {
      setErrorMsg(res.error || "Failed to create engagement.");
    }
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-slate-700" />
              <h1 className="text-xl font-bold font-display text-slate-900">Customer Engagements</h1>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Multi-tenant customer delivery workspaces & active outcome contracts
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isManager ? (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-md transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Create New Engagement</span>
              </button>
            ) : (
              <span className="text-xs px-2.5 py-1 bg-slate-100 border border-slate-200 rounded font-mono text-slate-600 flex items-center gap-1.5 shadow-2xs">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                <span>FDE View (Auto-synced from Manager)</span>
              </span>
            )}
          </div>
        </div>

        {/* Engagements Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {customers.map((cust) => {
            const isAcme = cust.id === "eng-acme-001";
            const currentStatus = isAcme && approvedAcme ? "HEALTHY" : cust.status;
            const isSelected = cust.id === activeCustomer.id;

            return (
              <div 
                key={cust.id} 
                className={`bg-white border rounded-lg p-5 shadow-2xs space-y-4 flex flex-col justify-between transition-all ${
                  isSelected ? "border-blue-400 ring-1 ring-blue-400/20" : "border-slate-200"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                        {cust.customerName.charAt(0)}
                      </div>
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

                  <div>
                    <p className="text-xs font-semibold text-slate-800">{cust.engagementName}</p>
                    <p className="text-xs text-slate-600 leading-relaxed mt-1">
                      {cust.description || 
                        (isAcme
                          ? "Automating onboarding workflow and integrating SAML SSO API endpoints."
                          : "Migrating 50M records to GCP Cloud SQL with zero data loss.")
                      }
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-mono font-medium">
                    DoD Outcome v{cust.version || (isAcme && approvedAcme ? 2 : 1)}
                  </span>
                  <Link
                    href="/"
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

      {/* CREATE NEW ENGAGEMENT MODAL (MANAGER ONLY) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-blue-50 text-blue-600">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-display text-slate-900">Create New Customer Engagement</h3>
                  <p className="text-[11px] text-slate-500">Manager Authority: Immediately syncs to FDE cockpit</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Stark Industries"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Engagement Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Telemetry Migration"
                    value={engagementName}
                    onChange={(e) => setEngagementName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Scope & Background Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Overview of the initiative, constraints, or current technical bottlenecks..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Primary Outcome Statement (DoD v1 Goal)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cut manual deployment time from 45m to <5m with zero downtime."
                  value={outcomeStatement}
                  onChange={(e) => setOutcomeStatement(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-blue-600" />
                  <span>Initial Definition of Done (Success Criteria)</span>
                </label>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={criteria1}
                    onChange={(e) => setCriteria1(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 transition"
                  />
                  <input
                    type="text"
                    value={criteria2}
                    onChange={(e) => setCriteria2(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 transition"
                  />
                  <input
                    type="text"
                    value={criteria3}
                    onChange={(e) => setCriteria3(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-md transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-md transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <span>Initializing Workspace...</span>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Create & Sync to FDE</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
