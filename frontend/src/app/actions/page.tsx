"use client";

import React from "react";
import AppShell from "@/components/layout/AppShell";
import { useEngagement } from "@/context/EngagementContext";
import { Zap, ShieldAlert, Sparkles, CheckCircle2, Clock, AlertTriangle, FileText } from "lucide-react";

export default function ActionsPage() {
  const { activeCustomer, nextActionData, loading } = useEngagement();

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-600">
                  <Zap className="h-5 w-5" />
                </div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-700">
                  MOVE Agent Engine
                </span>
              </div>
              <h1 className="text-2xl font-display font-bold text-slate-900">
                Next Best Action & Blocker Resolver
              </h1>
              <p className="text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Execution velocity engine for <strong className="text-slate-900">{activeCustomer.customerName}</strong>. Evaluates active gating criteria, blockers, and work cycle state in real-time.
              </p>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
              {nextActionData ? (
                <span className={`text-xs px-3.5 py-1 rounded-full font-mono font-bold border ${
                  nextActionData.priority_level === "CRITICAL"
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-blue-50 text-blue-700 border-blue-200"
                }`}>
                  Priority: {nextActionData.priority_level}
                </span>
              ) : (
                <span className="text-xs px-3.5 py-1 rounded-full font-mono font-bold bg-slate-50 text-slate-600 border border-slate-200">
                  Evaluating State...
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && !nextActionData && (
          <div className="p-8 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200 animate-pulse">
            MOVE Agent evaluating next best action for {activeCustomer.customerName}...
          </div>
        )}

        {/* 1. Next Best Action Detailed Card (AI Generated Output Only) */}
        {nextActionData && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <h2 className="text-base font-display font-bold text-slate-900">
                  {nextActionData.action_title || "Primary Next Best Action"}
                </h2>
              </div>
              <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                Confidence: {nextActionData.confidence}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
                <span className="text-xs font-mono text-slate-500 uppercase font-bold block">1. Situation</span>
                <p className="text-slate-900 font-bold text-sm leading-relaxed">
                  {nextActionData.situation}
                </p>
              </div>

              <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-200 space-y-1.5">
                <span className="text-xs font-mono text-blue-800 uppercase font-bold block">2. Recommendation</span>
                <p className="text-blue-900 font-bold text-sm leading-relaxed">
                  {nextActionData.recommendation}
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
                <span className="text-xs font-mono text-amber-800 uppercase font-bold block">3. Why Now</span>
                <p className="text-slate-700 leading-relaxed font-medium">
                  {nextActionData.why_now}
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
                <span className="text-xs font-mono text-emerald-800 uppercase font-bold block">4. Expected Impact</span>
                <p className="text-slate-700 leading-relaxed font-medium">
                  {nextActionData.impact}
                </p>
              </div>
            </div>

            {/* Evidence items from AI */}
            {nextActionData.evidence && nextActionData.evidence.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider block mb-1">
                  AI Grounded Evidence
                </span>
                <ul className="space-y-1 text-xs text-slate-600">
                  {nextActionData.evidence.map((ev: string, idx: number) => (
                    <li key={idx} className="flex items-center gap-1.5">
                      <FileText className="h-3 w-3 text-slate-400 shrink-0" />
                      <span>{ev}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 2. Active Blockers & Dependencies Matrix */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-display font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              Active Blockers & Dependencies ({activeCustomer.customerName})
            </h2>
            <span className="text-xs font-mono text-slate-500 font-semibold">
              {nextActionData?.gating_blocker ? "1 Gating Blocker" : "Zero Gating Blockers"}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {nextActionData?.gating_blocker ? (
              <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-900 text-sm">● {nextActionData.gating_blocker}</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-mono font-bold">
                      GATING BLOCKER
                    </span>
                  </div>
                  <p className="text-slate-700 font-medium">Target Work Cycle: {nextActionData.target_work_cycle}</p>
                  <p className="text-xs text-slate-600">
                    Resolution required to maintain progress toward outcome milestones.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="font-semibold text-emerald-900 text-xs">
                    No active blockers detected. Delivery velocity is proceeding normally.
                  </span>
                </div>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold">
                  UNBLOCKED
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
