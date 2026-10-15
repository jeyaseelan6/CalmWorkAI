"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Layers,
  Calendar,
  Check,
  ChevronRight,
  ChevronDown,
  Edit3,
  RotateCcw,
  FileText,
  HelpCircle,
  AlertTriangle,
  Send,
  Lock,
  ListTodo,
  Milestone as MilestoneIcon,
  Zap,
  Info,
  Target,
  CheckSquare
} from "lucide-react";
import AgentProgressStream, { AgentStreamEvent } from "./AgentProgressStream";

import { API_BASE } from "@/utils/api";

interface WorkTask {
  id: string;
  milestone_id: string;
  title: string;
  description: string;
  dependencies: string[];
  owner?: string | null;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED";
}

interface WorkMilestone {
  id: string;
  title: string;
  sequence_order: number;
  deliverables: string[];
  dependencies: string[];
  customer_decisions_required: string[];
}

interface FactAssumptionGap {
  confirmed_facts: string[];
  inferred_assumptions: string[];
  unresolved_questions_or_gaps: string[];
}

interface WorkPlanData {
  proposal_id?: string;
  engagement_id?: string;
  customer_name?: string;
  engagement_objective: string;
  outcomes: string[];
  definition_of_done: Array<{ id: string; title: string; completed: boolean } | string>;
  milestones: WorkMilestone[];
  tasks: WorkTask[];
  risks: string[];
  facts_and_assumptions: FactAssumptionGap;
  next_actions: string[];
  timeline_summary: string;
  is_provisional?: boolean;
  clarifying_questions?: string[];
  status?: string;
  generated_at?: string;
}

interface WorkPlanSectionProps {
  engagementId: string;
  customerName: string;
  initialWorkPlan?: WorkPlanData | null;
  outcomeVersion?: number;
  onPlanApproved?: (approvedPlan: WorkPlanData, newVersion: number) => void;
}

const SAMPLE_PROMPT =
  "Our customer wants to migrate their legacy application to Google Cloud within 12 weeks. We need to assess the existing architecture, identify security and compliance requirements, migrate critical workflows, validate the new environment, and prepare the customer's team for handover. Their security team must approve the architecture before production deployment.";

export default function WorkPlanSection({
  engagementId,
  customerName,
  initialWorkPlan = null,
  outcomeVersion = 1,
  onPlanApproved
}: WorkPlanSectionProps) {
  const { isManager, isFDE, token } = useAuth();

  // Active authoritative plan vs Draft proposal
  const [activePlan, setActivePlan] = useState<WorkPlanData | null>(initialWorkPlan);
  const [draftProposal, setDraftProposal] = useState<WorkPlanData | null>(null);

  // UI state
  const [showInputForm, setShowInputForm] = useState<boolean>(!initialWorkPlan);
  const [naturalLanguageInput, setNaturalLanguageInput] = useState<string>("");
  const [isProposing, setIsProposing] = useState<boolean>(false);
  const [streamEvent, setStreamEvent] = useState<AgentStreamEvent | null>(null);
  const [streamHistory, setStreamHistory] = useState<AgentStreamEvent[]>([]);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isEditingProposal, setIsEditingProposal] = useState<boolean>(false);
  const [editedObjective, setEditedObjective] = useState<string>("");
  const [expandedMilestones, setExpandedMilestones] = useState<Record<string, boolean>>({
    "ms-1": true,
    "ms-2": true,
    "ms-3": true
  });
  const [version, setVersion] = useState<number>(outcomeVersion);

  // Sync when initialWorkPlan or outcomeVersion changes
  useEffect(() => {
    setActivePlan(initialWorkPlan || null);
    setShowInputForm(!initialWorkPlan);
    setVersion(outcomeVersion);
    setDraftProposal(null);
    setStreamEvent(null);
    setStreamHistory([]);
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [initialWorkPlan, outcomeVersion, engagementId]);

  // Initial fetch of plan if not provided
  useEffect(() => {
    if (!initialWorkPlan && engagementId) {
      fetchPlan();
    }
  }, [engagementId, initialWorkPlan]);

  const fetchPlan = async () => {
    try {
      const res = await fetch(`${API_BASE}/engagements/${engagementId}/plan`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.has_plan && json.data.plan) {
          setActivePlan(json.data.plan);
          setVersion(json.data.version || 1);
          setShowInputForm(false);
        } else {
          setActivePlan(null);
          setShowInputForm(true);
        }
      }
    } catch (e) {
      console.warn("Could not fetch work plan from backend:", e);
      setActivePlan(null);
      setShowInputForm(true);
    }
  };

  const handleProposePlan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!naturalLanguageInput.trim()) {
      setErrorMsg("Please enter a description of the work before submitting.");
      return;
    }

    setIsProposing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setStreamEvent(null);
    setStreamHistory([]);

    try {
      const authToken = token || (typeof window !== "undefined" ? localStorage.getItem("calmwork_auth_token") : null) || "demo-manager-token";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      const res = await fetch(`${API_BASE}/engagements/${engagementId}/plan/propose/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          natural_language_description: naturalLanguageInput.trim(),
          session_id: engagementId
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.detail || "AI service is currently unavailable. Please verify your AI service configuration or try again shortly.");
      }

      if (!res.body) {
        throw new Error("Streaming is not supported by your browser environment.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ")) {
            try {
              const event: AgentStreamEvent = JSON.parse(trimmed.slice(6));
              if (event.type === "progress") {
                setStreamEvent(event);
                setStreamHistory((prev) => [...prev, event]);
              } else if (event.type === "complete" && (event as any).data) {
                const planData = (event as any).data;
                setDraftProposal(planData);
                setEditedObjective(planData.engagement_objective || "");
                setShowInputForm(false);
                setStreamEvent(null);
              } else if (event.type === "error") {
                setErrorMsg(event.detail || "AI service is currently unavailable. Please verify your AI service configuration or try again shortly.");
                setStreamEvent(null);
              }
            } catch (jsonErr) {
              console.warn("Failed to parse SSE line:", line, jsonErr);
            }
          }
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error generating proposal.");
      setStreamEvent(null);
    } finally {
      setIsProposing(false);
    }
  };

  const handleApprovePlan = async () => {
    if (!draftProposal) return;

    setIsApproving(true);
    setErrorMsg(null);

    try {
      const planToApprove = {
        ...draftProposal,
        engagement_objective: editedObjective || draftProposal.engagement_objective
      };

      const authToken = token || (typeof window !== "undefined" ? localStorage.getItem("calmwork_auth_token") : null) || (isManager ? "demo-manager-token" : "demo-fde-token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      const res = await fetch(`${API_BASE}/engagements/${engagementId}/plan/approve`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          plan: planToApprove,
          decision_note: isManager
            ? "Manager reviewed and approved structured work plan."
            : "FDE approved and activated execution work plan within scope."
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        const approvedPlanData = json.data.work_plan || planToApprove;
        const newVersion = json.data.version || version;
        setActivePlan(approvedPlanData);
        setVersion(newVersion);
        setDraftProposal(null);
        setSuccessMsg(`Work Plan approved and activated as authoritative state (v${newVersion})!`);
        if (onPlanApproved) {
          onPlanApproved(approvedPlanData, newVersion);
        }
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(json.detail || json.message || "Approval failed.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error approving plan.");
    } finally {
      setIsApproving(false);
    }
  };

  const toggleMilestone = (milestoneId: string) => {
    setExpandedMilestones((prev) => ({
      ...prev,
      [milestoneId]: !prev[milestoneId]
    }));
  };

  const handleToggleDod = async (dodId: string) => {
    if (!activePlan || !activePlan.definition_of_done) return;

    // Optimistic UI update
    const updatedDod = activePlan.definition_of_done.map((item, idx) => {
      if (typeof item === "string") {
        const id = `dod-${idx + 1}`;
        return { id, title: item, completed: dodId === id };
      }
      if (item.id === dodId) {
        return { ...item, completed: !item.completed };
      }
      return item;
    });

    const updatedPlan: WorkPlanData = {
      ...activePlan,
      definition_of_done: updatedDod
    };
    setActivePlan(updatedPlan);

    try {
      const res = await fetch(`${API_BASE}/engagements/${engagementId}/goals/${dodId}/toggle`, {
        method: "PATCH"
      });
      if (res.ok) {
        if (onPlanApproved) {
          onPlanApproved(updatedPlan, version);
        }
      }
    } catch (err) {
      console.warn("Failed to toggle Outcome Goal item in backend:", err);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-bold font-display text-slate-900">
              Natural-Language Work Planning
            </h2>
            {activePlan && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-semibold">
                Active Plan v{version}
              </span>
            )}
            {draftProposal && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-mono font-semibold">
                Draft Proposal (Review)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Describe scope and deliverables in natural language; Plan Agent formulates verified milestones, Outcome Goals, and task dependencies.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {activePlan && !showInputForm && !draftProposal && (
            <button
              onClick={() => {
                setShowInputForm(true);
                setNaturalLanguageInput("");
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md transition flex items-center gap-1.5 border border-slate-200 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-600" />
              <span>Revise Work Plan</span>
            </button>
          )}

          {!activePlan && !showInputForm && !draftProposal && (
            <button
              onClick={() => setShowInputForm(true)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>Plan This Engagement</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 rounded-md p-3 text-xs text-rose-800 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">{errorMsg}</div>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 text-xs text-emerald-800 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">{successMsg}</div>
        </div>
      )}

      {/* 1. NATURAL LANGUAGE INPUT FORM */}
      {showInputForm && !draftProposal && (
        <form onSubmit={handleProposePlan} className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide font-mono">
                {activePlan ? "Propose Plan Revision" : "Describe Required Work"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setNaturalLanguageInput(SAMPLE_PROMPT)}
              className="text-[11px] text-blue-600 hover:text-blue-800 font-medium underline flex items-center gap-1 cursor-pointer"
            >
              <Info className="h-3 w-3" />
              Load Example Prompt
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Work Description, Deadlines & Technical Constraints:
            </label>
            <textarea
              rows={4}
              value={naturalLanguageInput}
              onChange={(e) => setNaturalLanguageInput(e.target.value)}
              placeholder="e.g. Our customer wants to migrate their legacy application to Google Cloud within 12 weeks. We need to assess the existing architecture, identify security and compliance requirements, migrate critical workflows, validate the new environment, and prepare the customer's team for handover..."
              className="w-full text-xs p-3 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-sans text-slate-900 leading-relaxed shadow-inner"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
              <span>Privacy Guardrail active: Customer PII is scrubbed before agent evaluation.</span>
              <span>Zero hallucinated dates or owners.</span>
            </div>
          </div>

          {/* Real-time Multi-Agent Progress Stream */}
          {isProposing && (
            <AgentProgressStream
              currentEvent={streamEvent}
              history={streamHistory}
              title="Supervisor & Specialist Multi-Agent Orchestration"
            />
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            {activePlan && (
              <button
                type="button"
                onClick={() => setShowInputForm(false)}
                className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isProposing || !naturalLanguageInput.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md transition flex items-center gap-2 shadow-2xs cursor-pointer"
            >
              {isProposing ? (
                <>
                  <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Plan Agent Synthesizing Plan...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Generate Work Plan Proposal</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* 2. DRAFT PROPOSAL REVIEW & EDIT STATE */}
      {draftProposal && (
        <div className="space-y-5">
          {/* Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-amber-900 block font-mono uppercase tracking-wide">
                  Draft Proposal (Not Authoritative Until Approved)
                </span>
                <span className="text-xs text-amber-800">
                  Review the structured proposal below. You may edit the objective, review milestone dependencies, and verify assumptions before committing to authoritative state.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setDraftProposal(null)}
                className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50 cursor-pointer"
              >
                Discard Draft
              </button>
              <button
                onClick={handleApprovePlan}
                disabled={isApproving}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                {isApproving ? (
                  <>
                    <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Persisting...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Approve & Activate Plan</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Proposal Objective */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                Engagement Objective
              </span>
              <button
                onClick={() => setIsEditingProposal(!isEditingProposal)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>{isEditingProposal ? "Done Editing" : "Edit Objective"}</span>
              </button>
            </div>

            {isEditingProposal ? (
              <textarea
                rows={2}
                value={editedObjective}
                onChange={(e) => setEditedObjective(e.target.value)}
                className="w-full text-xs p-2.5 rounded border border-blue-400 bg-white font-sans text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            ) : (
              <p className="text-sm font-semibold text-slate-900 font-sans leading-snug">
                {editedObjective || draftProposal.engagement_objective}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono font-medium">
                {draftProposal.timeline_summary}
              </span>
              {draftProposal.is_provisional && (
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-mono font-medium flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Provisional (Missing inputs identified)
                </span>
              )}
            </div>
          </div>

          {/* Facts, Assumptions & Missing Gaps Triage */}
          {draftProposal.facts_and_assumptions && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Confirmed Facts */}
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 font-mono flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Confirmed Facts ({draftProposal.facts_and_assumptions.confirmed_facts?.length || 0})
                </span>
                <ul className="space-y-1 text-xs text-slate-700">
                  {draftProposal.facts_and_assumptions.confirmed_facts?.map((f, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-emerald-600 font-bold">•</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Inferred Assumptions */}
              <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-3 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 font-mono flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                  Inferred Assumptions ({draftProposal.facts_and_assumptions.inferred_assumptions?.length || 0})
                </span>
                <ul className="space-y-1 text-xs text-slate-700">
                  {draftProposal.facts_and_assumptions.inferred_assumptions?.map((a, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold">•</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Unresolved Questions & Missing Gaps */}
              <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-3 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 font-mono flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5 text-blue-600" />
                  Missing Facts & Clarifications ({draftProposal.facts_and_assumptions.unresolved_questions_or_gaps?.length || 0})
                </span>
                <ul className="space-y-1 text-xs text-slate-700">
                  {draftProposal.clarifying_questions && draftProposal.clarifying_questions.length > 0 ? (
                    draftProposal.clarifying_questions.map((q, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-blue-600 font-bold">?</span>
                        <span className="italic">{q}</span>
                      </li>
                    ))
                  ) : (
                    draftProposal.facts_and_assumptions.unresolved_questions_or_gaps?.map((g, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-blue-600 font-bold">•</span>
                        <span>{g}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* Milestones & Tasks Preview */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 font-mono flex items-center gap-2">
              <MilestoneIcon className="h-3.5 w-3.5 text-blue-600" />
              Proposed Milestones & Work Packages ({draftProposal.milestones?.length || 0})
            </h3>

            <div className="space-y-3">
              {draftProposal.milestones?.map((milestone) => {
                const milestoneTasks = draftProposal.tasks?.filter((t) => t.milestone_id === milestone.id) || [];
                const isExpanded = !!expandedMilestones[milestone.id];

                return (
                  <div
                    key={milestone.id}
                    className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-2xs"
                  >
                    <div
                      onClick={() => toggleMilestone(milestone.id)}
                      className="p-3.5 bg-slate-50 hover:bg-slate-100 transition flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center font-mono">
                          {milestone.sequence_order}
                        </span>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">{milestone.title}</h4>
                          <span className="text-[11px] text-slate-500">
                            {milestoneTasks.length} concrete work packages
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 space-y-3 border-t border-slate-200 bg-white">
                        {/* Deliverables & Dependencies */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50/50 p-2.5 rounded border border-slate-100">
                          <div>
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-1 font-mono">
                              Deliverables:
                            </span>
                            <ul className="space-y-0.5 text-slate-700">
                              {milestone.deliverables?.map((d, i) => (
                                <li key={i} className="flex items-center gap-1.5">
                                  <Check className="h-3 w-3 text-emerald-600" />
                                  <span>{d}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-1 font-mono">
                              Prerequisites & Customer Decisions:
                            </span>
                            <ul className="space-y-0.5 text-slate-700">
                              {milestone.dependencies?.map((dep, i) => (
                                <li key={i} className="flex items-center gap-1.5 text-amber-800">
                                  <Clock className="h-3 w-3 text-amber-600 shrink-0" />
                                  <span>Prerequisite: {dep}</span>
                                </li>
                              ))}
                              {milestone.customer_decisions_required?.map((dec, i) => (
                                <li key={i} className="flex items-center gap-1.5 text-purple-800">
                                  <ShieldCheck className="h-3 w-3 text-purple-600 shrink-0" />
                                  <span>Gating Decision: {dec}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Concrete Tasks — Aligned Scannable List */}
                        {milestoneTasks.length > 0 && (
                          <div className="space-y-1 pt-1">
                            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block font-mono">
                              Work Items ({milestoneTasks.length}):
                            </span>
                            <ul className="divide-y divide-slate-100 pl-3 border-l-2 border-slate-200">
                              {milestoneTasks.map((task) => (
                                <li
                                  key={task.id}
                                  className="py-2 flex items-start justify-between gap-3 text-xs"
                                >
                                  <div className="space-y-0.5 flex-1">
                                    <span className="font-medium text-slate-900 block">{task.title}</span>
                                    {task.description && (
                                      <p className="text-slate-500 text-[11px] leading-relaxed">{task.description}</p>
                                    )}
                                    {task.dependencies && task.dependencies.length > 0 && (
                                      <span className="text-[10px] text-slate-400 font-mono block">
                                        Prerequisite: {task.dependencies.join(", ")}
                                      </span>
                                    )}
                                  </div>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-600 bg-slate-100 shrink-0">
                                    {task.status}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Outcome Goals Checklist Preview */}
          {draftProposal.definition_of_done && draftProposal.definition_of_done.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 font-mono block">
                Target Outcome Goals:
              </span>
              <ul className="space-y-1 text-xs text-slate-700">
                {draftProposal.definition_of_done.map((dod, idx) => {
                  const title = typeof dod === "string" ? dod : dod.title;
                  return (
                    <li key={idx} className="flex items-center gap-2">
                      <div className="h-3.5 w-3.5 rounded border border-slate-400 bg-white" />
                      <span>{title}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Bottom Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <span className="text-xs text-slate-500">
              {isManager
                ? "Manager approval activates plan and authorizes scope commitments."
                : "FDE self-approval activates execution work plans within approved engagement scope."}
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setDraftProposal(null)}
                className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50 cursor-pointer"
              >
                Discard Draft
              </button>
              <button
                onClick={handleApprovePlan}
                disabled={isApproving}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                {isApproving ? (
                  <>
                    <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Persisting...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Approve & Activate Plan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. ACTIVE APPROVED AUTHORITATIVE WORK STATE */}
      {activePlan && !draftProposal && !showInputForm && (
        <div className="space-y-5">
          {/* Active Objective & Timeline */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                Active Objective
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono font-semibold">
                Authoritative Work State (v{version})
              </span>
            </div>
            <p className="text-sm font-bold text-slate-900 font-sans leading-snug">
              {activePlan.engagement_objective}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono font-medium">
                {activePlan.timeline_summary}
              </span>
              {activePlan.is_provisional && (
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-mono font-medium">
                  Provisional Plan
                </span>
              )}
            </div>
          </div>

          {/* Target Measurable Outcomes */}
          {activePlan.outcomes && activePlan.outcomes.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono flex items-center gap-1.5">
                  <Target className="h-4 w-4 text-emerald-600" />
                  Target Measurable Outcomes ({activePlan.outcomes.length})
                </span>
                <span className="text-[11px] text-slate-500 font-mono">Bound to Outcome v{version}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                {activePlan.outcomes.map((outcome, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-md bg-emerald-50/50 border border-emerald-100 flex items-start gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="text-slate-800 font-medium leading-snug">{outcome}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Target Outcome Goals Interactive Contract Checklist */}
          {activePlan.definition_of_done && activePlan.definition_of_done.length > 0 && (() => {
            const dodItems = activePlan.definition_of_done.map((item, idx) => {
              if (typeof item === "string") {
                return { id: `dod-${idx + 1}`, title: item, completed: false };
              }
              return item;
            });
            const completedCount = dodItems.filter((d) => d.completed).length;
            const pct = Math.round((completedCount / dodItems.length) * 100);

            return (
              <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-blue-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
                      Outcome Goals ({dodItems.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 font-mono">
                      {completedCount} of {dodItems.length} completed
                    </span>
                    <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded border ${
                      pct === 100
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-blue-50 text-blue-800 border-blue-200"
                    }`}>
                      {pct}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200/50">
                  <div
                    className="bg-blue-600 h-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Interactive Checklist */}
                <ul className="space-y-1.5 pt-1">
                  {dodItems.map((item) => (
                    <li
                      key={item.id}
                      onClick={() => handleToggleDod(item.id)}
                      className={`flex items-start gap-2.5 p-2 rounded-md border text-xs cursor-pointer transition ${
                        item.completed
                          ? "bg-slate-50/80 border-slate-200 text-slate-500"
                          : "bg-white hover:bg-blue-50/40 border-slate-200 hover:border-blue-200 text-slate-900"
                      }`}
                    >
                      <button
                        type="button"
                        className="mt-0.5 shrink-0 focus:outline-none"
                      >
                        {item.completed ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <div className="h-4 w-4 rounded border-2 border-slate-300 hover:border-blue-500 transition" />
                        )}
                      </button>
                      <div className="flex-1">
                        <span className={`leading-snug block ${item.completed ? "line-through text-slate-400" : "font-medium"}`}>
                          {item.title}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        {item.completed ? "Verified" : "Pending"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}

          {/* Confirmed Facts vs Inferred Assumptions Triage */}
          {activePlan.facts_and_assumptions && (
            ((activePlan.facts_and_assumptions.confirmed_facts && activePlan.facts_and_assumptions.confirmed_facts.length > 0) ||
             (activePlan.facts_and_assumptions.inferred_assumptions && activePlan.facts_and_assumptions.inferred_assumptions.length > 0)) && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                  Verified Scope Triage & Planning Assumptions
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {activePlan.facts_and_assumptions.confirmed_facts && activePlan.facts_and_assumptions.confirmed_facts.length > 0 && (
                    <div className="bg-white p-2.5 rounded border border-slate-200 space-y-1">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase font-mono block">
                        Confirmed Ground Truth Facts:
                      </span>
                      <ul className="space-y-1 text-slate-700 text-[11px]">
                        {activePlan.facts_and_assumptions.confirmed_facts.map((fact, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-emerald-600 font-bold">•</span>
                            <span>{fact}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {activePlan.facts_and_assumptions.inferred_assumptions && activePlan.facts_and_assumptions.inferred_assumptions.length > 0 && (
                    <div className="bg-white p-2.5 rounded border border-slate-200 space-y-1">
                      <span className="text-[10px] font-bold text-blue-700 uppercase font-mono block">
                        Inferred Planning Assumptions:
                      </span>
                      <ul className="space-y-1 text-slate-700 text-[11px]">
                        {activePlan.facts_and_assumptions.inferred_assumptions.map((assump, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-blue-600 font-bold">•</span>
                            <span>{assump}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {/* Active Milestones & Tasks */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 font-mono flex items-center gap-2">
                <MilestoneIcon className="h-3.5 w-3.5 text-blue-600" />
                Active Milestones & Delivery Stages ({activePlan.milestones?.length || 0})
              </h3>
              <span className="text-[11px] text-slate-500">
                Shared state active across UNDERSTAND, KNOW, MOVE & DELIVER
              </span>
            </div>

            <div className="space-y-3">
              {activePlan.milestones?.map((milestone) => {
                const milestoneTasks = activePlan.tasks?.filter((t) => t.milestone_id === milestone.id) || [];
                const isExpanded = !!expandedMilestones[milestone.id];

                return (
                  <div
                    key={milestone.id}
                    className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-2xs"
                  >
                    <div
                      onClick={() => toggleMilestone(milestone.id)}
                      className="p-3.5 bg-slate-50 hover:bg-slate-100 transition flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center font-mono">
                          {milestone.sequence_order}
                        </span>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">{milestone.title}</h4>
                          <span className="text-[11px] text-slate-500">
                            {milestoneTasks.length} active tasks
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 space-y-3 border-t border-slate-200 bg-white">
                        {/* Deliverables & Dependencies */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50/50 p-2.5 rounded border border-slate-100">
                          <div>
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-1 font-mono">
                              Deliverables:
                            </span>
                            <ul className="space-y-0.5 text-slate-700">
                              {milestone.deliverables?.map((d, i) => (
                                <li key={i} className="flex items-center gap-1.5">
                                  <Check className="h-3 w-3 text-emerald-600" />
                                  <span>{d}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-1 font-mono">
                              Prerequisites & Gating Decisions:
                            </span>
                            <ul className="space-y-0.5 text-slate-700">
                              {milestone.dependencies?.map((dep, i) => (
                                <li key={i} className="flex items-center gap-1.5 text-amber-800">
                                  <Clock className="h-3 w-3 text-amber-600 shrink-0" />
                                  <span>Prerequisite: {dep}</span>
                                </li>
                              ))}
                              {milestone.customer_decisions_required?.map((dec, i) => (
                                <li key={i} className="flex items-center gap-1.5 text-purple-800">
                                  <ShieldCheck className="h-3 w-3 text-purple-600 shrink-0" />
                                  <span>Gating Decision: {dec}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Concrete Tasks — Aligned Scannable List */}
                        {milestoneTasks.length > 0 && (
                          <div className="space-y-1 pt-1">
                            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block font-mono">
                              Work Items ({milestoneTasks.length}):
                            </span>
                            <ul className="divide-y divide-slate-100 pl-3 border-l-2 border-slate-200">
                              {milestoneTasks.map((task) => (
                                <li
                                  key={task.id}
                                  className="py-2 flex items-start justify-between gap-3 text-xs"
                                >
                                  <div className="space-y-0.5 flex-1">
                                    <span className="font-medium text-slate-900 block">{task.title}</span>
                                    {task.description && (
                                      <p className="text-slate-500 text-[11px] leading-relaxed">{task.description}</p>
                                    )}
                                    {task.dependencies && task.dependencies.length > 0 && (
                                      <span className="text-[10px] text-slate-400 font-mono block">
                                        Prerequisite: {task.dependencies.join(", ")}
                                      </span>
                                    )}
                                  </div>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-200/50 shrink-0">
                                    {task.status}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Triaged Assumptions and Next Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activePlan.next_actions && activePlan.next_actions.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-blue-600" />
                  Recommended Next Actions
                </span>
                <ul className="space-y-1 text-xs text-slate-700">
                  {activePlan.next_actions.map((act, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-blue-600 font-bold">•</span>
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {activePlan.risks && activePlan.risks.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 font-mono flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  Identified Delivery Risks
                </span>
                <ul className="space-y-1 text-xs text-slate-700">
                  {activePlan.risks.map((risk, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold">•</span>
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Bridge to Deliver Agent */}
          <div className="bg-slate-900 text-white rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded bg-white/10 flex items-center justify-center shrink-0">
                <Send className="h-4 w-4 text-blue-300" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">
                  Next Step: Draft Executive Customer Update
                </p>
                <p className="text-xs text-slate-300">
                  DELIVER Agent can aggregate these milestones into an executive report for Manager sign-off and PDF release.
                </p>
              </div>
            </div>
            <a
              href="/delivery"
              className="bg-white hover:bg-slate-100 text-slate-900 font-semibold px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 transition shrink-0 self-start sm:self-auto"
            >
              <span>Open Deliver Agent</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
