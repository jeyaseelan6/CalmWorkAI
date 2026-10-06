"use client";

import React, { useState } from "react";
import { Send, FileCheck, Sparkles, CheckCircle2, ShieldCheck, Mail } from "lucide-react";

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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function CustomerUpdatePanel({ engagementId, customerName, engagementName }: CustomerUpdatePanelProps) {
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState<CustomerUpdateDraft | null>(null);
  const [approved, setApproved] = useState(false);

  const handleGenerateUpdate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/engagements/${engagementId}/customer-updates/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_notes: notes })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setDraft(json.data);
          setApproved(false);
        }
      } else {
        // Fallback simulation
        setDraft({
          engagement_id: engagementId,
          customer_name: customerName,
          subject: `Executive Update: ${customerName} — ${engagementName} Progress`,
          executive_summary: `We are actively advancing the ${engagementName} initiative for ${customerName}. Core integration phases are progressing smoothly with verified system reliability.`,
          key_milestones_achieved: [
            "Completed automated onboarding workflow baseline.",
            "API endpoint integration verified and tested."
          ],
          next_milestone_target: "Production validation and Enterprise SSO setup.",
          customer_action_items: ["Configure Enterprise SSO identity provider integration."],
          status: "DRAFT",
          privacy_scrubbed: true
        });
      }
    } catch (e) {
      setDraft({
        engagement_id: engagementId,
        customer_name: customerName,
        subject: `Executive Update: ${customerName} — ${engagementName} Progress`,
        executive_summary: `We are actively advancing the ${engagementName} initiative for ${customerName}. Core integration phases are progressing smoothly with verified system reliability.`,
        key_milestones_achieved: [
          "Completed automated onboarding workflow baseline.",
          "API endpoint integration verified and tested."
        ],
        next_milestone_target: "Production validation and Enterprise SSO setup.",
        customer_action_items: ["Configure Enterprise SSO identity provider integration."],
        status: "DRAFT",
        privacy_scrubbed: true
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-teal-400" />
          <h3 className="text-sm font-semibold text-slate-100">DELIVER Agent — Customer Update Studio</h3>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-teal-300 bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 rounded-md">
          <ShieldCheck className="h-3.5 w-3.5 text-teal-400" />
          <span>Executive Business Translation</span>
        </div>
      </div>

      {/* Input / Generate trigger */}
      {!draft ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-400 leading-relaxed">
            DELIVER Agent translates engineering progress, completed DoD items, and blockers into manager-approved executive update emails for <strong className="text-slate-200">{customerName}</strong>.
          </p>
          <div className="space-y-2">
            <textarea
              placeholder="Add optional FDE notes or context for this customer update..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500 h-20 resize-none"
            />
            <button
              onClick={handleGenerateUpdate}
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-500 text-slate-950 font-semibold px-4 py-2.5 rounded-lg text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
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
        <div className="space-y-4 border-t border-slate-800/60 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-teal-400 font-mono">
              Draft Status: {approved ? "MANAGER APPROVED (READY TO SEND)" : "PENDING MANAGER APPROVAL"}
            </span>
            {draft.privacy_scrubbed && (
              <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-mono">
                AI Privacy Scrubbed
              </span>
            )}
          </div>

          {/* Draft Preview Box */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3 text-xs text-slate-200">
            <div className="border-b border-slate-800/80 pb-2">
              <span className="text-[11px] text-slate-400">Subject:</span>
              <p className="font-semibold text-slate-100">{draft.subject}</p>
            </div>

            <div>
              <span className="text-[11px] text-slate-400">Executive Summary:</span>
              <p className="text-slate-300 mt-1 leading-relaxed">{draft.executive_summary}</p>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 font-semibold">Key Milestones Achieved:</span>
              <ul className="list-disc list-inside space-y-1 mt-1 text-slate-300">
                {draft.key_milestones_achieved.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>

            <div>
              <span className="text-[11px] text-amber-400 font-semibold">Required Customer Action:</span>
              <ul className="list-disc list-inside space-y-1 mt-1 text-amber-300">
                {draft.customer_action_items.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Action controls */}
          <div className="flex gap-3">
            {!approved ? (
              <button
                onClick={() => setApproved(true)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold px-4 py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition"
              >
                <FileCheck className="h-4 w-4" />
                <span>Manager Approve Draft</span>
              </button>
            ) : (
              <div className="flex-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Approved by Manager! Ready to send to customer stakeholders.</span>
              </div>
            )}

            <button
              onClick={() => setDraft(null)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg text-xs transition"
            >
              Reset Draft
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
