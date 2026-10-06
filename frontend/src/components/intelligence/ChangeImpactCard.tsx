"use client";

import React, { useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, ChevronUp, ShieldAlert, Sparkles, FileText } from "lucide-react";

interface ChangeImpactCardProps {
  changeTitle: string;
  detectedAgo: string;
  affectedDimensions: {
    outcome: string;
    requirement: string;
    technical: string;
    dependency: string;
    timeline: string;
  };
  recommendation: {
    title: string;
    reasoning: string;
    evidence: string[];
    confidence: "High" | "Medium" | "Low";
    requiresApproval: boolean;
  };
  onApprove?: () => void;
  onReject?: () => void;
}

export default function ChangeImpactCard({
  changeTitle = 'Customer requirement changed: "SSO is required before production deployment."',
  detectedAgo = "10 minutes ago",
  affectedDimensions = {
    outcome: "Production-ready authentication is now required.",
    requirement: "Add enterprise SSO configuration and production DoD validation.",
    technical: "Authentication integration and production validation flow require update.",
    dependency: "Customer security team configuration is required.",
    timeline: "Target deployment timeline at risk until SSO config received."
  },
  recommendation = {
    title: "Request SSO configuration from customer security owner.",
    reasoning: "Production validation is blocked by this dependency. Receiving the configuration unblocks authentication validation.",
    evidence: [
      "Customer Requirement: SSO is required before production deployment.",
      "Timeline Event: Production validation marked as blocked.",
      "Dependency Log: Customer security configuration pending."
    ],
    confidence: "High",
    requiresApproval: true
  },
  onApprove,
  onReject
}: Partial<ChangeImpactCardProps>) {
  const [showEvidence, setShowEvidence] = useState(false);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-5">
      {/* Header Banner */}
      <div className="flex items-start justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Change Impact Detected
              </span>
              <span className="text-xs text-slate-400">{detectedAgo}</span>
            </div>
            <h3 className="text-base font-medium text-slate-100 mt-1">{changeTitle}</h3>
          </div>
        </div>
      </div>

      {/* Impact Propagation Chain */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          What Does This Change Affect?
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] text-teal-400 font-mono block mb-1">Outcome Impact</span>
            <p className="text-xs text-slate-200">{affectedDimensions.outcome}</p>
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] text-teal-400 font-mono block mb-1">Requirements & DoD</span>
            <p className="text-xs text-slate-200">{affectedDimensions.requirement}</p>
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] text-amber-400 font-mono block mb-1">Dependency Created</span>
            <p className="text-xs text-slate-200">{affectedDimensions.dependency}</p>
          </div>
        </div>
      </div>

      {/* Evidence → Reasoning → Recommendation Pattern (UI Spec Section 11) */}
      <div className="bg-slate-950 border border-teal-500/20 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-teal-400 text-xs font-semibold uppercase tracking-wide">
            <Sparkles className="h-4 w-4" />
            <span>Recommended Next Action</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/30 font-medium">
            Confidence: {recommendation.confidence}
          </span>
        </div>

        <p className="text-sm font-semibold text-slate-100">{recommendation.title}</p>

        {/* Reasoning */}
        <div className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded border border-slate-800">
          <strong className="text-slate-200 block mb-0.5">Why this action:</strong>
          {recommendation.reasoning}
        </div>

        {/* Evidence Toggle */}
        <button
          onClick={() => setShowEvidence(!showEvidence)}
          className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 font-medium transition-colors pt-1"
        >
          <FileText className="h-3.5 w-3.5" />
          <span>{showEvidence ? "Hide Supporting Evidence" : "View Supporting Evidence (3 references)"}</span>
          {showEvidence ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {showEvidence && (
          <ul className="space-y-1.5 pt-2 border-t border-slate-800/80 text-xs text-slate-300">
            {recommendation.evidence.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-slate-300 bg-slate-900/40 p-2 rounded">
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-400 mt-0.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-amber-400/90 flex items-center gap-1.5 font-medium">
          <ShieldAlert className="h-4 w-4" />
          Requires Manager Approval
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onReject}
            className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-all"
          >
            Reject
          </button>
          <button
            onClick={onApprove}
            className="px-4 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs transition-all shadow-md"
          >
            Approve & Execute Transition
          </button>
        </div>
      </div>
    </div>
  );
}
