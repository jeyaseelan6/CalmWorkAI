"use client";

import React, { useState, useEffect } from "react";
import AppShell from "@/components/layout/AppShell";
import { useEngagement } from "@/context/EngagementContext";
import { useAuth } from "@/context/AuthContext";
import {
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  XCircle,
  Lock,
  Mail,
  Target,
  Sparkles,
  RefreshCw,
  Clock,
  Check,
  X,
  Building2,
  FileText
} from "lucide-react";
import { formatISTDateTime } from "@/utils/date";

export default function ApprovalsPage() {
  const {
    pendingApprovals,
    pendingApprovalsCount,
    fetchPendingApprovals,
    respondToApproval,
    customers,
    activeCustomer
  } = useEngagement();
  const { isManager, isFDE, user, role } = useAuth();

  const [selectedEngagementFilter, setSelectedEngagementFilter] = useState<string>("ALL");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("ALL");
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [alertNotification, setAlertNotification] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const handleAction = async (appr: any, action: "APPROVE" | "REJECT") => {
    setSubmittingId(appr.id);
    try {
      const decisionNote =
        action === "APPROVE"
          ? `Authorized by Manager (${user?.name || "David Miller"})`
          : `Rejected by Manager (${user?.name || "David Miller"})`;

      const success = await respondToApproval(appr.id, action, decisionNote);
      if (success) {
        setAlertNotification(
          action === "APPROVE"
            ? `Successfully authorized '${appr.recommendation}' for ${appr.customer_name}.`
            : `Rejected approval request for ${appr.customer_name}.`
        );
      }
    } finally {
      setSubmittingId(null);
    }
  };

  const filteredApprovals = pendingApprovals.filter((appr) => {
    if (selectedEngagementFilter !== "ALL" && appr.engagement_id !== selectedEngagementFilter) {
      return false;
    }
    if (selectedTypeFilter !== "ALL" && appr.type !== selectedTypeFilter) {
      return false;
    }
    return true;
  });

  const customerUpdateCount = pendingApprovals.filter((a) => a.type === "CUSTOMER_UPDATE").length;
  const outcomeChangeCount = pendingApprovals.filter((a) => a.type === "OUTCOME_CHANGE").length;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Calm Governance Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold font-display text-slate-900">Approvals Queue</h1>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase ${
                role === "MANAGER"
                  ? "bg-purple-100 text-purple-800 border border-purple-200"
                  : "bg-blue-100 text-blue-800 border border-blue-200"
              }`}>
                {role === "MANAGER" ? "Manager Governance" : "Engineer Audit"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Review and authorize gating decisions, customer updates, and outcome scope progressions
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <span className={`text-xs px-3 py-1 rounded-md font-mono border font-semibold ${
              pendingApprovalsCount > 0
                ? "bg-amber-50 text-amber-800 border-amber-300"
                : "bg-emerald-50 text-emerald-800 border-emerald-200"
            }`}>
              {pendingApprovalsCount > 0 ? `${pendingApprovalsCount} Pending Review` : "All Clear"}
            </span>

            <button
              onClick={() => fetchPendingApprovals()}
              className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition cursor-pointer"
              title="Refresh Approvals"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
          {/* Type Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setSelectedTypeFilter("ALL")}
              className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                selectedTypeFilter === "ALL"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              All Types ({pendingApprovals.length})
            </button>
            <button
              onClick={() => setSelectedTypeFilter("CUSTOMER_UPDATE")}
              className={`px-2.5 py-1 rounded font-medium transition cursor-pointer flex items-center gap-1.5 ${
                selectedTypeFilter === "CUSTOMER_UPDATE"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              <Mail className="h-3 w-3 text-indigo-500" />
              <span>Customer Updates ({customerUpdateCount})</span>
            </button>
            <button
              onClick={() => setSelectedTypeFilter("OUTCOME_CHANGE")}
              className={`px-2.5 py-1 rounded font-medium transition cursor-pointer flex items-center gap-1.5 ${
                selectedTypeFilter === "OUTCOME_CHANGE"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              <Target className="h-3 w-3 text-amber-500" />
              <span>Scope Changes ({outcomeChangeCount})</span>
            </button>
          </div>

          {/* Engagement Scope Filter */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-mono text-slate-400">Scope:</span>
            <select
              value={selectedEngagementFilter}
              onChange={(e) => setSelectedEngagementFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-slate-400"
            >
              <option value="ALL">All Engagements ({customers.length})</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customerName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Approvals List */}
        <div className="space-y-4">
          {filteredApprovals.length > 0 ? (
            filteredApprovals.map((item) => {
              const isCustomerUpdate = item.type === "CUSTOMER_UPDATE";
              const isSubmitting = submittingId === item.id;

              return (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-4 transition hover:border-slate-300"
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-sm font-bold font-display text-slate-900">
                        {item.customer_name}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-xs text-slate-500 font-medium">
                        {item.engagement_name || "Workspace"}
                      </span>

                      {/* Approval Category Badge */}
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                          isCustomerUpdate
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : "bg-amber-50 text-amber-800 border-amber-200"
                        }`}
                      >
                        {isCustomerUpdate ? "Customer Update Authorization" : "Scope & Outcome Goals Upgrade"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                      <span>Requested by {item.requested_by}</span>
                      <span>·</span>
                      <span>{formatISTDateTime(item.created_at)}</span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="space-y-3.5 text-xs">
                    {/* 1. Recommended Action */}
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        1. Action Awaiting Authorization
                      </span>
                      <p className="text-slate-900 font-bold text-sm sm:text-base leading-snug">
                        {item.recommendation}
                      </p>
                    </div>

                    {/* 2. Why & Impact */}
                    <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-lg space-y-1.5">
                      <div className="text-slate-700 leading-relaxed">
                        <strong className="text-slate-900 font-semibold font-mono text-[11px]">Why Now: </strong>
                        {item.why}
                      </div>
                      <div className="text-slate-600 pt-1 border-t border-slate-200/60 leading-relaxed">
                        <strong className="text-slate-900 font-semibold font-mono text-[11px]">Impact: </strong>
                        {item.impact}
                      </div>
                    </div>

                    {/* 3. Evidence Accordion */}
                    {item.evidence && item.evidence.length > 0 && (
                      <details className="group">
                        <summary className="text-[11px] font-mono font-semibold text-slate-500 hover:text-slate-900 cursor-pointer list-none flex items-center justify-between py-1 transition">
                          <span>Verified Evidence &amp; AI Safety Audit ({item.evidence.length} items)</span>
                          <span className="text-slate-400 group-open:rotate-180 transition-transform text-xs">
                            ▼
                          </span>
                        </summary>
                        <ul className="mt-2 space-y-1 text-slate-600 pl-4 list-disc text-xs font-mono">
                          {item.evidence.map((ev: string, evIdx: number) => (
                            <li key={evIdx}>{ev}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>

                  {/* Actions / Decision Bar */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-slate-400">
                      Target ID: <code className="text-slate-600">{item.id}</code>
                    </span>

                    {role === "MANAGER" ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleAction(item, "REJECT")}
                          disabled={isSubmitting}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAction(item, "APPROVE")}
                          disabled={isSubmitting}
                          className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-md text-xs transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                          <span>{isSubmitting ? "Authorizing..." : "Authorize Release"}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                        <Lock className="h-3 w-3 text-slate-400" />
                        <span>Manager authority required to authorize release</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
              <CheckCircle className="h-9 w-9 text-emerald-600 mx-auto" />
              <h2 className="text-sm font-bold font-display text-slate-900">All Approvals Up to Date</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No pending customer update authorizations or scope changes matching the current filter.
              </p>
            </div>
          )}
        </div>

        {/* Alert Notification Toast */}
        {alertNotification && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 border border-emerald-500/60 text-white rounded-xl shadow-2xl text-xs font-mono animate-fadeIn">
            <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{alertNotification}</span>
            <button
              onClick={() => setAlertNotification(null)}
              className="ml-2 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
