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
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
      {/* Header & Meta */}
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-wider">{customerName}</span>
          <h2 className="text-xl font-display font-bold text-slate-900">{engagementName}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5 font-semibold">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
            Needs Reassessment
          </span>
          <span className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono font-bold">
            Version {version}
          </span>
        </div>
      </div>

      {/* Outcome Statement */}
      <div className="bg-slate-50 p-4.5 rounded-xl border border-slate-200">
        <label className="text-xs font-display font-bold uppercase tracking-wider text-blue-700 block mb-1">
          Current Customer Outcome
        </label>
        <p className="text-base font-semibold text-slate-900 leading-relaxed">
          "{outcomeStatement}"
        </p>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
          <span className="text-slate-700 flex items-center gap-1.5 font-medium">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            Outcome Progress
          </span>
          <span className="text-blue-700 font-mono font-bold text-sm">{progress}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
          <div
            className="bg-gradient-to-r from-blue-600 to-emerald-500 h-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Success Criteria / Definition of Done */}
      <div>
        <h4 className="text-xs font-display font-bold uppercase tracking-wider text-slate-500 mb-2.5">
          Success Criteria / Definition of Done (DoD)
        </h4>
        <ul className="space-y-2.5">
          {successCriteria.map((item) => (
            <li key={item.id} className="flex items-center gap-3 text-sm text-slate-800">
              {item.completed ? (
                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
              ) : (
                <Circle className="h-4.5 w-4.5 text-slate-300 shrink-0" />
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
