"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEngagement } from "@/context/EngagementContext";
import { useAuth } from "@/context/AuthContext";
import AppShell from "@/components/layout/AppShell";
import {
  Building2,
  Plus,
  ArrowRight,
  ShieldCheck,
  Compass,
  AlertTriangle,
  CheckCircle2,
  Search,
  Sparkles
} from "lucide-react";
import CreateEngagementModal from "@/components/engagement/CreateEngagementModal";

export default function EngagementsIndexPage() {
  const router = useRouter();
  const { customers, activeCustomer, switchEngagement } = useEngagement();
  const { isManager } = useAuth();
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const filtered = customers.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.customerName.toLowerCase().includes(q) || c.engagementName.toLowerCase().includes(q);
  });

  const handleSelectEngagement = (cust: typeof customers[0], tab = "myday") => {
    switchEngagement(cust);
    router.push(`/engagements/${cust.id}?tab=${tab}`);
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900">My Engagements</h1>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                {customers.length} Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Portfolio overview of customer workspaces, milestone delivery health, and specialist intelligence
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isManager && (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="px-3 py-2 min-h-[40px] bg-slate-900 hover:bg-slate-800 text-white rounded-md font-semibold text-xs transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>New Engagement</span>
              </button>
            )}
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter customer engagements..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 min-h-[40px] border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 shadow-2xs placeholder-slate-400"
            />
          </div>
          <span className="text-xs font-mono text-slate-500 hidden sm:inline">
            Showing {filtered.length} of {customers.length}
          </span>
        </div>

        {/* Engagement Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((cust) => {
            const isSelected = cust.id === activeCustomer.id;
            const isHealthy = cust.status === "HEALTHY";

            return (
              <div
                key={cust.id}
                className={`bg-white border rounded-xl p-5 shadow-2xs transition-all flex flex-col justify-between space-y-4 hover:border-slate-400 ${
                  isSelected ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-2 bg-slate-100 rounded-lg text-slate-800 shrink-0">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="truncate">
                        <h2 className="font-display font-bold text-sm text-slate-900 truncate">
                          {cust.customerName}
                        </h2>
                        <p className="text-xs text-slate-600 truncate">{cust.engagementName}</p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0 ${
                        isHealthy
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-amber-50 text-amber-900 border-amber-200"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${isHealthy ? "bg-emerald-500" : "bg-amber-500"}`} />
                      <span>{isHealthy ? "Healthy" : "Needs Review"}</span>
                    </span>
                  </div>

                  {cust.description && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {cust.description}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                    {isSelected && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-900 font-bold rounded">
                        Active Workspace
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSelectEngagement(cust, "changes")}
                      className="px-2.5 py-1.5 min-h-[36px] bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-slate-700 text-xs font-medium transition cursor-pointer"
                    >
                      Scope &amp; Risks
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectEngagement(cust, "myday")}
                      className="px-3 py-1.5 min-h-[36px] bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                    >
                      <span>Open Workspace</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="p-8 text-center bg-white border border-slate-200 rounded-xl space-y-2">
            <Building2 className="h-8 w-8 text-slate-400 mx-auto" />
            <h3 className="font-semibold text-slate-800 text-sm">No engagements match your filter</h3>
            <p className="text-xs text-slate-500">Try a different customer name or clear your search.</p>
          </div>
        )}

        {/* Manager Create Modal */}
        <CreateEngagementModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
        />
      </div>
    </AppShell>
  );
}
