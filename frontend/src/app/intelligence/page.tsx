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
      const res = await fetch(`http://localhost:8000/api/v1/engagements/${activeCustomer.id}/analyze-change`, {
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
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-700">
                  <Sparkles className="h-5 w-5" />
                </div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-teal-800">
                  UNDERSTAND Agent Engine
                </span>
              </div>
              <h1 className="text-2xl font-display font-bold text-slate-900">
                Scope Drift & Change Impact Studio
              </h1>
              <p className="text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Live AI impact propagation engine for <strong className="text-slate-900">{activeCustomer.customerName}</strong>. Evaluates incoming scope shifts against the active outcome contract and generates structured Definition of Done (DoD) recommendations.
              </p>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-mono">
                <Lock className="h-3.5 w-3.5 text-teal-600" />
                <span className="text-slate-700 font-semibold">Privacy Guardrail Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* 1. Live AI Scope Drift Input Studio */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-display font-bold text-slate-900 flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-600" />
              <span>Evaluate New Requirement or Scope Change</span>
            </h2>
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
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 font-medium"
            />

            {/* Quick Sample Presets */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] text-slate-400 font-mono">Quick Presets:</span>
              {samplePresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setChangeInput(preset);
                    handleRunAnalysis(preset);
                  }}
                  className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md border border-slate-200 transition truncate max-w-xs cursor-pointer"
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
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                {isAnalyzing ? (
                  <>
                    <Sparkles className="h-4 w-4 animate-spin" />
                    <span>UNDERSTAND Agent Evaluating Impact...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Run AI Change Impact Analysis</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error State */}
        {analysisError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{analysisError}</span>
          </div>
        )}

        {/* 2. REAL AI Generated Analysis Output Card */}
        {analysisData && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5 animate-in fade-in duration-200">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200">
                    Risk Score: {analysisData.risk_score}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    Privacy Guardrail Verified
                  </span>
                </div>
                <h2 className="text-base font-display font-bold text-slate-900">
                  {analysisData.change_title}
                </h2>
              </div>

              {isManager && !approvedAcme && (
                <button
                  onClick={handleApproveChange}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-md transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Approve & Upgrade to v2</span>
                </button>
              )}
            </div>

            {/* AI Recommendation */}
            <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-800 block">
                AI Recommendation
              </span>
              <p className="text-xs font-semibold text-blue-900 leading-relaxed">
                {analysisData.recommendation}
              </p>
            </div>

            {/* Evidence & Reasoning Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[11px] font-mono font-bold uppercase text-slate-600 block">
                  1. Grounded Evidence
                </span>
                <ul className="space-y-1.5 text-slate-700">
                  {analysisData.evidence?.map((item: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[11px] font-mono font-bold uppercase text-slate-600 block">
                  2. Impact Reasoning Chain
                </span>
                <ul className="space-y-1.5 text-slate-700">
                  {analysisData.reasoning?.map((item: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-amber-600 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Affected Dimensions */}
            {analysisData.affected_dimensions && analysisData.affected_dimensions.length > 0 && (
              <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Affected Dimensions:</span>
                <div className="flex flex-wrap gap-1.5">
                  {analysisData.affected_dimensions.map((dim: string, idx: number) => (
                    <span key={idx} className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded font-mono text-[11px]">
                      {dim}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested Outcome Criteria Preview */}
            {analysisData.suggested_success_criteria && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <span className="text-[11px] font-mono font-bold uppercase text-slate-600 block">
                  Proposed Definition of Done Checklist (Outcome v2 Preview)
                </span>
                <div className="space-y-1.5">
                  {analysisData.suggested_success_criteria.map((sc: any) => (
                    <div 
                      key={sc.id} 
                      className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                        sc.title.includes("Added")
                          ? "bg-amber-50/70 border-amber-200 text-amber-900"
                          : "bg-slate-50 border-slate-200 text-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className={`h-3.5 w-3.5 ${sc.completed ? "text-emerald-600" : "text-slate-400"}`} />
                        <span className="font-medium">{sc.title}</span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">
                        {sc.completed ? "COMPLETED" : "PENDING"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State when no analysis has been run yet */}
        {!analysisData && !isAnalyzing && (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2 text-slate-500">
            <HelpCircle className="h-8 w-8 mx-auto text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700">No Active Change Assessment</h3>
            <p className="text-xs max-w-md mx-auto">
              Select a sample preset or enter a requirement above to trigger real-time AI impact evaluation by the UNDERSTAND Agent.
            </p>
          </div>
        )}

        {/* Approved Outcome Card if v2 already active */}
        {approvedAcme && (
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-emerald-950 font-display">
                  Outcome Definition of Done — Version 2 Approved & Active
                </h3>
                <p className="text-xs text-emerald-800 font-medium">
                  Manager sign-off completed for {activeCustomer.customerName}. Production validation criteria activated.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
