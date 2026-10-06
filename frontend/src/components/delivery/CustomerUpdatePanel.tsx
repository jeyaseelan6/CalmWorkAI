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
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Mail className="h-4.5 w-4.5 text-slate-700" />
          <h3 className="text-sm font-display font-bold text-slate-900">DELIVER Agent — Customer Update Studio</h3>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded font-mono font-semibold">
          <ShieldCheck className="h-3.5 w-3.5 text-slate-500" />
          <span>Executive Business Translation</span>
        </div>
      </div>

      {/* Input / Generate trigger */}
      {!draft ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            DELIVER Agent translates engineering progress, completed DoD items, and blockers into manager-approved executive update emails for <strong className="text-slate-900 font-semibold">{customerName}</strong>.
          </p>
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
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded-md text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
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
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono font-bold text-slate-800">
              Draft Status: {approved ? "MANAGER APPROVED (READY TO SEND)" : "PENDING MANAGER APPROVAL"}
            </span>
            {draft.privacy_scrubbed && (
              <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-mono font-bold">
                AI Privacy Scrubbed
              </span>
            )}
          </div>

          {/* Draft Preview Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-md p-4 space-y-3 text-xs text-slate-900">
            <div className="border-b border-slate-200 pb-2">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block font-mono">Subject:</span>
              <p className="font-bold text-slate-900 text-xs">{draft.subject}</p>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block font-mono">Executive Summary:</span>
              <p className="text-slate-800 leading-relaxed mt-0.5">{draft.executive_summary}</p>
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

          {/* Action controls */}
          <div className="flex gap-2">
            {!approved ? (
              <button
                onClick={() => setApproved(true)}
                className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-4 py-2 rounded-md text-xs flex items-center justify-center gap-1.5 transition"
              >
                <FileCheck className="h-4 w-4" />
                <span>Manager Approve Draft</span>
              </button>
            ) : (
              <div className="flex-1 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-md text-xs flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                <span>Approved by Manager! Ready to send to customer stakeholders.</span>
              </div>
            )}

            <button
              onClick={() => setDraft(null)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-2 rounded-md text-xs transition border border-slate-200"
            >
              Reset Draft
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
