"use client";

import React from "react";
import AppShell from "@/components/layout/AppShell";
import KnowledgePanel from "@/components/knowledge/KnowledgePanel";
import { useEngagement } from "@/context/EngagementContext";
import { BookOpen, Database, ShieldCheck, FileCode, CheckCircle2, Lock } from "lucide-react";

export default function KnowledgePage() {
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
                  <BookOpen className="h-5 w-5" />
                </div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-teal-400">
                  KNOW Agent Engine
                </span>
              </div>
              <h1 className="text-2xl font-bold text-slate-100">
                Grounded RAG Knowledge Base
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Zero-hallucination semantic search & RAG intelligence for <strong className="text-slate-200">{activeCustomer.customerName}</strong>. Queries customer documentation, technical architecture specs, and past execution logs with explicit citation backing.
              </p>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
                <Lock className="h-3.5 w-3.5 text-teal-400" />
                <span className="text-slate-300">Privacy Guardrail Active</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                Vector Index: Hybrid Dense + Sparse
              </span>
            </div>
          </div>
        </div>

        {/* Interactive RAG Panel */}
        <KnowledgePanel
          engagementId={activeCustomer.id}
          customerName={activeCustomer.customerName}
        />

        {/* Knowledge Sources & Index Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <FileCode className="h-4 w-4 text-teal-400" />
                <span>Architecture Specs</span>
              </div>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono">
                Indexed
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Customer architecture diagrams, API schemas, and deployment topology documentation.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <ShieldCheck className="h-4 w-4 text-teal-400" />
                <span>Security Compliance</span>
              </div>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono">
                Indexed
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Enterprise SSO standards, OAuth 2.0 / SAML guidelines, and security policy specs.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Database className="h-4 w-4 text-teal-400" />
                <span>Execution Logs</span>
              </div>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono">
                Live Sync
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Historical FDE work cycle decisions, change approval logs, and past delivery notes.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
