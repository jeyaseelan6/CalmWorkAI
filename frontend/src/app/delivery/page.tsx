"use client";

import React from "react";
import AppShell from "@/components/layout/AppShell";
import CustomerUpdatePanel from "@/components/delivery/CustomerUpdatePanel";
import { useEngagement } from "@/context/EngagementContext";
import { CheckSquare, Send, Sparkles, MessageSquare, Mail, Copy, Lock } from "lucide-react";

export default function DeliveryPage() {
  const { activeCustomer } = useEngagement();

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-64 bg-gradient-to-l from-teal-500/10 via-transparent to-transparent pointer-events-none" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400">
                  <CheckSquare className="h-5 w-5" />
                </div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-teal-400">
                  DELIVER Agent Engine
                </span>
              </div>
              <h1 className="text-2xl font-bold text-slate-100">
                Executive Customer Update Studio
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Automated customer-facing communication generator for <strong className="text-slate-200">{activeCustomer.customerName}</strong>. Transforms internal engineering progress, outcome versions, and active blockers into polished executive updates.
              </p>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
                <Lock className="h-3.5 w-3.5 text-teal-400" />
                <span className="text-slate-300">Privacy Guardrail Active</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                Tone: Professional Executive / Technical
              </span>
            </div>
          </div>
        </div>

        {/* Interactive Customer Update Studio Panel */}
        <CustomerUpdatePanel
          engagementId={activeCustomer.id}
          customerName={activeCustomer.customerName}
          engagementName={activeCustomer.engagementName}
        />

        {/* Export & Channel Capabilities Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Mail className="h-4 w-4 text-teal-400" />
                <span>Executive Email Briefing</span>
              </div>
              <span className="text-[10px] bg-teal-500/10 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded font-mono">
                HTML / Markdown
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              High-level progress summaries tailored for VP and C-level stakeholders, emphasizing value delivered and outcome risk control.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <MessageSquare className="h-4 w-4 text-teal-400" />
                <span>Slack / Teams Channel Update</span>
              </div>
              <span className="text-[10px] bg-teal-500/10 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded font-mono">
                Concise Bulleted
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Rapid daily standup updates highlighting current step, immediate blocker, and clear action items for customer engineering leads.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Send className="h-4 w-4 text-teal-400" />
                <span>Technical Implementation Log</span>
              </div>
              <span className="text-[10px] bg-teal-500/10 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded font-mono">
                Detailed Log
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Comprehensive release notes with API endpoint changes, schema diffs, and verification metrics for engineering teams.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
