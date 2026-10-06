"use client";

import React from "react";
import { Sparkles, ArrowRight, ShieldAlert, CheckCircle } from "lucide-react";

interface EvidenceReasoningCardProps {
  title?: string;
  evidence: string[];
  reasoning: string[];
  recommendation: string;
  confidence?: string;
  approvalRequired?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
}

export default function EvidenceReasoningCard({
  title = "AI Change Intelligence Insight",
  evidence,
  reasoning,
  recommendation,
  confidence = "High",
  approvalRequired = true,
  onApprove,
  onReject
}: EvidenceReasoningCardProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-teal-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {confidence && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/30 font-mono">
              Confidence: {confidence}
            </span>
          )}
          {approvalRequired && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
              Approval Required
            </span>
          )}
        </div>
      </div>

      {/* Evidence -> Reasoning -> Recommendation Flow */}
      <div className="space-y-3 text-xs">
        {/* Step 1: Evidence */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
          <div className="text-[10px] font-mono uppercase font-bold text-slate-400 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-teal-400" />
            1. Evidence (Observed Requirements & Current DoD)
          </div>
          <ul className="space-y-1 text-slate-300 pl-3 list-disc text-[11px]">
            {evidence.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>

        {/* Step 2: Reasoning */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
          <div className="text-[10px] font-mono uppercase font-bold text-slate-400 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            2. Reasoning (Impact Chain & Gating Dependency)
          </div>
          <ul className="space-y-1 text-slate-300 pl-3 list-disc text-[11px]">
            {reasoning.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>

        {/* Step 3: Recommendation */}
        <div className="bg-teal-500/10 border border-teal-500/30 p-3.5 rounded-lg space-y-1">
          <div className="text-[10px] font-mono uppercase font-bold text-teal-300 flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5 text-teal-400" />
            3. Recommendation (Action & DoD Version Shift)
          </div>
          <p className="text-xs font-medium text-slate-100 leading-relaxed">
            {recommendation}
          </p>
        </div>
      </div>

      {/* Action Buttons if approval handler is passed */}
      {(onApprove || onReject) && (
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          {onReject && (
            <button
              onClick={onReject}
              className="px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg transition"
            >
              Reject Proposal
            </button>
          )}
          {onApprove && (
            <button
              onClick={onApprove}
              className="px-4 py-1.5 text-xs bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg transition flex items-center gap-1.5"
            >
              <span>Approve Outcome Transition</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
