"use client";

import React from "react";
import { ShieldCheck, BookOpen, Activity, Compass, Cpu, Sparkles, CheckCircle2 } from "lucide-react";

export interface AgentStreamEvent {
  type: "progress" | "complete" | "error";
  agent?: "SUPERVISOR" | "KNOW" | "UNDERSTAND" | "MOVE" | "DELIVER" | string;
  stage?: string;
  message?: string;
  step?: number;
  total_steps?: number;
  detail?: string;
}

interface AgentProgressStreamProps {
  currentEvent: AgentStreamEvent | null;
  history: AgentStreamEvent[];
  title?: string;
}

const AGENT_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }
> = {
  SUPERVISOR: {
    label: "Supervisor Coordinator",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    text: "text-indigo-700 dark:text-indigo-300",
    border: "border-indigo-200 dark:border-indigo-800",
    icon: ShieldCheck,
  },
  KNOW: {
    label: "KNOW Agent (RAG)",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
    icon: BookOpen,
  },
  UNDERSTAND: {
    label: "UNDERSTAND Agent",
    bg: "bg-sky-50 dark:bg-sky-950/40",
    text: "text-sky-700 dark:text-sky-300",
    border: "border-sky-200 dark:border-sky-800",
    icon: Activity,
  },
  MOVE: {
    label: "MOVE Agent",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
    icon: Compass,
  },
};

export default function AgentProgressStream({
  currentEvent,
  history,
  title = "Multi-Agent Orchestration in Progress"
}: AgentProgressStreamProps) {
  const currentAgent = currentEvent?.agent ? AGENT_CONFIG[currentEvent.agent] || {
    label: currentEvent.agent,
    bg: "bg-slate-50 dark:bg-slate-900",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-200 dark:border-slate-800",
    icon: Cpu,
  } : null;

  const currentStep = currentEvent?.step || 1;
  const totalSteps = currentEvent?.total_steps || 4;
  const percent = Math.min(100, Math.round((currentStep / totalSteps) * 100));

  const AgentIcon = currentAgent?.icon || Cpu;

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/50 rounded-xl p-5 shadow-sm space-y-4 transition-all">
      {/* Header with Pulse Radar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-600"></span>
          </span>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
            {title}
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Step {currentStep} of {totalSteps}
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
            {percent}%
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
        <div
          className="bg-gradient-to-r from-indigo-500 via-sky-500 to-indigo-600 h-2 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Active Agent Highlight Card */}
      {currentAgent && currentEvent && (
        <div
          className={`flex items-start gap-3 p-3.5 rounded-lg border ${currentAgent.bg} ${currentAgent.border} transition-all`}
        >
          <div className={`p-2 rounded-md bg-white dark:bg-slate-900 shadow-xs ${currentAgent.text}`}>
            <AgentIcon className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold uppercase tracking-wider ${currentAgent.text}`}>
                {currentAgent.label}
              </span>
              {currentEvent.stage && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300">
                  {currentEvent.stage}
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">
              {currentEvent.message || "Executing agent routine..."}
            </p>
          </div>
        </div>
      )}

      {/* Real-Time Call History Log */}
      {history.length > 1 && (
        <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Completed Agent Steps
          </div>
          <div className="space-y-1 max-h-36 overflow-y-auto pr-1 text-xs">
            {history.slice(0, -1).map((ev, idx) => {
              const cfg = ev.agent ? AGENT_CONFIG[ev.agent] : null;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-slate-600 dark:text-slate-400 py-0.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <span className="font-mono text-[10px] text-slate-500">
                    [{ev.agent || "AGENT"}]
                  </span>
                  <span className="truncate">{ev.message}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
