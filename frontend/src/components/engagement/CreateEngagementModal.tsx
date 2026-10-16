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
  const [outcomeStatement, setOutcomeStatement] = useState("");
  const [description, setDescription] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
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
      setErrorMsg("Manager role required: Creating workspaces is restricted to Engineering Managers.");
      return;
    }
    if (!customerName.trim() || !engagementName.trim()) {
      setErrorMsg("Customer name and initiative title are required.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const criteria = showAdvanced
      ? [criteria1, criteria2, criteria3].filter((c) => c.trim().length > 0)
      : [criteria1, criteria2, criteria3];

    const res = await createEngagement({
      customerName: customerName.trim(),
      engagementName: engagementName.trim(),
      description: description.trim() || `${customerName} initiative for ${engagementName}`,
      initialOutcomeStatement: outcomeStatement.trim() || `Achieve successful outcome for ${engagementName}.`,
      successCriteria: criteria
    });

    setSubmitting(false);

    if (res.success) {
      setSuccessMsg(`Workspace created! Opening...`);
      const createdId = res.data?.id;
      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
        setCustomerName("");
        setEngagementName("");
        setDescription("");
        setOutcomeStatement("");
        setShowAdvanced(false);
        if (createdId) {
          router.push(`/engagements/${createdId}`);
        }
      }, 600);
    } else {
      setErrorMsg(res.error || "Failed to create workspace.");
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 transition-all"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-workspace-title"
      onClick={onClose}
    >
      <div 
        className="bg-white border border-slate-200/80 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fadeIn transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Minimalist Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h3 id="create-workspace-title" className="text-sm font-semibold text-slate-900">
                New Workspace
              </h3>
              <p className="text-xs text-slate-500">Initialize a customer workspace and target outcome.</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Minimalist Form */}
        <form onSubmit={handleCreate} className="p-5 space-y-3.5">
          {!isManager && (
            <div className="p-2.5 bg-amber-50 border border-amber-200/70 rounded-lg text-xs text-amber-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Manager role required to create new customer workspaces.</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200/70 rounded-lg text-xs text-rose-700">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200/70 rounded-lg text-xs text-emerald-800">
              {successMsg}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Customer Name</label>
            <input
              type="text"
              placeholder="e.g. ApexLogix or Acme Health"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
              className="w-full bg-slate-50/70 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Initiative Title</label>
            <input
              type="text"
              placeholder="e.g. Modern Inventory Routing"
              value={engagementName}
              onChange={(e) => setEngagementName(e.target.value)}
              required
              className="w-full bg-slate-50/70 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              Target Outcome Statement <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              placeholder="e.g. Cut manual setup time from 30m to <5m with verified SSO."
              value={outcomeStatement}
              onChange={(e) => setOutcomeStatement(e.target.value)}
              rows={2}
              className="w-full bg-slate-50/70 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition resize-none"
            />
          </div>

          {/* Optional Collapsible Criteria & Scope */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer transition"
            >
              <span>{showAdvanced ? "– Hide additional details" : "+ Add scope & success criteria (optional)"}</span>
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3 pt-3 border-t border-slate-100 animate-fadeIn">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Short Scope Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Multi-system identity integration and routing."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">Success Criteria (Goals)</label>
                  <input
                    type="text"
                    value={criteria1}
                    onChange={(e) => setCriteria1(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                  />
                  <input
                    type="text"
                    value={criteria2}
                    onChange={(e) => setCriteria2(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                  />
                  <input
                    type="text"
                    value={criteria3}
                    onChange={(e) => setCriteria3(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !isManager}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {!isManager ? <Lock className="h-3.5 w-3.5 text-slate-400" /> : <Plus className="h-3.5 w-3.5" />}
              <span>{submitting ? "Creating..." : !isManager ? "Manager Required" : "Create Workspace"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
