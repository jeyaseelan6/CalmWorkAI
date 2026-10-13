"use client";

import React, { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import OutcomeCard from "@/components/engagement/OutcomeCard";
import WorkCycleStepper from "@/components/engagement/WorkCycleStepper";
import EvidenceReasoningCard from "@/components/engagement/EvidenceReasoningCard";
import KnowledgePanel from "@/components/knowledge/KnowledgePanel";
import CustomerUpdatePanel from "@/components/delivery/CustomerUpdatePanel";
import WorkPlanSection from "@/components/engagement/WorkPlanSection";
import { useEngagement } from "@/context/EngagementContext";
import { 
  Building2, 
  CheckCircle, 
  Sparkles, 
  Clock, 
  BookOpen, 
  FileText, 
  Upload, 
  ShieldAlert,
  ArrowRight,
  Layers,
  ListTodo
} from "lucide-react";

import { useParams } from "next/navigation";

function parseStepNumber(workCycle?: string): number {
  if (!workCycle) return 1;
  const match = workCycle.match(/Step\s*(\d)/i);
  if (match) return parseInt(match[1], 10);
  if (workCycle.includes("UNDERSTAND") || workCycle.includes("Understand")) return 1;
  if (workCycle.includes("PROBLEM") || workCycle.includes("Problem")) return 2;
  if (workCycle.includes("DESIGN") || workCycle.includes("Design")) return 3;
  if (workCycle.includes("BUILD") || workCycle.includes("Build")) return 4;
  if (workCycle.includes("DEPLOY") || workCycle.includes("Deploy") || workCycle.includes("VALIDATION")) return 5;
  if (workCycle.includes("OWN") || workCycle.includes("Own")) return 6;
  return 1;
}

function EngagementDetailContent() {
  const routeParams = useParams();
  const engagementId = (routeParams?.id as string) || "eng-acme-001";

  const {
    customers,
    activeCustomer,
    setActiveCustomer,
    activeEngagementData,
    nextActionData,
    approvedAcme,
    handleApproveChange,
    fetchEngagementDetail
  } = useEngagement();
  const [activeTab, setActiveTab] = useState<"overview" | "plan" | "outcome" | "knowledge" | "move" | "timeline">("overview");

  // Sync route parameter with active engagement context
  React.useEffect(() => {
    if (engagementId) {
      if (activeCustomer.id !== engagementId) {
        const matching = customers.find((c) => c.id === engagementId);
        if (matching) {
          setActiveCustomer(matching);
        }
      }
      fetchEngagementDetail(engagementId);
    }
  }, [engagementId, customers]);

  // Document upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docCategory, setDocCategory] = useState("Technical Documentation");
  const [docContent, setDocContent] = useState("");
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadStatus("Uploading & Indexing...");
    try {
      const res = await fetch(`http://localhost:8000/api/v1/engagements/${engagementId}/documents/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: docTitle,
          category: docCategory,
          content: docContent
        })
      });
      if (res.ok) {
        setUploadStatus("Indexed successfully!");
        setTimeout(() => {
          setShowUploadModal(false);
          setUploadStatus(null);
          setDocTitle("");
          setDocContent("");
        }, 1200);
      } else {
        setUploadStatus("Upload failed. Check backend connection.");
        setTimeout(() => setUploadStatus(null), 2500);
      }
    } catch (err) {
      setUploadStatus("Network error uploading document.");
      setTimeout(() => setUploadStatus(null), 2500);
    }
  };

  const isAcme = engagementId === "eng-acme-001";

  // Dynamic Outcome statement from DB or active plan
  const currentOutcomeStatement =
    activeEngagementData?.outcome?.statement ||
    activeEngagementData?.outcome?.work_plan?.engagement_objective ||
    activeCustomer.engagementName;

  const currentOutcomeVersion =
    activeEngagementData?.outcome?.version ?? (isAcme && approvedAcme ? 2 : 1);

  const currentOutcomeStatus =
    activeEngagementData?.engagement?.status ?? (isAcme && approvedAcme ? "HEALTHY" : activeCustomer.status);

  const currentStepNumber = parseStepNumber(
    activeEngagementData?.engagement?.current_work_cycle || (isAcme ? "Step 4" : "Step 1")
  );

  // Dynamic Definition of Done / Success Criteria list
  const currentSuccessCriteria = React.useMemo(() => {
    if (activeEngagementData?.outcome?.success_criteria && activeEngagementData.outcome.success_criteria.length > 0) {
      return activeEngagementData.outcome.success_criteria.map((c: any, idx: number) => {
        if (typeof c === "string") {
          return { id: `sc-${idx + 1}`, title: c, completed: false };
        }
        return {
          id: c.id || `sc-${idx + 1}`,
          title: c.title || c.statement || String(c),
          completed: Boolean(c.completed)
        };
      });
    }
    if (activeEngagementData?.outcome?.work_plan?.definition_of_done && activeEngagementData.outcome.work_plan.definition_of_done.length > 0) {
      return activeEngagementData.outcome.work_plan.definition_of_done.map((d: any, idx: number) => {
        if (typeof d === "string") {
          return { id: `dod-${idx + 1}`, title: d, completed: false };
        }
        return {
          id: d.id || `dod-${idx + 1}`,
          title: d.title || String(d),
          completed: Boolean(d.completed)
        };
      });
    }
    if (isAcme) {
      return approvedAcme
        ? [
            { id: "sc-1", title: "Automated onboarding workflow implemented", completed: true },
            { id: "sc-2", title: "API integration complete", completed: true },
            { id: "sc-3", title: "Production validation complete", completed: false },
            { id: "sc-4", title: "Enterprise SSO configuration & validation (Added v2)", completed: false }
          ]
        : [
            { id: "sc-1", title: "Automated onboarding workflow implemented", completed: true },
            { id: "sc-2", title: "API integration complete", completed: true },
            { id: "sc-3", title: "Production validation complete", completed: false }
          ];
    }
    return [
      { id: "sc-1", title: `Baseline architecture assessment completed for ${activeCustomer.customerName}`, completed: false },
      { id: "sc-2", title: "Core migration workflows implemented and validated", completed: false },
      { id: "sc-3", title: "Production verification and signoff completed", completed: false }
    ];
  }, [activeEngagementData, isAcme, approvedAcme, activeCustomer.customerName]);

  const completedCount = currentSuccessCriteria.filter((c: any) => c.completed).length;
  const currentProgress = currentSuccessCriteria.length > 0
    ? Math.round((completedCount / currentSuccessCriteria.length) * 100)
    : (activeEngagementData?.engagement?.progress ?? (currentOutcomeStatus === "HEALTHY" ? 75 : 10));

  const handleToggleCriterion = async (criterionId: string) => {
    try {
      await fetch(`http://localhost:8000/api/v1/engagements/${engagementId}/dod/${criterionId}/toggle`, {
        method: "PATCH"
      });
      fetchEngagementDetail(engagementId);
    } catch (e) {
      console.warn("Failed to toggle criterion:", e);
    }
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Engagement Workspace Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="h-5 w-5 text-teal-400" />
                <h1 className="text-xl font-bold text-slate-100">{activeCustomer.customerName} Engagement Workspace</h1>
              </div>
              <p className="text-xs text-slate-400">{activeCustomer.engagementName}</p>
            </div>

            <div className="flex items-center gap-3">
              <span className={`text-xs px-3 py-1 rounded-full font-mono border ${
                currentOutcomeStatus === "HEALTHY" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-amber-500/10 text-amber-300 border-amber-500/30"
              }`}>
                Outcome Version: {currentOutcomeVersion}
              </span>
              <span className="text-xs px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-300 font-mono">
                Status: {currentOutcomeStatus}
              </span>
            </div>
          </div>

          {/* Section 6 Engagement Tabs Navigation */}
          <div className="flex items-center gap-2 border-t border-slate-800 pt-4">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition ${
                activeTab === "overview" ? "bg-teal-500/20 text-teal-300 border border-teal-500/40" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("plan")}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                activeTab === "plan" ? "bg-teal-500/20 text-teal-300 border border-teal-500/40" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ListTodo className="h-3.5 w-3.5" />
              <span>Work Plan</span>
            </button>
            <button
              onClick={() => setActiveTab("outcome")}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition ${
                activeTab === "outcome" ? "bg-teal-500/20 text-teal-300 border border-teal-500/40" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Outcome & DoD
            </button>
            <button
              onClick={() => setActiveTab("knowledge")}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition ${
                activeTab === "knowledge" ? "bg-teal-500/20 text-teal-300 border border-teal-500/40" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Knowledge & Specs
            </button>
            <button
              onClick={() => setActiveTab("move")}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition ${
                activeTab === "move" ? "bg-teal-500/20 text-teal-300 border border-teal-500/40" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Move & Actions
            </button>
            <button
              onClick={() => setActiveTab("timeline")}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition ${
                activeTab === "timeline" ? "bg-teal-500/20 text-teal-300 border border-teal-500/40" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Audit Timeline
            </button>
          </div>
        </div>

        {/* Tab 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <WorkCycleStepper currentStepNumber={currentStepNumber} customerName={activeCustomer.customerName} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <WorkPlanSection
                  engagementId={engagementId}
                  customerName={activeCustomer.customerName}
                  initialWorkPlan={activeEngagementData?.outcome?.work_plan}
                  outcomeVersion={currentOutcomeVersion}
                  onPlanApproved={() => {
                    fetchEngagementDetail(engagementId);
                  }}
                />

                <OutcomeCard
                  customerName={activeCustomer.customerName}
                  engagementName={activeCustomer.engagementName}
                  outcomeStatement={currentOutcomeStatement}
                  version={currentOutcomeVersion}
                  status={currentOutcomeStatus}
                  progress={currentProgress}
                  successCriteria={currentSuccessCriteria}
                  onToggleCriterion={handleToggleCriterion}
                  outcomesList={activeEngagementData?.outcome?.work_plan?.outcomes || []}
                />

                {/* Evidence -> Reasoning -> Recommendation Pattern */}
                {isAcme && !activeEngagementData?.outcome?.work_plan ? (
                  <EvidenceReasoningCard
                    title="UNDERSTAND Change Impact Reasoning"
                    evidence={[
                      `Customer requirement input: 'Enterprise SSO is mandatory before cutover.'`,
                      `Current Outcome v1 success criteria lacks enterprise authentication clause.`,
                      `Step 4 production validation gated on security compliance.`
                    ]}
                    reasoning={[
                      `Adding Enterprise SSO is a mandatory gating requirement for customer IT security sign-off.`,
                      `DoD completion progress affected: Step 4 requires SSO validation item before Step 5 deployment.`
                    ]}
                    recommendation={
                      approvedAcme
                        ? "Outcome Version 2 active. Enterprise SSO requirement integrated into Definition of Done checklist."
                        : "Upgrade Outcome to Version 2. Add Enterprise SSO configuration & validation to DoD checklist and request Manager approval."
                    }
                    confidence="High (96.4%)"
                    approvalRequired={!approvedAcme}
                    onApprove={!approvedAcme ? handleApproveChange : undefined}
                  />
                ) : (
                  <EvidenceReasoningCard
                    title="UNDERSTAND & Supervisor Alignment"
                    evidence={[
                      activeEngagementData?.outcome?.work_plan
                        ? `Manager approved structured work plan containing ${activeEngagementData.outcome.work_plan.milestones?.length || 3} delivery milestones.`
                        : `Baseline engagement parameters initialized for ${activeCustomer.customerName}.`,
                      `Objective: ${currentOutcomeStatement.slice(0, 100)}...`,
                      `Definition of Done: ${currentSuccessCriteria.length} verified acceptance conditions established.`
                    ]}
                    reasoning={[
                      `Target delivery stages and task packages are aligned with customer technical constraints.`,
                      `Progress tracked deterministically against DoD acceptance criteria without hallucinated metrics.`
                    ]}
                    recommendation={
                      activeEngagementData?.outcome?.work_plan?.next_actions?.[0] ||
                      nextActionData?.recommendation ||
                      `Execute initial discovery and baseline architecture assessment for ${activeCustomer.customerName}.`
                    }
                    confidence="High (98.2%)"
                    approvalRequired={false}
                  />
                )}
              </div>

              {/* Right Sidebar */}
              <div className="space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-teal-400">Next Best Action</span>
                  <p className="text-xs font-semibold text-slate-100">
                    {activeEngagementData?.outcome?.work_plan?.next_actions?.[0] ||
                      nextActionData?.recommendation ||
                      (isAcme ? (approvedAcme ? "Execute cutover dry-run test on staging replica." : "Request SSO configuration from customer security owner.") : `Initiate discovery interviews with ${activeCustomer.customerName} technical team.`)}
                  </p>
                  <p className="text-[11px] text-slate-400 bg-slate-950 p-2 rounded border border-slate-800">
                    <strong>Why now:</strong> {activeEngagementData?.outcome?.work_plan?.timeline_summary || nextActionData?.why_now || (isAcme && approvedAcme ? "Validates production deployment window." : "Gating prerequisite for active work cycle.")}
                  </p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Blockers & Risks</span>
                  <ul className="space-y-2 text-xs">
                    {activeEngagementData?.outcome?.work_plan?.risks && activeEngagementData.outcome.work_plan.risks.length > 0 ? (
                      activeEngagementData.outcome.work_plan.risks.map((risk: string, i: number) => (
                        <li key={i} className="p-2 bg-slate-950 rounded border border-slate-800">
                          <span className="text-amber-400 font-bold block">● Delivery Risk #{i + 1}</span>
                          <span className="text-[10px] text-slate-400">{risk}</span>
                        </li>
                      ))
                    ) : nextActionData?.gating_blocker ? (
                      <li className="p-2 bg-slate-950 rounded border border-slate-800">
                        <span className="text-amber-400 font-bold block">● {nextActionData.gating_blocker.title}</span>
                        <span className="text-[10px] text-slate-400">{nextActionData.gating_blocker.description || `Waiting on ${nextActionData.gating_blocker.owner}`}</span>
                      </li>
                    ) : (isAcme && !approvedAcme) ? (
                      <li className="p-2 bg-slate-950 rounded border border-slate-800">
                        <span className="text-amber-400 font-bold block">● SSO Configuration</span>
                        <span className="text-[10px] text-slate-400">Waiting on Customer Security Team</span>
                      </li>
                    ) : (
                      <li className="p-2 bg-slate-950 rounded border border-slate-800">
                        <span className="text-emerald-400 font-bold block">● Zero Gating Blockers</span>
                        <span className="text-[10px] text-slate-400">All prerequisite dependencies cleared for current delivery cycle.</span>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: WORK PLAN */}
        {activeTab === "plan" && (
          <div className="space-y-6">
            <WorkPlanSection
              engagementId={engagementId}
              customerName={activeCustomer.customerName}
              initialWorkPlan={activeEngagementData?.outcome?.work_plan}
              outcomeVersion={currentOutcomeVersion}
              onPlanApproved={() => {
                fetchEngagementDetail(engagementId);
              }}
            />
          </div>
        )}

        {/* Tab 2: OUTCOME */}
        {activeTab === "outcome" && (
          <div className="space-y-6">
            <OutcomeCard
              customerName={activeCustomer.customerName}
              engagementName={activeCustomer.engagementName}
              outcomeStatement={currentOutcomeStatement}
              version={currentOutcomeVersion}
              status={currentOutcomeStatus}
              progress={currentProgress}
              successCriteria={currentSuccessCriteria}
              onToggleCriterion={handleToggleCriterion}
              outcomesList={activeEngagementData?.outcome?.work_plan?.outcomes || []}
            />
          </div>
        )}

        {/* Tab 3: KNOWLEDGE & SPEC DOC UPLOAD */}
        {activeTab === "knowledge" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200">Engagement Knowledge Base</h2>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg text-xs transition flex items-center gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Upload Specification Document</span>
              </button>
            </div>

            <KnowledgePanel engagementId={activeCustomer.id} customerName={activeCustomer.customerName} />

            {/* Document Categories List */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {["Customer Requirements", "Architecture", "Technical Documentation", "Decisions", "Customer Notes", "Other"].map((cat) => (
                <div key={cat} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
                  <span className="font-bold text-slate-200 block">{cat}</span>
                  <span className="text-[10px] text-teal-400 font-mono">1 Indexed Spec</span>
                </div>
              ))}
            </div>

            {/* Upload Modal */}
            {showUploadModal && (
              <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full space-y-4">
                  <h3 className="text-sm font-bold text-slate-100">Upload Engagement Spec Document</h3>
                  <form onSubmit={handleUploadDocument} className="space-y-3 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1">Document Title</label>
                      <input
                        type="text"
                        required
                        value={docTitle}
                        onChange={(e) => setDocTitle(e.target.value)}
                        placeholder="e.g. Acme SAML 2.0 Identity Spec"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Category</label>
                      <select
                        value={docCategory}
                        onChange={(e) => setDocCategory(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-teal-500"
                      >
                        <option value="Customer Requirements">Customer Requirements</option>
                        <option value="Architecture">Architecture</option>
                        <option value="Technical Documentation">Technical Documentation</option>
                        <option value="Decisions">Decisions</option>
                        <option value="Customer Notes">Customer Notes</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Document Content / Text</label>
                      <textarea
                        rows={4}
                        required
                        value={docContent}
                        onChange={(e) => setDocContent(e.target.value)}
                        placeholder="Paste technical requirements or architecture text..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                    {uploadStatus && <p className="text-teal-400 text-xs">{uploadStatus}</p>}
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowUploadModal(false)}
                        className="px-3 py-1.5 bg-slate-950 text-slate-400 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-teal-500 text-slate-950 font-bold rounded-lg"
                      >
                        Upload & Index
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: MOVE */}
        {activeTab === "move" && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal-400">Next Best Action (MOVE Agent)</span>
              <div className="space-y-2 text-xs">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block font-mono">SITUATION</span>
                  <p className="text-slate-200 font-semibold">{approvedAcme ? "Engagement at Step 4, ready for cutover dry-run." : "Outcome status is NEEDS_REASSESSMENT due to pending SSO dependency."}</p>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block font-mono">RECOMMENDATION</span>
                  <p className="text-teal-300 font-bold">{approvedAcme ? "Execute cutover dry-run performance test on staging replica." : "Request SSO configuration from customer security owner."}</p>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block font-mono">WHY NOW</span>
                  <p className="text-slate-300">{approvedAcme ? "Confirms 15-minute cutover window." : "Primary blocker gating Step 4 production rollout."}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: TIMELINE */}
        {activeTab === "timeline" && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Audit Trail Timeline</h3>
            <ul className="space-y-3 text-xs">
              <li className="border-l-2 border-teal-400 pl-3 py-1">
                <span className="text-[11px] text-slate-400 font-mono block">10m ago</span>
                <span className="font-semibold text-slate-200">Customer requirement change detected: Enterprise SSO mandatory.</span>
              </li>
              <li className="border-l-2 border-emerald-400 pl-3 py-1">
                <span className="text-[11px] text-slate-400 font-mono block">25m ago</span>
                <span className="font-semibold text-slate-200">Outcome Version 1 established and approved.</span>
              </li>
            </ul>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function EngagementDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
          <div className="text-xs text-slate-400 font-mono animate-pulse flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-teal-400 animate-ping" />
            <span>Loading engagement workspace...</span>
          </div>
        </div>
      }
    >
      <EngagementDetailContent />
    </React.Suspense>
  );
}
