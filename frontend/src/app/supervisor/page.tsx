"use client";

import React from "react";
import AppShell from "@/components/layout/AppShell";
import SupervisorCard from "@/components/supervisor/SupervisorCard";
import { useEngagement } from "@/context/EngagementContext";
import { LayoutDashboard, ShieldCheck, Activity, Cpu, Lock, Radio } from "lucide-react";

export default function SupervisorPage() {
  const { activeCustomer } = useEngagement();

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-64 bg-gradient-to-l from-amber-500/10 via-transparent to-transparent pointer-events-none" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <LayoutDashboard className="h-5 w-5" />
                </div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                  SUPERVISOR Orchestrator & Governance
                </span>
              </div>
              <h1 className="text-2xl font-bold text-slate-100">
                Multi-Agent Control Center
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Centralized governance & real-time orchestration for <strong className="text-slate-200">{activeCustomer.customerName}</strong>. Monitors event telemetry, agent response latencies, privacy guardrail checks, and cross-agent event bus communication.
              </p>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-slate-300">Manager Governance Active</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                Event Bus: Active (0 Dropped Events)
              </span>
            </div>
          </div>
        </div>

        {/* 360-Degree Supervisor Card */}
        <SupervisorCard
          engagementId={activeCustomer.id}
          customerName={activeCustomer.customerName}
        />

        {/* Multi-Agent System Metrics & Health Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>UNDERSTAND Latency</span>
              <Activity className="h-3.5 w-3.5 text-teal-400" />
            </div>
            <div className="text-lg font-bold text-slate-100 font-mono">142 ms</div>
            <span className="text-[10px] text-emerald-400 block font-mono">P99 Healthy</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>KNOW RAG Recall</span>
              <Cpu className="h-3.5 w-3.5 text-teal-400" />
            </div>
            <div className="text-lg font-bold text-slate-100 font-mono">98.4%</div>
            <span className="text-[10px] text-emerald-400 block font-mono">Zero Hallucination</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>MOVE Action Precision</span>
              <Radio className="h-3.5 w-3.5 text-teal-400" />
            </div>
            <div className="text-lg font-bold text-slate-100 font-mono">100%</div>
            <span className="text-[10px] text-emerald-400 block font-mono">Blocker Target</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Privacy Guardrail</span>
              <Lock className="h-3.5 w-3.5 text-teal-400" />
            </div>
            <div className="text-lg font-bold text-emerald-400 font-mono">ENFORCED</div>
            <span className="text-[10px] text-slate-400 block font-mono">Zero PII Leakage</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
