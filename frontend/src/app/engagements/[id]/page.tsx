"use client";

import React, { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import OutcomeCard from "@/components/engagement/OutcomeCard";
import WorkCycleStepper from "@/components/engagement/WorkCycleStepper";
import EvidenceReasoningCard from "@/components/engagement/EvidenceReasoningCard";
import KnowledgePanel from "@/components/knowledge/KnowledgePanel";
import CustomerUpdatePanel from "@/components/delivery/CustomerUpdatePanel";
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
  Layers
} from "lucide-react";

export default function EngagementDetailPage() {
  const { activeCustomer, activeEngagementData, approvedAcme, handleApproveChange } = useEngagement();
  const [activeTab, setActiveTab] = useState<"overview" | "outcome" | "knowledge" | "move" | "timeline">("overview");

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
      const res = await fetch(`http://localhost:8000/api/v1/engagements/${activeCustomer.id}/documents/upload`, {
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

  const isAcme = activeCustomer.id === "eng-acme-001";

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
                approvedAcme ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-amber-500/10 text-amber-300 border-amber-500/30"
              }`}>
                Outcome Version: {approvedAcme ? 2 : 1}
              </span>
              <span className="text-xs px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-300 font-mono">
                Status: {approvedAcme ? "HEALTHY" : activeCustomer.status}
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
            <WorkCycleStepper currentStepNumber={isAcme ? 4 : 5} customerName={activeCustomer.customerName} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <OutcomeCard
                  customerName={activeCustomer.customerName}
                  engagementName={activeCustomer.engagementName}
                  outcomeStatement={isAcme ? "Reduce manual onboarding time from 30 min to under 5 min." : "Migrate 50M records to Cloud SQL with zero downtime."}
                  version={approvedAcme ? 2 : 1}
                  status={approvedAcme ? "HEALTHY" : "NEEDS_REASSESSMENT"}
                  progress={approvedAcme ? 75 : 70}
                  successCriteria={
                    approvedAcme
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
                        ]
                  }
                />

                {/* Evidence -> Reasoning -> Recommendation Pattern */}
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
              </div>

              {/* Right Sidebar */}
              <div className="space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-teal-400">Next Best Action</span>
                  <p className="text-xs font-semibold text-slate-100">
                    {approvedAcme ? "Execute cutover dry-run test on staging replica." : "Request SSO configuration from customer security owner."}
                  </p>
                  <p className="text-[11px] text-slate-400 bg-slate-950 p-2 rounded border border-slate-800">
                    <strong>Why now:</strong> {approvedAcme ? "Validates production deployment window." : "Primary blocker gating Step 4 production rollout."}
                  </p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Blockers</span>
                  <ul className="space-y-2 text-xs">
                    <li className="p-2 bg-slate-950 rounded border border-slate-800">
                      <span className="text-amber-400 font-bold block">● SSO Configuration</span>
                      <span className="text-[10px] text-slate-400">Waiting on Customer Security Team</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: OUTCOME */}
        {activeTab === "outcome" && (
          <div className="space-y-6">
            <OutcomeCard
              customerName={activeCustomer.customerName}
              engagementName={activeCustomer.engagementName}
              outcomeStatement={isAcme ? "Reduce manual onboarding time from 30 min to under 5 min." : "Migrate 50M records to Cloud SQL with zero downtime."}
              version={approvedAcme ? 2 : 1}
              status={approvedAcme ? "HEALTHY" : "NEEDS_REASSESSMENT"}
              progress={approvedAcme ? 75 : 70}
              successCriteria={
                approvedAcme
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
                    ]
              }
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
