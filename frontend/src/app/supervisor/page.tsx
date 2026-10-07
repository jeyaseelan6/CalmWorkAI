"use client";

import React from "react";
import AppShell from "@/components/layout/AppShell";
import AskCalmWorkChat from "@/components/supervisor/AskCalmWorkChat";
import SupervisorCard from "@/components/supervisor/SupervisorCard";
import { useEngagement } from "@/context/EngagementContext";
import { LayoutDashboard, ShieldCheck, Activity, Cpu, Lock, Radio, Sparkles } from "lucide-react";

export default function SupervisorPage() {
  const { activeCustomer } = useEngagement();

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Title Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-slate-900 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <h1 className="font-display text-xl font-bold text-slate-900 tracking-tight">Ask CalmWork Studio</h1>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Universal Conversational Front Door & Specialist Orchestrator for {activeCustomer.customerName}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 bg-white border border-slate-200 rounded font-mono font-semibold text-slate-700 flex items-center gap-1.5 shadow-2xs">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Supervisor Active</span>
            </span>
          </div>
        </div>

        {/* Universal Conversational Chat Studio */}
        <AskCalmWorkChat />

        {/* 360-Degree Supervisor Card */}
        <SupervisorCard
          engagementId={activeCustomer.id}
          customerName={activeCustomer.customerName}
        />

        {/* Multi-Agent System Metrics & Health Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-1 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 font-medium">
              <span>UNDERSTAND Latency</span>
              <Activity className="h-3.5 w-3.5 text-slate-700" />
            </div>
            <div className="text-lg font-bold text-slate-900 font-mono">142 ms</div>
            <span className="text-[10px] text-emerald-600 block font-mono font-bold">P99 Healthy</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-1 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 font-medium">
              <span>KNOW RAG Recall</span>
              <Cpu className="h-3.5 w-3.5 text-slate-700" />
            </div>
            <div className="text-lg font-bold text-slate-900 font-mono">98.4%</div>
            <span className="text-[10px] text-emerald-600 block font-mono font-bold">Zero Hallucination</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-1 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 font-medium">
              <span>MOVE Action Precision</span>
              <Radio className="h-3.5 w-3.5 text-slate-700" />
            </div>
            <div className="text-lg font-bold text-slate-900 font-mono">100%</div>
            <span className="text-[10px] text-emerald-600 block font-mono font-bold">Blocker Target</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-1 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 font-medium">
              <span>Privacy Guardrail</span>
              <Lock className="h-3.5 w-3.5 text-slate-700" />
            </div>
            <div className="text-lg font-bold text-emerald-600 font-mono">ENFORCED</div>
            <span className="text-[10px] text-slate-500 block font-mono font-bold">Zero PII Leakage</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
