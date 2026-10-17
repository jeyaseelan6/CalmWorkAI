"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { downloadCustomerUpdatePdf, printCustomerUpdateDocument } from "@/utils/pdfGenerator";
import {
  FileCheck,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Mail,
  AlertTriangle,
  Download,
  Printer,
  UserCheck,
  Send,
  Plus,
  Trash2,
  Edit3,
  Clock,
  FileText,
  Check
} from "lucide-react";
import { API_BASE } from "@/utils/api";

export interface CustomerUpdateDraft {
  engagement_id: string;
  customer_name: string;
  subject: string;
  executive_summary: string;
  key_milestones_achieved: string[];
  next_milestone_target: string;
  customer_action_items: string[];
  status: string;
  privacy_scrubbed: boolean;
}

interface CustomerUpdatePanelProps {
  engagementId: string;
  customerName: string;
  engagementName: string;
}

export default function CustomerUpdatePanel({
  engagementId,
  customerName,
  engagementName
}: CustomerUpdatePanelProps) {
  const { isManager, isFDE, user, token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submittingForApproval, setSubmittingForApproval] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState<CustomerUpdateDraft | null>(null);
  const [approved, setApproved] = useState(false);
  const [approvedBy, setApprovedBy] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [wasEdited, setWasEdited] = useState(false);

  // Sync approval state strictly from authoritative backend endpoint
  const checkApprovalStatus = useCallback(() => {
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    fetch(`${API_BASE}/engagements/${engagementId}/customer-updates/status`, { headers })
      .then((res) => {
        if (!res.ok) throw new Error("Status check failed");
        return res.json();
      })
      .then((json) => {
        if (json.success && json.data) {
          if (json.data.approved) {
            setApproved(true);
            setApprovedBy(json.data.reviewed_by || "David Miller (Engineering Manager)");
            setIsSubmitted(false);
          } else if (json.data.status === "PENDING") {
            setApproved(false);
            setApprovedBy(null);
            setIsSubmitted(true);
          } else {
            setApproved(false);
            setApprovedBy(null);
            setIsSubmitted(false);
          }
        }
      })
      .catch(() => {
        setApproved(false);
        setApprovedBy(null);
        setIsSubmitted(false);
      });
  }, [engagementId, token]);

  useEffect(() => {
    checkApprovalStatus();

    // Listen to local event
    const handleSync = (e: any) => {
      if (!e?.detail?.engagementId || e.detail.engagementId === engagementId) {
        checkApprovalStatus();
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("calmwork-state-change", handleSync);
    }

    // Listen to cross-tab BroadcastChannel
    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel("calmwork_governance_bus");
      channel.onmessage = (event) => {
        if (!event?.data?.engagementId || event.data.engagementId === engagementId) {
          checkApprovalStatus();
        }
      };
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("calmwork-state-change", handleSync);
      }
      if (channel) {
        channel.close();
      }
    };
  }, [checkApprovalStatus, engagementId]);

  const handleGenerateUpdate = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setWasEdited(false);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}/engagements/${engagementId}/customer-updates/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ raw_notes: notes })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setDraft(json.data);
          setApproved(false);
          setApprovedBy(null);
          setIsSubmitted(false);
          setIsEditingDraft(false);
          setSuccessMsg("DELIVER Agent generated customer update draft. Review and edit before sending for approval.");
        } else {
          setError(json.message || "Failed to generate AI customer update.");
          setDraft(null);
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.detail || "DELIVER Agent failed to generate update.");
        setDraft(null);
      }
    } catch (e: unknown) {
      setError((e as Error).message || "Network error while calling DELIVER Agent.");
      setDraft(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateManualDraft = () => {
    setDraft({
      engagement_id: engagementId,
      customer_name: customerName,
      subject: `Executive Update: ${customerName} — ${engagementName}`,
      executive_summary: "Summary of engineering milestones delivered and upcoming targets for this delivery cycle.",
      key_milestones_achieved: [
        "Core milestones operational according to technical specifications",
        "Integration and data verification completed"
      ],
      next_milestone_target: "Production validation and rollout scheduled for next milestone.",
      customer_action_items: [
        "Review deliverables and provide stakeholder confirmation"
      ],
      status: "DRAFT",
      privacy_scrubbed: true
    });
    setApproved(false);
    setApprovedBy(null);
    setIsSubmitted(false);
    setWasEdited(true);
    setIsEditingDraft(true);
    setError(null);
    setSuccessMsg(null);
  };

  const handleDraftFieldChange = <K extends keyof CustomerUpdateDraft>(
    field: K,
    value: CustomerUpdateDraft[K]
  ) => {
    if (!draft) return;
    setDraft({ ...draft, [field]: value });
    setApproved(false);
    setApprovedBy(null);
    setWasEdited(true);
  };

  const handleMilestoneChange = (index: number, value: string) => {
    if (!draft) return;
    const updated = [...draft.key_milestones_achieved];
    updated[index] = value;
    handleDraftFieldChange("key_milestones_achieved", updated);
  };

  const handleAddMilestone = () => {
    if (!draft) return;
    const updated = [...draft.key_milestones_achieved, "New completed milestone"];
    handleDraftFieldChange("key_milestones_achieved", updated);
  };

  const handleRemoveMilestone = (index: number) => {
    if (!draft) return;
    const updated = draft.key_milestones_achieved.filter((_, i) => i !== index);
    handleDraftFieldChange("key_milestones_achieved", updated);
  };

  const handleActionItemChange = (index: number, value: string) => {
    if (!draft) return;
    const updated = [...draft.customer_action_items];
    updated[index] = value;
    handleDraftFieldChange("customer_action_items", updated);
  };

  const handleAddActionItem = () => {
    if (!draft) return;
    const updated = [...draft.customer_action_items, "Customer review / action required"];
    handleDraftFieldChange("customer_action_items", updated);
  };

  const handleRemoveActionItem = (index: number) => {
    if (!draft) return;
    const updated = draft.customer_action_items.filter((_, i) => i !== index);
    handleDraftFieldChange("customer_action_items", updated);
  };

  const handleSubmitForApproval = async () => {
    if (!draft) return;
    setSubmittingForApproval(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}/engagements/${engagementId}/customer-updates/submit`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          subject: draft.subject,
          executive_summary: draft.executive_summary,
          key_milestones_achieved: draft.key_milestones_achieved,
          next_milestone_target: draft.next_milestone_target,
          customer_action_items: draft.customer_action_items,
          privacy_scrubbed: draft.privacy_scrubbed
        })
      });

      if (res.ok) {
        setIsSubmitted(true);
        setWasEdited(false);
        setIsEditingDraft(false);
        setSuccessMsg("Customer update report submitted for Manager approval!");

        // Broadcast cross-tab and local state change
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("calmwork-state-change", { detail: { engagementId } }));
          if ("BroadcastChannel" in window) {
            const ch = new BroadcastChannel("calmwork_governance_bus");
            ch.postMessage({ engagementId, type: "CUSTOMER_UPDATE_SUBMITTED" });
            ch.close();
          }
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.detail || "Failed to submit customer update for approval.");
      }
    } catch (e: unknown) {
      setError((e as Error).message || "Network error submitting customer update.");
    } finally {
      setSubmittingForApproval(false);
    }
  };

  const handleManagerApprove = async () => {
    setApprovalLoading(true);
    setError(null);
    setSuccessMsg(null);
    const managerName = user?.name || "David Miller (Engineering Manager)";
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}/engagements/${engagementId}/customer-updates/approve`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "APPROVE",
          actor_id: user?.id || "usr-mgr-002",
          decision_note: "Engineering Manager authorized executive customer update for client delivery."
        })
      });

      if (res.ok) {
        const json = await res.json();
        setApproved(true);
        setApprovedBy(json.data?.approved_by || managerName);
        setIsSubmitted(false);
        setWasEdited(false);
        setIsEditingDraft(false);
        setSuccessMsg("Executive report approved! Download and delivery authorized for Manager and FDE.");

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("calmwork-state-change", { detail: { engagementId } }));
          if ("BroadcastChannel" in window) {
            const ch = new BroadcastChannel("calmwork_governance_bus");
            ch.postMessage({ engagementId, type: "CUSTOMER_UPDATE_APPROVED" });
            ch.close();
          }
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.detail || "Authorization request rejected by server. Approval not granted.");
      }
    } catch (e: unknown) {
      setError((e as Error).message || "Network error communicating with approval server.");
    } finally {
      setApprovalLoading(false);
    }
  };

  const handleResetDraft = () => {
    setDraft(null);
    setApproved(false);
    setApprovedBy(null);
    setIsSubmitted(false);
    setWasEdited(false);
    setIsEditingDraft(false);
    setError(null);
    setSuccessMsg(null);
  };

  const handleDownloadPdf = async () => {
    if (!draft) return;
    setError(null);

    // Verify backend authorization
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/engagements/${engagementId}/customer-updates/pdf-status`, { headers });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.detail || "Manager approval required before PDF download is enabled.");
        setApproved(false);
        return;
      }
      const json = await res.json();
      if (!json.success || !json.data?.pdf_authorized) {
        setError("Manager approval required: Server reports PDF release is not yet authorized.");
        setApproved(false);
        return;
      }
    } catch {
      setError("Unable to verify authorization with backend server.");
      return;
    }

    downloadCustomerUpdatePdf({
      customerName,
      engagementName,
      subject: draft.subject,
      executiveSummary: draft.executive_summary,
      keyMilestonesAchieved: draft.key_milestones_achieved,
      nextMilestoneTarget: draft.next_milestone_target,
      customerActionItems: draft.customer_action_items,
      status: "APPROVED",
      isApproved: true,
      privacyScrubbed: draft.privacy_scrubbed
    });
  };

  const handlePrintPdf = async () => {
    if (!draft) return;
    setError(null);

    // Verify backend authorization
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/engagements/${engagementId}/customer-updates/pdf-status`, { headers });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.detail || "Manager approval required before viewing or printing document.");
        setApproved(false);
        return;
      }
      const json = await res.json();
      if (!json.success || !json.data?.pdf_authorized) {
        setError("Manager approval required: Server reports release is not yet authorized.");
        setApproved(false);
        return;
      }
    } catch {
      setError("Unable to verify authorization with backend server.");
      return;
    }

    printCustomerUpdateDocument({
      customerName,
      engagementName,
      subject: draft.subject,
      executiveSummary: draft.executive_summary,
      keyMilestonesAchieved: draft.key_milestones_achieved,
      nextMilestoneTarget: draft.next_milestone_target,
      customerActionItems: draft.customer_action_items,
      status: "APPROVED",
      isApproved: true,
      privacyScrubbed: draft.privacy_scrubbed
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
        <div className="flex items-center gap-2">
          <Mail className="h-4.5 w-4.5 text-slate-700 shrink-0" />
          <h3 className="text-sm font-display font-bold text-slate-900">DELIVER Agent — Customer Update Studio</h3>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded font-mono font-semibold self-start sm:self-auto">
          <ShieldCheck className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          <span>Executive Business Translation</span>
        </div>
      </div>

      {/* Input / Generate trigger when no draft */}
      {!draft ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            DELIVER Agent translates engineering progress, completed milestones, and blockers into executive update summaries for{" "}
            <strong className="text-slate-900 font-semibold">{customerName}</strong>. FDEs can generate via AI or draft manually, edit all sections, and submit for Manager sign-off.
          </p>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <textarea
              placeholder="Add optional FDE notes or context for this customer update..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-slate-400 h-20 resize-none font-medium"
            />
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <button
                onClick={handleGenerateUpdate}
                disabled={loading}
                className="flex-1 w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded-md text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                {loading ? (
                  <Sparkles className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-amber-300" />
                    <span>Generate AI Customer Update Draft</span>
                  </>
                )}
              </button>
              <button
                onClick={handleCreateManualDraft}
                disabled={loading}
                className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2 rounded-md text-xs border border-slate-300 flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <Plus className="h-3.5 w-3.5 text-slate-500" />
                <span>Create Manual Report</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 border-t border-slate-100 pt-3">
          {/* Notifications */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              {approved ? (
                <span className="font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>APPROVED BY MANAGER · READY TO DELIVER</span>
                </span>
              ) : isSubmitted ? (
                <span className="font-mono font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-blue-600" />
                  <span>SUBMITTED FOR APPROVAL · PENDING MANAGER REVIEW</span>
                </span>
              ) : wasEdited ? (
                <span className="font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded flex items-center gap-1.5">
                  <Edit3 className="h-3.5 w-3.5 text-amber-600" />
                  <span>DRAFT MODIFIED · READY TO SEND FOR APPROVAL</span>
                </span>
              ) : (
                <span className="font-mono font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-slate-500" />
                  <span>DRAFT REPORT · EDITABLE</span>
                </span>
              )}

              {draft.privacy_scrubbed && (
                <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded font-mono font-semibold">
                  AI Privacy Scrubbed
                </span>
              )}
            </div>

            {/* Quick Export Controls — Enabled for Both Roles post-approval */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrintPdf}
                disabled={!approved}
                className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition shadow-2xs ${
                  approved
                    ? "bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 cursor-pointer"
                    : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60"
                }`}
                title={approved ? "Print preview or save via browser PDF" : "Available after Engineering Manager approval"}
              >
                <Printer className="h-3.5 w-3.5 text-slate-500" />
                <span>Print / Preview</span>
              </button>
              <button
                onClick={handleDownloadPdf}
                disabled={!approved}
                className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs ${
                  approved
                    ? "bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
                    : "bg-slate-200 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60"
                }`}
                title={approved ? "Download authorized Executive Summary as PDF document" : "Available after Engineering Manager approval"}
              >
                <Download className="h-3.5 w-3.5 text-slate-200" />
                <span>Download PDF</span>
              </button>
            </div>
          </div>

          {/* Context Banner */}
          {approved ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-semibold text-emerald-900 flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Approved by {approvedBy || "David Miller (Engineering Manager)"}</span>
                </div>
                <p className="text-emerald-800 text-[11px] leading-relaxed">
                  Report is approved and authorized for customer delivery. Both the <strong>Engineering Manager</strong> and <strong>Forward-Deployed Engineer (FDE)</strong> can download or print the PDF.
                </p>
              </div>
            </div>
          ) : isSubmitted ? (
            <div className="bg-blue-50/80 border border-blue-200 rounded-md p-3 text-xs flex items-start gap-2.5">
              <Clock className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-semibold text-blue-900">Submitted for Manager Approval</div>
                <p className="text-blue-800 text-[11px] leading-relaxed">
                  The executive customer update report is currently pending Manager sign-off. Once approved, PDF download and printing will be available to both Manager and FDE.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs flex items-start gap-2.5">
              <FileText className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-semibold text-slate-900">
                  {wasEdited ? "Draft Modified — Send for Manager Approval" : "Draft Report — Review & Edit"}
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  FDE can modify any section below. When satisfied, click <strong>"Send for Manager Approval"</strong>. After approval, the report can be downloaded by either the Manager or FDE.
                </p>
              </div>
            </div>
          )}

          {/* Draft Preview / Edit Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-md p-4 space-y-4 text-xs text-slate-900">
            {/* Header controls inside box */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block font-mono">
                  Subject:
                </span>
                {isEditingDraft ? (
                  <input
                    type="text"
                    value={draft.subject}
                    onChange={(e) => handleDraftFieldChange("subject", e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-500 mt-1"
                    placeholder="Enter email / report subject..."
                  />
                ) : (
                  <p className="font-bold text-slate-900 text-xs mt-0.5">{draft.subject}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditingDraft(!isEditingDraft)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold border flex items-center gap-1.5 transition cursor-pointer shadow-2xs ${
                    isEditingDraft
                      ? "bg-slate-900 text-white border-slate-900 hover:bg-slate-800"
                      : "bg-white border-slate-300 hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  <Edit3 className="h-3 w-3" />
                  <span>{isEditingDraft ? "Done Editing" : "Edit Report"}</span>
                </button>
              </div>
            </div>

            {/* Executive Summary */}
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block font-mono">
                Executive Summary:
              </span>
              {isEditingDraft ? (
                <textarea
                  value={draft.executive_summary}
                  onChange={(e) => handleDraftFieldChange("executive_summary", e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-2.5 text-xs text-slate-900 leading-relaxed focus:outline-none focus:border-slate-500 mt-1 h-28 resize-y"
                  placeholder="Summarize engineering achievements, outcome velocity, and current focus..."
                />
              ) : (
                <p className="text-slate-800 leading-relaxed mt-0.5 whitespace-pre-wrap">{draft.executive_summary}</p>
              )}
            </div>

            {/* Key Milestones Achieved */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block font-mono">
                  Key Milestones Achieved:
                </span>
                {isEditingDraft && (
                  <button
                    type="button"
                    onClick={handleAddMilestone}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Milestone</span>
                  </button>
                )}
              </div>

              {isEditingDraft ? (
                <div className="space-y-1.5 mt-1.5">
                  {draft.key_milestones_achieved.map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={m}
                        onChange={(e) => handleMilestoneChange(i, e.target.value)}
                        className="flex-1 bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-slate-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveMilestone(i)}
                        className="text-slate-400 hover:text-red-500 p-1 cursor-pointer"
                        title="Remove milestone"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {draft.key_milestones_achieved.length === 0 && (
                    <p className="text-[11px] text-slate-400 italic">No milestones listed. Click "Add Milestone" to insert one.</p>
                  )}
                </div>
              ) : (
                <ul className="list-disc list-inside space-y-1 mt-1 text-slate-800">
                  {draft.key_milestones_achieved.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                  {draft.key_milestones_achieved.length === 0 && (
                    <li className="list-none text-slate-400 italic text-[11px]">No milestones listed.</li>
                  )}
                </ul>
              )}
            </div>

            {/* Next Milestone Target */}
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block font-mono">
                Next Milestone Target:
              </span>
              {isEditingDraft ? (
                <input
                  type="text"
                  value={draft.next_milestone_target}
                  onChange={(e) => handleDraftFieldChange("next_milestone_target", e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-slate-500 mt-1"
                  placeholder="Upcoming delivery milestone or commitment..."
                />
              ) : (
                <p className="text-slate-800 leading-relaxed mt-0.5">{draft.next_milestone_target || "None specified"}</p>
              )}
            </div>

            {/* Customer Action Items */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider block font-mono">
                  Required Customer Action Items:
                </span>
                {isEditingDraft && (
                  <button
                    type="button"
                    onClick={handleAddActionItem}
                    className="text-[10px] text-amber-800 hover:text-amber-950 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Action Item</span>
                  </button>
                )}
              </div>

              {isEditingDraft ? (
                <div className="space-y-1.5 mt-1.5">
                  {draft.customer_action_items.map((a, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={a}
                        onChange={(e) => handleActionItemChange(i, e.target.value)}
                        className="flex-1 bg-white border border-amber-300 rounded px-2 py-1 text-xs text-amber-950 focus:outline-none focus:border-amber-500 font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveActionItem(i)}
                        className="text-slate-400 hover:text-red-500 p-1 cursor-pointer"
                        title="Remove action item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {draft.customer_action_items.length === 0 && (
                    <p className="text-[11px] text-slate-400 italic">No customer action items required.</p>
                  )}
                </div>
              ) : (
                <ul className="list-disc list-inside space-y-1 mt-1 text-amber-900 font-semibold">
                  {draft.customer_action_items.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                  {draft.customer_action_items.length === 0 && (
                    <li className="list-none text-slate-400 font-normal italic text-[11px]">No customer action items required.</li>
                  )}
                </ul>
              )}
            </div>
          </div>

          {/* Action controls — Dynamic Workflow */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {/* 1. Approval / Submission Actions */}
            {isManager ? (
              !approved ? (
                <button
                  onClick={handleManagerApprove}
                  disabled={approvalLoading}
                  className="flex-1 min-w-[200px] bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-4 py-2 rounded-md text-xs flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
                  title="Authorize release so Manager or FDE can download and deliver PDF to client"
                >
                  {approvalLoading ? (
                    <Sparkles className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <FileCheck className="h-4 w-4" />
                      <span>Manager Authorize &amp; Approve Release</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="flex-1 min-w-[200px] bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-md text-xs flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span>Approved by Manager! Authorized for Manager or FDE download.</span>
                </div>
              )
            ) : (
              /* FDE view */
              !approved ? (
                <button
                  onClick={handleSubmitForApproval}
                  disabled={submittingForApproval}
                  className="flex-1 min-w-[200px] bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded-md text-xs flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
                  title="Submit this customer update report for Manager sign-off"
                >
                  {submittingForApproval ? (
                    <Sparkles className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5 text-blue-300" />
                      <span>{isSubmitted && !wasEdited ? "Re-Send for Manager Approval" : "Send for Manager Approval"}</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="flex-1 min-w-[200px] bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-md text-xs flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span>Approved by Manager! Cleared for FDE to download and deliver.</span>
                </div>
              )
            )}

            {/* 2. Download and Print Controls — Available to Both Roles Once Approved */}
            <button
              onClick={handleDownloadPdf}
              disabled={!approved}
              className={`font-semibold px-3.5 py-2 rounded-md text-xs transition border flex items-center gap-1.5 shadow-2xs ${
                approved
                  ? "bg-white hover:bg-slate-50 text-slate-800 border-slate-300 cursor-pointer"
                  : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60"
              }`}
              title={approved ? "Download Executive Summary as PDF document" : "Available after Engineering Manager approval"}
            >
              <Download className="h-4 w-4 text-slate-600" />
              <span>Download PDF</span>
            </button>

            <button
              onClick={handlePrintPdf}
              disabled={!approved}
              className={`font-semibold px-3 py-2 rounded-md text-xs transition border flex items-center gap-1.5 shadow-2xs ${
                approved
                  ? "bg-white hover:bg-slate-50 text-slate-700 border-slate-300 cursor-pointer"
                  : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60"
              }`}
              title={approved ? "Print preview or print via browser" : "Available after Engineering Manager approval"}
            >
              <Printer className="h-3.5 w-3.5 text-slate-500" />
              <span>Print</span>
            </button>

            {/* 3. Reset / New Draft */}
            <button
              onClick={handleResetDraft}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-2 rounded-md text-xs transition border border-slate-200 cursor-pointer"
              title="Clear current draft and start anew"
            >
              Reset Draft
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
