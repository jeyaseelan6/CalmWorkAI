"use client";

import React, { useState, useEffect } from "react";
import { RefreshCw, Sparkles, AlertTriangle, CheckCircle2, ShieldAlert, ArrowRight, Clock, MessageSquare, BookOpen, ShieldCheck, ChevronRight, X, Sun } from "lucide-react";
import { useEngagement } from "@/context/EngagementContext";
import Link from "next/link";
import { getNowISTTime } from "@/utils/date";
import AgentProgressStream, { AgentStreamEvent } from "./AgentProgressStream";

import { API_BASE } from "@/utils/api";

export interface WhatChangedItem {
  summary: string;
  category: string;
  date_recorded: string;
  timeline_ref?: string;
}

export interface BlockerItem {
  title?: string;
  blocker?: string;
  severity?: string;
  owner_role?: string;
  unblock_path?: string;
  dependency_type?: string;
  evidence_snippet?: string;
  impact_description?: string;
}

export interface ProposedWorkItem {
  id: string;
  title: string;
  sequence_order: number;
  why_it_matters: string;
  dependencies: string[];
  blockers: string[];
  decisions_or_approvals_required: string[];
  status: string;
  due_date?: string;
  linked_goal_id?: string;
}

export interface ProposedWorkPlan {
  plan_id: string;
  engagement_id: string;
  version: number;
  target_outcome: string;
  work_items: ProposedWorkItem[];
  assumptions_and_questions: string[];
  recommended_first_action: string;
  status: string;
  generated_at: string;
}

export interface EvidenceItem {
  claim: string;
  category: string;
  evidence_source: string;
  confidence_level: string;
}

export interface MorningBriefData {
  brief_id: string;
  engagement_id: string;
  customer_name: string;
  brief_date: string;
  source_state_version: number;
  what_changed: WhatChangedItem[];
  what_matters_today_outcome: string;
  outcome_health: string;
  key_risks: string[];
  pending_decisions_and_approvals: string[];
  what_is_blocking_progress: BlockerItem[];
  proposed_work_plan: ProposedWorkPlan;
  next_best_action?: any;
  evidence_and_confidence: EvidenceItem[];
  warnings_or_partial_failures: string[];
  capabilities_invoked: string[];
  deliver_invoked: boolean;
  generated_at: string;
  scope_drift_detected?: boolean;
  scope_drift_explanation?: string;
}

interface DailyWorkBriefingProps {
  onClose?: () => void;
}

export default function DailyWorkBriefing({ onClose }: DailyWorkBriefingProps = {}) {
  const { activeCustomer } = useEngagement();
  const [brief, setBrief] = useState<MorningBriefData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");
  const [streamEvent, setStreamEvent] = useState<AgentStreamEvent | null>(null);
  const [streamHistory, setStreamHistory] = useState<AgentStreamEvent[]>([]);

  const fetchBrief = async () => {
    setLoading(true);
    setStreamEvent(null);
    setStreamHistory([]);
    try {
      const res = await fetch(`${API_BASE}/engagements/${activeCustomer.id}/supervisor/brief/stream`, {
        method: "POST"
      });
      if (!res.ok || !res.body) {
        throw new Error("Streaming not available, falling back");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ")) {
            try {
              const event: AgentStreamEvent = JSON.parse(trimmed.slice(6));
              if (event.type === "progress") {
                setStreamEvent(event);
                setStreamHistory((prev) => [...prev, event]);
              } else if (event.type === "complete" && (event as any).data) {
                setBrief((event as any).data);
                setLastRefreshed(getNowISTTime(true));
                setStreamEvent(null);
              }
            } catch (e) {
              console.warn("SSE parse error in brief:", e);
            }
          }
        }
      }
    } catch (err) {
      console.warn("Morning brief stream error, trying fallback:", err);
      try {
        const fallbackRes = await fetch(`${API_BASE}/engagements/${activeCustomer.id}/supervisor/brief`, { method: "POST" });
        const fallbackData = await fallbackRes.json();
        if (fallbackData.success) {
          setBrief(fallbackData.data);
          setLastRefreshed(getNowISTTime(true));
        }
      } catch (e) {
        console.error("Fallback brief fetch failed:", e);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrief();
  }, [activeCustomer.id]);

  if (!brief) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
        <AgentProgressStream
          currentEvent={streamEvent}
          history={streamHistory}
          title={`Supervisor Synthesizing Morning Brief for ${activeCustomer.customerName}`}
        />
      </div>
    );
  }

  const isWarning = brief.outcome_health === "NEEDS_REASSESSMENT";

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5 text-xs">
      {/* Header Banner & Refresh Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3.5 gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 bg-amber-500 text-slate-950 rounded-lg shadow-2xs shrink-0">
            <Sun className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display font-bold text-sm text-slate-900 truncate">
                Morning Brief &mdash; {brief.customer_name}
              </h2>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 font-semibold shrink-0">
                v{brief.source_state_version} Shared State
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono truncate">
              Sequential Intelligence: UNDERSTAND &rarr; KNOW &rarr; MOVE &rarr; PLAN &middot; Refreshed {lastRefreshed || "Just now"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            onClick={fetchBrief}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs transition shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              title="Close Morning Brief"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Real-Time Agent Stream on Refresh */}
      {loading && (
        <AgentProgressStream
          currentEvent={streamEvent}
          history={streamHistory}
          title={`Supervisor Updating Morning Brief for ${activeCustomer.customerName}`}
        />
      )}

      {/* Warnings & Partial Failures Notice */}
      {brief.warnings_or_partial_failures && brief.warnings_or_partial_failures.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-900 space-y-1">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
            <span>Context Freshness & Evidence Warnings</span>
          </div>
          <ul className="space-y-0.5 pl-5 list-disc text-[11px] text-amber-800 font-mono">
            {brief.warnings_or_partial_failures.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 5 Core Morning Brief Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left Column: Sections A, B, C */}
        <div className="space-y-4">
          {/* Section A: What Changed? */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
              <span className="font-bold text-[11px] text-slate-900 uppercase tracking-wider font-mono">
                A. What Changed?
              </span>
              <span className="text-[10px] text-slate-500 font-mono">{brief.what_changed.length} Items</span>
            </div>
            <ul className="space-y-2 text-slate-800">
              {brief.what_changed.map((item, idx) => (
                <li key={idx} className="bg-white p-2.5 rounded border border-slate-200 space-y-1 shadow-2xs">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-mono font-bold px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                      {item.category}
                    </span>
                    <span className="text-slate-400 font-mono">{item.date_recorded}</span>
                  </div>
                  <p className="font-medium text-xs text-slate-900">{item.summary}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Section B: What Matters Today? */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
              <span className="font-bold text-[11px] text-slate-900 uppercase tracking-wider font-mono">
                B. What Matters Today?
              </span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                isWarning ? "bg-amber-50 text-amber-800 border-amber-300" : "bg-emerald-50 text-emerald-800 border-emerald-300"
              }`}>
                {brief.outcome_health}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold text-slate-500 block">Target Customer Outcome:</span>
              <p className="font-bold text-slate-900 text-xs leading-relaxed">{brief.what_matters_today_outcome}</p>
            </div>

            {brief.key_risks.length > 0 && (
              <div className="pt-2 border-t border-slate-200 space-y-1">
                <span className="text-[10px] font-mono font-bold text-slate-500 block">Key Risks:</span>
                {brief.key_risks.map((risk, idx) => (
                  <p key={idx} className="text-slate-700 text-xs flex items-start gap-1">
                    <span className="text-amber-600 font-bold">•</span>
                    <span>{risk}</span>
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Section C: What is Blocking Progress? */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
              <span className="font-bold text-[11px] text-slate-900 uppercase tracking-wider font-mono">
                C. What is Blocking Progress?
              </span>
              <span className="text-[10px] text-slate-500 font-mono">{brief.what_is_blocking_progress.length} Active Blockers</span>
            </div>

            {brief.what_is_blocking_progress.length > 0 ? (
              <div className="space-y-2">
                {brief.what_is_blocking_progress.map((b, idx) => (
                  <div key={idx} className="p-3 bg-amber-50/80 border border-amber-200 rounded-md space-y-1.5 text-amber-950">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0" />
                        <span>{b.title}</span>
                      </div>
                      <span className="text-[10px] font-mono bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-300 font-bold">
                        {b.dependency_type}
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-900 leading-relaxed"><strong>Impact:</strong> {b.impact_description}</p>
                    <div className="p-2 bg-white/80 rounded border border-amber-200 text-[10px] font-mono text-slate-700">
                      <strong>Evidence:</strong> {b.evidence_snippet}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-xs italic">No active gating blockers recorded in shared state.</p>
            )}
          </div>
        </div>

        {/* Right Column: Sections D & E */}
        <div className="space-y-4">
          {/* Section D: Supervisor Proposed Daily Work Plan */}
          <div className="p-4 bg-slate-900 text-white rounded-md space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <span className="font-bold text-[11px] uppercase tracking-wider font-mono text-amber-400">
                  D. Plan Agent Proposed Daily Work Plan
                </span>
              </div>
              <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                Plan {brief.proposed_work_plan.plan_id}
              </span>
            </div>

            {/* Recommended First Action Highlight Box */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-md space-y-1">
              <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider block">
                Recommended First Action Today:
              </span>
              <p className="font-bold text-xs text-white leading-relaxed">
                {brief.proposed_work_plan.recommended_first_action}
              </p>
            </div>

            {/* Ordered Work Items Sequence */}
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase">
                Ordered Work Sequence:
              </span>
              {brief.proposed_work_plan.work_items.map((wi) => (
                <div key={wi.id} className="p-2.5 bg-slate-800/90 border border-slate-700/80 rounded space-y-1">
                  <div className="flex items-center justify-between text-[11px] gap-2">
                    <span className="font-bold text-amber-300 font-mono">
                      #{wi.sequence_order}. {wi.title}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {wi.due_date && (
                        <span className="flex items-center gap-1 font-mono text-[9px] text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/60">
                          <Clock className="h-2.5 w-2.5 text-amber-400" />
                          <span>{wi.due_date}</span>
                        </span>
                      )}
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                        wi.status === "COMPLETED"
                          ? "bg-emerald-950 text-emerald-300 border-emerald-700"
                          : wi.status === "IN_PROGRESS"
                          ? "bg-amber-950 text-amber-300 border-amber-700"
                          : "bg-slate-900 text-slate-400 border-slate-700"
                      }`}>
                        {wi.status === "COMPLETED" ? "Done" : wi.status === "IN_PROGRESS" ? "In Progress" : wi.status}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    <strong>Why it matters:</strong> {wi.why_it_matters}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Section E: Evidence, Reasoning & Confidence */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
              <span className="font-bold text-[11px] text-slate-900 uppercase tracking-wider font-mono">
                E. Evidence & Confidence Traceability
              </span>
              <BookOpen className="h-4 w-4 text-slate-600" />
            </div>

            <div className="space-y-2">
              {brief.evidence_and_confidence.map((ev, idx) => (
                <div key={idx} className="p-2.5 bg-white rounded border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-mono font-bold text-slate-700">{ev.category}</span>
                    <span className="font-mono text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      {ev.confidence_level} Confidence
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-900">{ev.claim}</p>
                  <p className="text-[10px] text-slate-500 font-mono">Source: {ev.evidence_source}</p>
                </div>
              ))}
            </div>
          </div>

          {/* DELIVER Studio Quick Link */}
          <div className="p-3 bg-white border border-slate-200 rounded-md flex items-center justify-between text-xs">
            <div>
              <span className="font-semibold text-slate-900 block">Need a Customer Update?</span>
              <span className="text-[11px] text-slate-500">DELIVER agent is available for stakeholder communication.</span>
            </div>
            <Link
              href="/delivery"
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded font-semibold text-xs transition flex items-center gap-1 shrink-0"
            >
              <span>Open DELIVER</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
