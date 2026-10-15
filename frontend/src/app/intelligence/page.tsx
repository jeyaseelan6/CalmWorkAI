"use client";

import React, { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { useEngagement } from "@/context/EngagementContext";
import { useAuth } from "@/context/AuthContext";
import { 
  Sparkles, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  FileText, 
  ArrowRight,
  Send,
  Layers,
  HelpCircle,
  AlertCircle
} from "lucide-react";

import { API_BASE } from "@/utils/api";

export default function IntelligencePage() {
  const { activeCustomer, approvedAcme, handleApproveChange, activeEngagementData } = useEngagement();
  const { isManager } = useAuth();

  const [changeInput, setChangeInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleRunAnalysis = async (customText?: string) => {
    const text = customText || changeInput;
    if (!text.trim() || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const res = await fetch(`${API_BASE}/engagements/${activeCustomer.id}/analyze-change`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_change_text: text.trim() })
      });

      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setAnalysisData(json.data);
      } else {
        setAnalysisError(json.detail || json.message || "UNDERSTAND Agent failed to analyze change impact.");
        setAnalysisData(null);
      }
    } catch (err: any) {
      setAnalysisError(err.message || "Network error while calling UNDERSTAND Agent.");
      setAnalysisData(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const samplePresets = [
    'Enterprise SSO configuration & validation is required before production deployment.',
    'Cutover migration downtime window must be reduced to under 5 minutes.',
    'Customer security requires data encryption in transit with custom KMS keys.'
  ];

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Calm Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-display text-slate-900">Changes & Risks</h1>
              <span className="text-slate-300">·</span>
              <span className="text-sm text-slate-600 font-medium">{activeCustomer.customerName}</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Scope drift detection, requirement impact propagation, and Outcome Goals recommendations
            </p>
          </div>
        </div>

        {/* 1. Scope Drift Input */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-900">
              Evaluate New Requirement or Constraint
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              Active Outcome: v{approvedAcme ? 2 : 1}
            </span>
          </div>

          <div className="space-y-2">
            <textarea
              rows={3}
              placeholder={`Enter new requirement shift or client constraint for ${activeCustomer.customerName}...`}
              value={changeInput}
              onChange={(e) => setChangeInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-slate-400"
            />

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[11px] text-slate-400 font-mono">Presets:</span>
              {samplePresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setChangeInput(preset);
                    handleRunAnalysis(preset);
                  }}
                  className="text-[11px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 transition truncate max-w-xs cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => handleRunAnalysis()}
                disabled={isAnalyzing || !changeInput.trim()}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                {isAnalyzing ? (
                  <>
                    <Sparkles className="h-3.5 w-3.5 animate-spin" />
                    <span>Evaluating Impact...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Analyze Scope Change</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error State */}
        {analysisError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{analysisError}</span>
          </div>
        )}

        {/* 2. Analysis Output Card */}
        {analysisData && (
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.25 rounded bg-amber-50 text-amber-800 border border-amber-200">
                    Risk Score: {analysisData.risk_score}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    Grounded AI Synthesis
                  </span>
                </div>
                <h2 className="text-sm font-semibold text-slate-900 font-display">
                  {analysisData.change_title}
                </h2>
              </div>

              {isManager && !approvedAcme && (
                <button
                  onClick={handleApproveChange}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-md transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Authorize v2 Upgrade</span>
                </button>
              )}
            </div>

            {/* Recommendation */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase text-slate-500 font-mono block">
                Recommendation
              </span>
              <p className="text-xs font-semibold text-slate-900 leading-snug">
                {analysisData.recommendation}
              </p>
            </div>

            {/* Evidence & Reasoning Chain */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-100">
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase text-slate-500 font-mono block">
                  Grounded Evidence
                </span>
                <ul className="space-y-1 text-slate-700">
                  {analysisData.evidence?.map((item: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-slate-400 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase text-slate-500 font-mono block">
                  Impact Reasoning
                </span>
                <ul className="space-y-1 text-slate-700">
                  {analysisData.reasoning?.map((item: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-slate-400 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Suggested Outcome Criteria Preview */}
            {analysisData.suggested_success_criteria && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <span className="text-[11px] font-semibold uppercase text-slate-500 font-mono block">
                  Proposed Outcome Goals Preview
                </span>
                <ul className="divide-y divide-slate-100 text-xs">
                  {analysisData.suggested_success_criteria.map((sc: any) => (
                    <li 
                      key={sc.id} 
                      className="py-1.5 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className={`h-3.5 w-3.5 ${sc.completed ? "text-emerald-600" : "text-slate-300"}`} />
                        <span className={sc.title.includes("Added") ? "font-semibold text-slate-900" : "text-slate-700"}>
                          {sc.title}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">
                        {sc.completed ? "COMPLETED" : "PENDING"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!analysisData && !isAnalyzing && (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center space-y-1.5 text-slate-500">
            <HelpCircle className="h-6 w-6 mx-auto text-slate-400" />
            <h2 className="text-xs font-semibold text-slate-700">No Active Scope Assessment</h2>
            <p className="text-[11px] max-w-sm mx-auto text-slate-400">
              Select a preset or describe a requirement above to analyze scope drift impact.
            </p>
          </div>
        )}

        {/* Approved State Notice */}
        {approvedAcme && (
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <div>
              <span className="text-xs font-semibold text-emerald-950 block">
                Outcome Goals — Version 2 Approved & Active
              </span>
              <p className="text-[11px] text-emerald-800">
                Production validation criteria integrated for {activeCustomer.customerName}.
              </p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
