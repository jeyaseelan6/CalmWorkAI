"use client";

import React, { useState, useEffect } from "react";
import { RefreshCw, Sparkles, AlertTriangle, CheckCircle2, ShieldAlert, ArrowRight, Clock, MessageSquare } from "lucide-react";
import { useEngagement } from "@/context/EngagementContext";

export interface BriefData {
  engagement_id: string;
  customer_name: string;
  brief_date: string;
  what_changed: string[];
  what_matters_today: string;
  outcome_health: string;
  new_risks: string[];
  active_blockers: string[];
  pending_decisions: string[];
  dependencies: string[];
  next_best_action: string;
  items_requiring_manager_approval: number;
  customer_communication_needed: boolean;
  customer_communication_status: string;
  generated_at: string;
}

export default function DailyWorkBriefing() {
  const { activeCustomer } = useEngagement();
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");

  const fetchBrief = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/v1/engagements/${activeCustomer.id}/supervisor/brief`, {
        method: "POST"
      });
      const data = await res.json();
      if (data.success) {
        setBrief(data.data);
        setLastRefreshed(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error("Failed to fetch daily brief:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrief();
  }, [activeCustomer.id]);

  if (!brief) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-3 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/3"></div>
        <div className="h-20 bg-slate-100 rounded"></div>
      </div>
    );
  }

  const isWarning = brief.outcome_health === "NEEDS_REASSESSMENT";

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4 text-xs">
      {/* Briefing Banner & Trigger */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-slate-900 text-white rounded">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display font-bold text-sm text-slate-900">
              Daily Work Brief — {brief.customer_name}
            </h2>
            <p className="text-[11px] text-slate-500 font-mono">
              Proactive Intelligence | Refreshed {lastRefreshed || "Just now"}
            </p>
          </div>
        </div>

        <button
          onClick={fetchBrief}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md font-semibold text-xs transition shadow-2xs disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Work Intelligence</span>
        </button>
      </div>

      {/* 10 Surface Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Column */}
        <div className="space-y-3">
          {/* 1. What Matters Today */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1">
            <span className="font-bold text-[10px] text-slate-500 uppercase tracking-wider block font-mono">
              1. What Matters Today
            </span>
            <p className="font-semibold text-slate-900 text-xs leading-relaxed">{brief.what_matters_today}</p>
          </div>

          {/* 2. What Changed */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1.5">
            <span className="font-bold text-[10px] text-slate-500 uppercase tracking-wider block font-mono">
              2. What Changed
            </span>
            <ul className="space-y-1 text-slate-700">
              {brief.what_changed.map((item, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 3. Outcome Health */}
          <div className={`p-3 rounded-md border flex items-center justify-between ${
            isWarning ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-emerald-50 border-emerald-200 text-emerald-900"
          }`}>
            <div>
              <span className="font-bold text-[10px] uppercase tracking-wider block font-mono opacity-80">
                3. Outcome Health
              </span>
              <span className="font-bold text-xs">{brief.outcome_health}</span>
            </div>
            {isWarning ? <AlertTriangle className="h-5 w-5 text-amber-600" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          </div>

          {/* 4. Active Blockers */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1.5">
            <span className="font-bold text-[10px] text-slate-500 uppercase tracking-wider block font-mono">
              4. Active Blockers ({brief.active_blockers.length})
            </span>
            {brief.active_blockers.length > 0 ? (
              <ul className="space-y-1 text-slate-800 font-medium">
                {brief.active_blockers.map((b, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 text-amber-900 bg-amber-50 p-1.5 rounded border border-amber-200">
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-700 shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500 text-[11px]">No active gating blockers recorded.</p>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-3">
          {/* 5. Next Best Action */}
          <div className="p-3 bg-slate-900 text-white rounded-md space-y-1">
            <span className="font-bold text-[10px] text-slate-400 uppercase tracking-wider block font-mono">
              5. Next Best Action (MOVE)
            </span>
            <p className="font-bold text-xs">{brief.next_best_action}</p>
          </div>

          {/* 6. Pending Decisions & Approvals */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1.5">
            <span className="font-bold text-[10px] text-slate-500 uppercase tracking-wider block font-mono">
              6. Manager Approvals & Pending Decisions
            </span>
            <div className="flex items-center justify-between text-slate-800">
              <span>Items Requiring Signoff:</span>
              <span className="font-mono font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded border border-amber-300">
                {brief.items_requiring_manager_approval} Pending
              </span>
            </div>
          </div>

          {/* 7. New Risks & Dependencies */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1.5">
            <span className="font-bold text-[10px] text-slate-500 uppercase tracking-wider block font-mono">
              7. Risks & Dependencies
            </span>
            <div className="space-y-1 text-slate-700">
              <p><strong>Dependencies:</strong> {brief.dependencies.join(", ")}</p>
              {brief.new_risks.map((r, idx) => (
                <p key={idx} className="text-slate-600">• {r}</p>
              ))}
            </div>
          </div>

          {/* 8. Customer Communication Status */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1 flex items-center justify-between">
            <div>
              <span className="font-bold text-[10px] text-slate-500 uppercase tracking-wider block font-mono">
                8. Customer Communication
              </span>
              <span className="font-semibold text-slate-800">{brief.customer_communication_status}</span>
            </div>
            <MessageSquare className="h-4 w-4 text-slate-500" />
          </div>
        </div>
      </div>
    </div>
  );
}
