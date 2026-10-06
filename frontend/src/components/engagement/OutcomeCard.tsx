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
}

export default function OutcomeCard({
  customerName = "Acme Corp",
  engagementName = "Onboarding Modernization",
  outcomeStatement = "Reduce manual customer onboarding time from 30 minutes to under 5 minutes.",
  version = 1,
  status = "NEEDS_REASSESSMENT",
  progress = 70,
  successCriteria = [
    { id: "sc-1", title: "Automated onboarding workflow implemented", completed: true },
    { id: "sc-2", title: "API integration complete", completed: true },
    { id: "sc-3", title: "Production validation complete", completed: false }
  ]
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
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Active Customer Outcome Definition
          </span>
          <span className="text-[11px] text-slate-500 font-mono">Bound to Outcome v{version}</span>
        </div>
        <p className="text-base font-semibold text-slate-900 leading-snug">
          "{outcomeStatement}"
        </p>
      </div>

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
            className="bg-slate-900 h-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Success Criteria / Definition of Done */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
          Definition of Done (DoD) Criteria
        </h3>
        <ul className="space-y-1.5">
          {successCriteria.map((item) => (
            <li key={item.id} className="flex items-center gap-2.5 text-xs text-slate-800">
              {item.completed ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-slate-300 shrink-0" />
              )}
              <span className={item.completed ? "line-through text-slate-400" : "font-medium text-slate-900"}>
                {item.title}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
