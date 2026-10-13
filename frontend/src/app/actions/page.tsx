"use client";

import React from "react";
import AppShell from "@/components/layout/AppShell";
import { useEngagement } from "@/context/EngagementContext";
import { Zap, ShieldAlert, Sparkles, CheckCircle2, Clock, AlertTriangle, FileText } from "lucide-react";

export default function ActionsPage() {
  const { activeCustomer, nextActionData, loading } = useEngagement();

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Calm Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-display text-slate-900">Next Action</h1>
              <span className="text-slate-300">·</span>
              <span className="text-sm text-slate-600 font-medium">{activeCustomer.customerName}</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Execution velocity, gating criteria evaluation, and blocker resolution
            </p>
          </div>

          <div className="flex items-center gap-2">
            {nextActionData && (
              <span className="text-xs px-2.5 py-1 rounded-md font-mono border bg-slate-100 text-slate-700 border-slate-200 font-medium">
                Priority: {nextActionData.priority_level}
              </span>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && !nextActionData && (
          <div className="p-8 text-center text-slate-400 text-xs bg-white rounded-lg border border-slate-200 animate-pulse">
            Evaluating next best action for {activeCustomer.customerName}...
          </div>
        )}

        {/* 1. Next Best Action Detailed Card */}
        {nextActionData && (
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-semibold text-slate-900 font-display">
                {nextActionData.action_title || "Recommended Next Action"}
              </h2>
              <span className="text-xs font-mono text-slate-500">
                Confidence: {nextActionData.confidence}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase font-mono block mb-1">
                  Recommendation
                </span>
                <p className="text-slate-900 font-semibold text-sm leading-snug">
                  {nextActionData.recommendation}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase font-mono block mb-0.5">
                    Situation
                  </span>
                  <p className="text-slate-700 leading-relaxed">
                    {nextActionData.situation}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase font-mono block mb-0.5">
                    Why Now
                  </span>
                  <p className="text-slate-700 leading-relaxed">
                    {nextActionData.why_now}
                  </p>
                </div>
              </div>

              {nextActionData.evidence && nextActionData.evidence.length > 0 && (
                <details className="pt-2 border-t border-slate-100 group">
                  <summary className="text-[11px] font-semibold text-slate-600 cursor-pointer hover:text-slate-900 list-none flex items-center justify-between py-1">
                    <span>Show Grounded Evidence ({nextActionData.evidence.length} items)</span>
                    <span className="text-slate-400 group-open:rotate-180 transition-transform text-xs">▼</span>
                  </summary>
                  <ul className="mt-2 space-y-1 text-slate-600 pl-4 list-disc text-xs">
                    {nextActionData.evidence.map((ev: string, idx: number) => (
                      <li key={idx}>{ev}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </div>
        )}

        {/* 2. Active Blockers Matrix */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-900">
              Active Blockers & Dependencies
            </span>
            <span className="text-xs font-mono text-slate-400">
              {nextActionData?.gating_blocker ? "1 Gating Blocker" : "Zero Gating Blockers"}
            </span>
          </div>

          <div className="text-xs">
            {nextActionData?.gating_blocker ? (
              <div className="p-3 bg-amber-50/70 rounded-md border border-amber-200 space-y-1">
                <span className="font-semibold text-amber-900 block">● {nextActionData.gating_blocker}</span>
                <p className="text-amber-800 text-[11px]">
                  Target Work Cycle: {nextActionData.target_work_cycle} · Resolution required to proceed.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50/60 rounded-md border border-emerald-200 flex items-center gap-2 text-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>No active blockers detected. Delivery velocity is proceeding normally.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
