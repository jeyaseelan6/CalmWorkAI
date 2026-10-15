"use client";

import React, { useState } from "react";
import { Building2, X, Plus, AlertTriangle, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEngagement } from "@/context/EngagementContext";
import { useAuth } from "@/context/AuthContext";

interface CreateEngagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateEngagementModal({ isOpen, onClose }: CreateEngagementModalProps) {
  const router = useRouter();
  const { createEngagement } = useEngagement();
  const { isManager } = useAuth();

  const [customerName, setCustomerName] = useState("");
  const [engagementName, setEngagementName] = useState("");
  const [description, setDescription] = useState("");
  const [outcomeStatement, setOutcomeStatement] = useState("");
  const [criteria1, setCriteria1] = useState("Discovery & baseline architecture completed");
  const [criteria2, setCriteria2] = useState("Core integration pipeline operational");
  const [criteria3, setCriteria3] = useState("Production verification and Outcome Goals signoff");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManager) {
      setErrorMsg("Manager role required: Creating new customer engagements is restricted to Engineering Managers.");
      return;
    }
    if (!customerName.trim() || !engagementName.trim()) {
      setErrorMsg("Customer name and initiative title are required.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const res = await createEngagement({
      customerName: customerName.trim(),
      engagementName: engagementName.trim(),
      description: description.trim(),
      initialOutcomeStatement: outcomeStatement.trim(),
      successCriteria: [criteria1, criteria2, criteria3].filter((c) => c.trim().length > 0)
    });

    setSubmitting(false);

    if (res.success) {
      setSuccessMsg(`Engagement for ${customerName} initialized! Navigating to workspace...`);
      const createdId = res.data?.id;
      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
        setCustomerName("");
        setEngagementName("");
        setDescription("");
        setOutcomeStatement("");
        if (createdId) {
          router.push(`/engagements/${createdId}`);
        }
      }, 800);
    } else {
      setErrorMsg(res.error || "Failed to create engagement.");
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-engagement-title"
      onClick={onClose}
    >
      <div 
        className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-lg max-h-[92dvh] overflow-y-auto animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-blue-50 text-blue-600">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h3 id="create-engagement-title" className="text-sm font-bold font-display text-slate-900">Create New Customer Engagement</h3>
              <p className="text-[11px] text-slate-500">Manager &amp; FDE Grounding: Immediately syncs to workspace &amp; daily work sequence</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-md transition cursor-pointer"
            aria-label="Close create engagement modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleCreate} className="p-6 space-y-4">
          {!isManager && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Manager Role Required</strong>
                <span>Only Engineering Managers can initialize new customer engagements. FDEs operate within authorized customer workspaces.</span>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800">
              {successMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 block uppercase font-mono">
                Customer Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Acme Corp"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 block uppercase font-mono">
                Initiative Title *
              </label>
              <input
                type="text"
                placeholder="e.g. Automated Onboarding Flow"
                value={engagementName}
                onChange={(e) => setEngagementName(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 block uppercase font-mono">
              Target Outcome Statement
            </label>
            <textarea
              placeholder="e.g. Reduce manual customer setup time from 30 min to under 5 min with verified SSO."
              value={outcomeStatement}
              onChange={(e) => setOutcomeStatement(e.target.value)}
              rows={2}
              className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 block uppercase font-mono">
              Short Description & Scope
            </label>
            <input
              type="text"
              placeholder="e.g. Multi-system identity integration and API provisioning."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div className="space-y-2 pt-1 border-t border-slate-100">
            <label className="text-[11px] font-bold text-slate-700 block uppercase font-mono">
              Initial Outcome Goals (Success Criteria)
            </label>
            <input
              type="text"
              value={criteria1}
              onChange={(e) => setCriteria1(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md p-1.5 text-xs text-slate-800"
            />
            <input
              type="text"
              value={criteria2}
              onChange={(e) => setCriteria2(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md p-1.5 text-xs text-slate-800"
            />
            <input
              type="text"
              value={criteria3}
              onChange={(e) => setCriteria3(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md p-1.5 text-xs text-slate-800"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 pb-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 min-h-[44px] text-xs text-slate-600 hover:text-slate-800 transition cursor-pointer font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !isManager}
              title={!isManager ? "Manager role required to create engagements" : "Create customer engagement"}
              className="px-4 py-2 min-h-[44px] bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-md transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              {!isManager ? <Lock className="h-3.5 w-3.5 text-slate-400" /> : <Plus className="h-3.5 w-3.5" />}
              <span>{submitting ? "Creating..." : !isManager ? "Manager Role Required" : "Create Engagement"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
