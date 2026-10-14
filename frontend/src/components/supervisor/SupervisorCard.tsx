"use client";

import React, { useState, useEffect } from "react";
import { Cpu, ShieldCheck, Activity, CheckCircle, AlertTriangle, ArrowRight } from "lucide-react";
import { formatISTTime } from "@/utils/date";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSupervisorSummary = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/engagements/${engagementId}/supervisor/summary`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setSummary(json.data);
          } else {
            setError(json.message || "Failed to retrieve supervisor summary.");
            setSummary(null);
          }
        } else {
          const errJson = await res.json().catch(() => ({}));
          setError(errJson.detail || "Supervisor coordinator service unavailable.");
          setSummary(null);
        }
      } catch (e: any) {
        setError(e.message || "Network error querying Supervisor coordinator.");
        setSummary(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSupervisorSummary();
  }, [engagementId, customerName]);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-4.5 w-4.5 text-slate-700" />
          <h2 className="text-sm font-display font-bold text-slate-900">
            Plan Agent — Central Orchestration & Telemetry
          </h2>
        </div>
      </div>

      {/* 4 Agent Status Grid */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {loading && !summary && (
        <div className="p-6 text-center text-slate-400 text-xs animate-pulse">
          Loading live multi-agent supervisor telemetry...
        </div>
      )}

      {summary && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {summary.agents.map((ag) => (
          <div
            key={ag.agent_name}
            className={`p-3 rounded-md border text-xs space-y-1 ${
              ag.status === "RECOMMENDATION_PENDING"
                ? "bg-amber-50/70 border-amber-200 text-amber-900"
                : "bg-slate-50 border-slate-200 text-slate-800"
            }`}
          >
            <div className="flex items-center justify-between font-mono font-bold">
              <span className="text-slate-900">{ag.agent_name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                ag.status === "RECOMMENDATION_PENDING" ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-emerald-100 text-emerald-800 border border-emerald-200"
              }`}>
                {ag.status}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">{ag.role_description}</p>
          </div>
        ))}
      </div>

      {/* Orchestration Footer Info */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-slate-400" />
          <span>Central State: <strong className="text-slate-900 font-semibold">{summary?.current_work_cycle}</strong></span>
        </div>
        <span className="font-mono text-[11px] text-slate-500">
          Orchestrated: {summary?.orchestrated_at ? formatISTTime(summary.orchestrated_at, true) : "Just now"}
        </span>
      </div>
      </>
      )}
    </div>
  );
}
