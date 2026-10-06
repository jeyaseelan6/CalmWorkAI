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
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4">
      {/* Header Banner */}
      <div className="flex items-start justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                Scope Change Detected
              </span>
              <span className="text-xs text-slate-500 font-medium">{detectedAgo}</span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 mt-0.5">{changeTitle}</h3>
          </div>
        </div>
      </div>

      {/* Structured Pattern: 1. EVIDENCE */}
      <div className="space-y-1.5">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-slate-400" />
          <span>1. Grounded Evidence</span>
        </h4>
        <div className="bg-slate-50 p-3 rounded-md border border-slate-200/80 text-xs space-y-1">
          {recommendation.evidence.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2 text-slate-700">
              <CheckCircle2 className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Structured Pattern: 2. REASONING & IMPACT */}
      <div className="space-y-1.5">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-slate-400" />
          <span>2. Impact Reasoning Chain</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          <div className="bg-slate-50 p-2.5 rounded-md border border-slate-200/80">
            <span className="text-[10px] font-mono font-bold text-slate-500 block uppercase mb-0.5">Outcome Impact</span>
            <p className="text-slate-800 font-medium">{affectedDimensions.outcome}</p>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-md border border-slate-200/80">
            <span className="text-[10px] font-mono font-bold text-slate-500 block uppercase mb-0.5">DoD Criteria Impact</span>
            <p className="text-slate-800 font-medium">{affectedDimensions.requirement}</p>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-md border border-slate-200/80">
            <span className="text-[10px] font-mono font-bold text-amber-700 block uppercase mb-0.5">Dependency Created</span>
            <p className="text-slate-800 font-medium">{affectedDimensions.dependency}</p>
          </div>
        </div>
        <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-md border border-slate-200/80 leading-relaxed italic">
          "{recommendation.reasoning}"
        </p>
      </div>

      {/* Structured Pattern: 3. RECOMMENDATION */}
      <div className="bg-slate-100 p-3.5 rounded-md border border-slate-200 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
            3. Recommended Next Action
          </span>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white text-slate-800 border border-slate-200">
            Confidence: {recommendation.confidence} (96%)
          </span>
        </div>
        <p className="text-sm font-bold text-slate-900">{recommendation.title}</p>
      </div>

      {/* Structured Pattern: 4. ACTION */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <span className="text-xs text-amber-800 flex items-center gap-1.5 font-semibold">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          Requires Manager Approval
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onReject}
            className="px-3 py-1.5 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-all"
          >
            Reject
          </button>
          <button
            onClick={onApprove}
            className="px-4 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-all"
          >
            Approve & Transition
          </button>
        </div>
      </div>
    </div>
  );
}
