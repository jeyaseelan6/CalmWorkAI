"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { downloadCustomerUpdatePdf, printCustomerUpdateDocument } from "@/utils/pdfGenerator";
import { FileCheck, Sparkles, CheckCircle2, ShieldCheck, Mail, Lock, AlertTriangle, Download, Printer, UserCheck } from "lucide-react";

interface CustomerUpdateDraft {
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

import { API_BASE } from "@/utils/api";

export default function CustomerUpdatePanel({ engagementId, customerName, engagementName }: CustomerUpdatePanelProps) {
  const { isManager, isFDE, user, token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState<CustomerUpdateDraft | null>(null);
  const [approved, setApproved] = useState(false);
  const [approvedBy, setApprovedBy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [wasEdited, setWasEdited] = useState(false);

  // Sync approval state strictly from authoritative backend endpoint (never from localStorage)
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
        if (json.success && json.data?.approved) {
          setApproved(true);
          setApprovedBy(json.data.reviewed_by || "David Miller (Engineering Manager)");
        } else {
          setApproved(false);
          setApprovedBy(null);
        }
      })
      .catch(() => {
        setApproved(false);
        setApprovedBy(null);
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
          // New draft must always start unapproved; changing content requires reapproval
          setApproved(false);
          setApprovedBy(null);
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

  const handleDraftFieldChange = <K extends keyof CustomerUpdateDraft>(
    field: K,
    value: CustomerUpdateDraft[K]
  ) => {
    if (!draft) return;
    setDraft({ ...draft, [field]: value });
    // Invalidate approval state on edit: edited drafts must be reviewed anew
    if (approved || !wasEdited) {
      setApproved(false);
      setApprovedBy(null);
      setWasEdited(true);
    }
  };

  const handleManagerApprove = async () => {
    setApprovalLoading(true);
    setError(null);
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
        setWasEdited(false);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.detail || "Authorization request rejected by server. Approval not granted.");
        setApproved(false);
      }
    } catch (e: unknown) {
      setError((e as Error).message || "Network error communicating with approval server. Approval state unchanged.");
      setApproved(false);
    } finally {
      setApprovalLoading(false);
    }
  };

  const handleResetDraft = () => {
    setDraft(null);
    setApproved(false);
    setApprovedBy(null);
    setWasEdited(false);
    setIsEditingDraft(false);
  };

  const handleDownloadPdf = async () => {
    if (!draft) return;
    setError(null);

    // Verify backend authorization: Must have backend-confirmed approval
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/engagements/${engagementId}/customer-updates/pdf-status`, { headers });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.detail || "Manager Approval Required: The executive customer update cannot be downloaded as PDF until approved by an Engineering Manager.");
        setApproved(false);
        return;
      }
      const json = await res.json();
      if (!json.success || !json.data?.pdf_authorized) {
        setError("Manager Approval Required: Server reports PDF release is not authorized.");
        setApproved(false);
        return;
      }
    } catch {
      setError("Unable to verify authorization with backend server. PDF download blocked.");
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

    // Verify backend authorization: Must have backend-confirmed approval
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/engagements/${engagementId}/customer-updates/pdf-status`, { headers });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.detail || "Manager Approval Required: The executive customer update cannot be viewed or printed as PDF until approved by an Engineering Manager.");
        setApproved(false);
        return;
      }
      const json = await res.json();
      if (!json.success || !json.data?.pdf_authorized) {
        setError("Manager Approval Required: Server reports PDF view/print is not authorized.");
        setApproved(false);
        return;
      }
    } catch {
      setError("Unable to verify authorization with backend server. PDF view/print blocked.");
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

      {/* Input / Generate trigger */}
      {!draft ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            DELIVER Agent translates engineering progress, completed Outcome Goals, and blockers into manager-approved executive update summaries for <strong className="text-slate-900 font-semibold">{customerName}</strong>.
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
            <button
              onClick={handleGenerateUpdate}
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded-md text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <Sparkles className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Generate Executive Customer Update Draft</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 border-t border-slate-100 pt-3">
          {/* Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              {approved ? (
                <span className="font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>APPROVED BY MANAGER · RELEASE AUTHORIZED</span>
                </span>
              ) : (
                <span className="font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1.5">
                  <Lock className="h-3 w-3 text-amber-700" />
                  <span>PENDING MANAGER APPROVAL (PDF LOCKED)</span>
                </span>
              )}

              {draft.privacy_scrubbed && (
                <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded font-mono font-semibold">
                  AI Privacy Scrubbed
                </span>
              )}
            </div>

            {/* Quick Export Controls — Gated by Approval */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrintPdf}
                disabled={!approved}
                className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition shadow-2xs ${
                  approved
                    ? "bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 cursor-pointer"
                    : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60"
                }`}
                title={approved ? "Print preview or save via browser PDF" : "Manager approval required before viewing or printing as PDF"}
              >
                {approved ? <Printer className="h-3.5 w-3.5 text-slate-500" /> : <Lock className="h-3.5 w-3.5 text-slate-400" />}
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
                title={approved ? "Download authorized Executive Summary as PDF document" : "Manager approval required before downloading PDF"}
              >
                {approved ? <Download className="h-3.5 w-3.5 text-slate-200" /> : <Lock className="h-3.5 w-3.5 text-slate-400" />}
                <span>{approved ? "Download PDF" : "Download PDF (Locked)"}</span>
              </button>
            </div>
          </div>

          {/* Governance Notice Banner */}
          {wasEdited ? (
            <div className="bg-amber-50 border border-amber-300 rounded-md p-3 text-xs flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                  <span>Draft Modified — Re-Authorization Required</span>
                </div>
                <p className="text-amber-800 text-[11px] leading-relaxed">
                  Draft content has been modified from the AI baseline. In accordance with delivery governance, editing invalidates prior approvals and requires fresh Engineering Manager sign-off before PDF export can be unlocked.
                </p>
              </div>
            </div>
          ) : !approved ? (
            <div className="bg-amber-50/80 border border-amber-200/90 rounded-md p-3 text-xs flex items-start gap-2.5">
              <Lock className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                  <span>Manager Approval Required Before PDF Export</span>
                </div>
                <p className="text-amber-800 text-[11px] leading-relaxed">
                  Before downloading or viewing as PDF, an <strong>Engineering Manager</strong> must review and authorize this executive summary. Once the Manager approves, either the <strong>Engineering Manager</strong> or the <strong>FDE</strong> can download the PDF and deliver it to the customer.
                </p>
                {isFDE && (
                  <p className="text-amber-700 text-[10px] font-mono mt-1">
                    * Currently logged in as FDE. An Engineering Manager must authorize this executive report before PDF viewing or download is unlocked.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-semibold text-emerald-900 flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Manager Approved — Authorized for Client Delivery</span>
                </div>
                <p className="text-emerald-800 text-[11px] leading-relaxed">
                  Authorized by <strong>{approvedBy || "David Miller (Engineering Manager)"}</strong>. Both the <strong>Engineering Manager</strong> and <strong>Forward-Deployed Engineer (FDE)</strong> are cleared to download the PDF report.
                </p>
                <p className="text-[10px] text-emerald-700 font-mono mt-0.5">
                  * Note: CalmWork authorizes local PDF generation. No emails or notifications are sent to the customer automatically.
                </p>
              </div>
            </div>
          )}

          {/* Draft Preview / Edit Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-md p-4 space-y-3 text-xs text-slate-900">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-2">
              <div className="flex-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block font-mono">Subject:</span>
                {isEditingDraft ? (
                  <input
                    type="text"
                    value={draft.subject}
                    onChange={(e) => handleDraftFieldChange("subject", e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-500 mt-1"
                  />
                ) : (
                  <p className="font-bold text-slate-900 text-xs">{draft.subject}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditingDraft(!isEditingDraft)}
                  className="px-2 py-1 rounded text-[11px] font-medium bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 transition cursor-pointer"
                >
                  {isEditingDraft ? "Done Editing" : "Edit Text"}
                </button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={!approved}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition shadow-2xs ${
                    approved
                      ? "bg-white hover:bg-slate-100 text-blue-700 border border-slate-300 cursor-pointer"
                      : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60"
                  }`}
                  title={approved ? "Download Executive Summary PDF" : "Manager approval required before PDF download"}
                >
                  {approved ? <Download className="h-3 w-3 text-blue-600" /> : <Lock className="h-3 w-3 text-slate-400" />}
                  <span>{approved ? "Download PDF" : "PDF Locked"}</span>
                </button>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block font-mono">Executive Summary:</span>
              {isEditingDraft ? (
                <textarea
                  value={draft.executive_summary}
                  onChange={(e) => handleDraftFieldChange("executive_summary", e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-xs text-slate-900 leading-relaxed focus:outline-none focus:border-slate-500 mt-1 h-24 resize-y"
                />
              ) : (
                <p className="text-slate-800 leading-relaxed mt-0.5">{draft.executive_summary}</p>
              )}
            </div>

            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block font-mono">Key Milestones Achieved:</span>
              <ul className="list-disc list-inside space-y-1 mt-0.5 text-slate-800">
                {draft.key_milestones_achieved.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>

            <div>
              <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider block font-mono">Required Customer Action:</span>
              <ul className="list-disc list-inside space-y-1 mt-0.5 text-amber-900 font-semibold">
                {draft.customer_action_items.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Action controls — Gated by Role */}
          <div className="flex flex-wrap items-center gap-2">
            {isManager ? (
              !approved ? (
                <button
                  onClick={handleManagerApprove}
                  disabled={approvalLoading}
                  className="flex-1 min-w-[220px] bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-4 py-2 rounded-md text-xs flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
                  title="Authorize release so Manager or FDE can download and deliver PDF to client"
                >
                  {approvalLoading ? (
                    <Sparkles className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <FileCheck className="h-4 w-4" />
                      <span>{wasEdited ? "Manager Sign-Off Modified Draft" : "Manager Sign-Off & Authorize Release"}</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="flex-1 min-w-[220px] bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-md text-xs flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span>Approved by Manager! Authorized for Manager or FDE delivery.</span>
                </div>
              )
            ) : (
              !approved ? (
                <div className="flex-1 min-w-[220px] bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-md text-xs flex items-center gap-2 font-medium">
                  <Lock className="h-4 w-4 text-amber-700 shrink-0" />
                  <span>{wasEdited ? "Draft modified. Awaiting Manager re-authorization." : "Draft Generated by FDE. Awaiting Engineering Manager sign-off before PDF export is unlocked."}</span>
                </div>
              ) : (
                <div className="flex-1 min-w-[220px] bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-md text-xs flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span>Approved by Manager! Authorized for FDE to download and send to customer.</span>
                </div>
              )
            )}

            <button
              onClick={handleDownloadPdf}
              disabled={!approved}
              className={`font-semibold px-3.5 py-2 rounded-md text-xs transition border flex items-center gap-1.5 shadow-2xs ${
                approved
                  ? "bg-white hover:bg-slate-50 text-slate-800 border-slate-300 cursor-pointer"
                  : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60"
              }`}
              title={approved ? "Download Executive Summary as PDF document" : "Manager approval required before downloading PDF"}
            >
              {approved ? <Download className="h-4 w-4 text-slate-600" /> : <Lock className="h-4 w-4 text-slate-400" />}
              <span>{approved ? "Download PDF" : "Download PDF (Locked)"}</span>
            </button>

            <button
              onClick={handleResetDraft}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-2 rounded-md text-xs transition border border-slate-200 cursor-pointer"
            >
              Reset Draft
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
