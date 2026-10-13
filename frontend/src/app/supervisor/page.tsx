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
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Calm Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-display text-slate-900">Ask CalmWork</h1>
              <span className="text-slate-300">·</span>
              <span className="text-sm text-slate-600 font-medium">{activeCustomer.customerName}</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Conversational intelligence across requirements, blockers, and delivery state
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 bg-slate-100 border border-slate-200 rounded text-slate-600 flex items-center gap-1.5 font-mono">
              <Lock className="h-3.5 w-3.5 text-slate-500" />
              <span>Privacy Guardrail Active</span>
            </span>
          </div>
        </div>

        {/* Clean Conversational Chat Studio */}
        <AskCalmWorkChat />
      </div>
    </AppShell>
  );
}
