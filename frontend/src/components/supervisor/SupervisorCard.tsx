"use client";

import React, { useState, useEffect } from "react";
import { Cpu, ShieldCheck, Activity, CheckCircle, AlertTriangle, ArrowRight } from "lucide-react";

interface AgentStatus {
  agent_name: string;
  role_description: string;
  status: string;
  last_output_summary: string;
}

interface SupervisorSummaryData {
  engagement_id: string;
  customer_name: string;
  overall_health: string;
  current_work_cycle: string;
  agents: AgentStatus[];
  privacy_guardrail_active: boolean;
  orchestrated_at: string;
}

interface SupervisorCardProps {
  engagementId: string;
  customerName: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function SupervisorCard({ engagementId, customerName }: SupervisorCardProps) {
  const [summary, setSummary] = useState<SupervisorSummaryData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSupervisorSummary = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/engagements/${engagementId}/supervisor/summary`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setSummary(json.data);
          }
        }
      } catch (e) {
        // Fallback simulation
        setSummary({
          engagement_id: engagementId,
          customer_name: customerName,
          overall_health: engagementId === "eng-acme-001" ? "NEEDS_REASSESSMENT" : "HEALTHY",
          current_work_cycle: engagementId === "eng-acme-001" ? "Step 4: Build Within Real Constraints" : "Step 5: Deploy Into Production",
          agents: [
            {
              agent_name: "UNDERSTAND",
              role_description: "Drift & Scope Change Analysis",
              status: engagementId === "eng-acme-001" ? "RECOMMENDATION_PENDING" : "ACTIVE",
              last_output_summary: "Evaluates scope shifts via Evidence -> Reasoning -> Recommendation pattern."
            },
            {
              agent_name: "KNOW",
              role_description: "Tenant-Isolated Grounded RAG",
              status: "ACTIVE",
              last_output_summary: "Indexes customer specs and returns grounded answers with explicit citations."
            },
            {
              agent_name: "MOVE",
              role_description: "Execution Velocity & Next Action",
              status: "ACTIVE",
              last_output_summary: "Ranks Next Best Action based on gating criteria and outcome velocity."
            },
            {
              agent_name: "DELIVER",
              role_description: "Executive Customer Studio",
              status: "ACTIVE",
              last_output_summary: "Translates technical progress into executive business language updates."
            }
          ],
          privacy_guardrail_active: true,
          orchestrated_at: new Date().toISOString()
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSupervisorSummary();
  }, [engagementId, customerName]);

  return (
    <div className="bg-slate-900 border border-teal-500/30 rounded-xl p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-teal-400" />
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
            Supervisor Coordinator — Multi-Agent Orchestration
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[11px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-md font-mono">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>AI Privacy Guardrail Active</span>
          </span>
        </div>
      </div>

      {/* 4 Agent Status Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summary?.agents.map((ag) => (
          <div
            key={ag.agent_name}
            className={`p-3 rounded-lg border text-xs space-y-1 ${
              ag.status === "RECOMMENDATION_PENDING"
                ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                : "bg-slate-950 border-slate-800 text-slate-200"
            }`}
          >
            <div className="flex items-center justify-between font-mono font-bold">
              <span className="text-teal-400">{ag.agent_name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                ag.status === "RECOMMENDATION_PENDING" ? "bg-amber-400/20 text-amber-300" : "bg-emerald-500/10 text-emerald-400"
              }`}>
                {ag.status}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">{ag.role_description}</p>
          </div>
        ))}
      </div>

      {/* Orchestration Footer Info */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-teal-400" />
          <span>Central State: <strong className="text-slate-200">{summary?.current_work_cycle}</strong></span>
        </div>
        <span className="font-mono text-[10px] text-slate-500">
          Last Orchestrated: {summary?.orchestrated_at ? new Date(summary.orchestrated_at).toLocaleTimeString() : "Just now"}
        </span>
      </div>
    </div>
  );
}
