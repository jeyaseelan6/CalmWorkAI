"use client";

import React from "react";
import { CheckCircle2, Circle, AlertCircle, TrendingUp } from "lucide-react";

interface SuccessCriterion {
  id: string;
  title: string;
  completed: boolean;
}

interface OutcomeCardProps {
  customerName: string;
  engagementName: string;
  outcomeStatement: string;
  version: number;
  status: string;
  progress: number;
  successCriteria: SuccessCriterion[];
  onToggleCriterion?: (id: string) => void;
  outcomesList?: string[];
}

export default function OutcomeCard({
  customerName = "Active Customer",
  engagementName = "Customer Initiative",
  outcomeStatement = "Deliver customer outcomes with verified Definition of Done criteria.",
  version = 1,
  status = "HEALTHY",
  progress = 0,
  successCriteria = [],
  onToggleCriterion,
  outcomesList = []
}: Partial<OutcomeCardProps>) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4">
      {/* Header & Meta */}
      <div className="flex items-start justify-between border-b border-slate-100 pb-3">
        <div>
          <span className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">{customerName}</span>
          <h2 className="text-lg font-display font-bold text-slate-900">{engagementName}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2.5 py-0.5 rounded border flex items-center gap-1 font-semibold ${
            status === "HEALTHY" 
              ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
              : "bg-amber-50 text-amber-800 border-amber-200"
          }`}>
            <AlertCircle className="h-3.5 w-3.5" />
            {status === "HEALTHY" ? "Healthy" : "Needs Reassessment"}
          </span>
          <span className="text-xs px-2.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono font-semibold">
            v{version}
          </span>
        </div>
      </div>

      {/* Outcome Statement */}
      <div className="bg-slate-50 p-4 rounded-md border border-slate-200/80">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
            Active Customer Outcome Definition
          </span>
          <span className="text-[11px] text-slate-500 font-mono">Bound to Outcome v{version}</span>
        </div>
        <p className="text-base font-semibold text-slate-900 leading-snug">
          "{outcomeStatement}"
        </p>
      </div>

      {/* Measurable Outcomes (if present) */}
      {outcomesList && outcomesList.length > 0 && (
        <div className="bg-emerald-50/50 p-3.5 rounded-md border border-emerald-200/60 space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 font-mono block">
            Target Measurable Outcomes ({outcomesList.length})
          </span>
          <ul className="space-y-1 text-xs text-slate-800">
            {outcomesList.map((out, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span className="leading-snug">{out}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Progress Bar */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1 font-medium">
          <span className="text-slate-600 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-slate-500" />
            Outcome DoD Progress
          </span>
          <span className="text-slate-900 font-mono font-bold text-xs">{progress}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
          <div
            className="bg-blue-600 h-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Success Criteria / Definition of Done */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
            Definition of Done (DoD) Criteria ({successCriteria.length})
          </h3>
          {onToggleCriterion && (
            <span className="text-[10px] text-slate-400 font-mono">Click to toggle status</span>
          )}
        </div>
        <ul className="space-y-1.5">
          {successCriteria.map((item) => (
            <li
              key={item.id}
              onClick={() => onToggleCriterion && onToggleCriterion(item.id)}
              className={`flex items-center gap-2.5 text-xs p-1.5 rounded transition ${
                onToggleCriterion ? "cursor-pointer hover:bg-slate-50" : ""
              } ${item.completed ? "text-slate-500" : "text-slate-800"}`}
            >
              {item.completed ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-slate-300 hover:text-blue-500 shrink-0 transition" />
              )}
              <span className={`flex-1 ${item.completed ? "line-through text-slate-400" : "font-medium text-slate-900"}`}>
                {item.title}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {item.completed ? "Done" : "Pending"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
