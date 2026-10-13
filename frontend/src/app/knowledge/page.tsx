"use client";

import React from "react";
import AppShell from "@/components/layout/AppShell";
import KnowledgePanel from "@/components/knowledge/KnowledgePanel";
import { useEngagement } from "@/context/EngagementContext";

export default function KnowledgePage() {
  const { activeCustomer } = useEngagement();

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Calm Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-display text-slate-900">Knowledge</h1>
              <span className="text-slate-300">·</span>
              <span className="text-sm text-slate-600 font-medium">{activeCustomer.customerName}</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Grounded semantic search and verified citations from customer architecture specs
            </p>
          </div>
        </div>

        {/* Interactive RAG Panel */}
        <KnowledgePanel
          engagementId={activeCustomer.id}
          customerName={activeCustomer.customerName}
        />
      </div>
    </AppShell>
  );
}

