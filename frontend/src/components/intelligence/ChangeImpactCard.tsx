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
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
      {/* Header Banner */}
      <div className="flex items-start justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                Change Impact Detected
              </span>
              <span className="text-xs text-slate-500 font-medium">{detectedAgo}</span>
            </div>
            <h3 className="text-base font-display font-bold text-slate-900 mt-1">{changeTitle}</h3>
          </div>
        </div>
      </div>

      {/* Impact Propagation Chain */}
      <div>
        <h4 className="text-xs font-display font-bold uppercase tracking-wider text-slate-500 mb-3">
          What Does This Change Affect?
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-xs text-blue-700 font-mono font-bold block mb-1">Outcome Impact</span>
            <p className="text-xs text-slate-800 font-medium">{affectedDimensions.outcome}</p>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-xs text-blue-700 font-mono font-bold block mb-1">Requirements & DoD</span>
            <p className="text-xs text-slate-800 font-medium">{affectedDimensions.requirement}</p>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-xs text-amber-700 font-mono font-bold block mb-1">Dependency Created</span>
            <p className="text-xs text-slate-800 font-medium">{affectedDimensions.dependency}</p>
          </div>
        </div>
      </div>

      {/* Evidence → Reasoning → Recommendation Pattern */}
      <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-800 text-xs font-display font-bold uppercase tracking-wide">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <span>Recommended Next Action</span>
          </div>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 font-bold font-mono">
            Confidence: {recommendation.confidence}
          </span>
        </div>

        <p className="text-sm font-bold text-slate-900">{recommendation.title}</p>

        {/* Reasoning */}
        <div className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-200">
          <strong className="text-slate-900 block mb-0.5 font-bold">Why this action:</strong>
          {recommendation.reasoning}
        </div>

        {/* Evidence Toggle */}
        <button
          onClick={() => setShowEvidence(!showEvidence)}
          className="flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-800 font-bold transition-colors pt-1"
        >
          <FileText className="h-3.5 w-3.5 text-blue-600" />
          <span>{showEvidence ? "Hide Supporting Evidence" : "View Supporting Evidence (3 references)"}</span>
          {showEvidence ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {showEvidence && (
          <ul className="space-y-1.5 pt-2 border-t border-blue-200 text-xs text-slate-800">
            {recommendation.evidence.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-slate-800 bg-white p-2 rounded-lg border border-slate-200/80">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <span className="font-medium">{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-amber-800 flex items-center gap-1.5 font-semibold">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          Requires Manager Approval
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onReject}
            className="px-3.5 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-all"
          >
            Reject
          </button>
          <button
            onClick={onApprove}
            className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-xs"
          >
            Approve & Execute Transition
          </button>
        </div>
      </div>
    </div>
  );
}
