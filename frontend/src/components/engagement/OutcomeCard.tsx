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
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
      {/* Header & Meta */}
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-mono text-teal-400">{customerName}</span>
          <h2 className="text-lg font-semibold text-slate-100">{engagementName}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 font-medium">
            <AlertCircle className="h-3.5 w-3.5" />
            Needs Reassessment
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
            Version {version}
          </span>
        </div>
      </div>

      {/* Outcome Statement */}
      <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
          Current Customer Outcome
        </label>
        <p className="text-sm font-medium text-slate-100 leading-relaxed">
          "{outcomeStatement}"
        </p>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
          <span className="text-slate-400 flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-teal-400" />
            Outcome Progress
          </span>
          <span className="text-teal-400 font-mono">{progress}%</span>
        </div>
        <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
          <div
            className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Success Criteria / Definition of Done */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Success Criteria / Definition of Done (DoD)
        </h4>
        <ul className="space-y-2">
          {successCriteria.map((item) => (
            <li key={item.id} className="flex items-center gap-2.5 text-xs text-slate-200">
              {item.completed ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-slate-500 shrink-0" />
              )}
              <span className={item.completed ? "line-through text-slate-400" : "font-medium"}>
                {item.title}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
