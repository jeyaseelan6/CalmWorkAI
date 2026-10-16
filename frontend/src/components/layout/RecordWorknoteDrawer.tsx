"use client";

import React, { useState } from "react";
import { X, Plus, FileText, CheckCircle2, MessageSquare, AlertCircle, Sparkles } from "lucide-react";
import { useEngagement } from "@/context/EngagementContext";
import { useAuth } from "@/context/AuthContext";

interface RecordWorknoteDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

import { API_BASE } from "@/utils/api";

export default function RecordWorknoteDrawer({ isOpen, onClose }: RecordWorknoteDrawerProps) {
  const { activeCustomer } = useEngagement();
  const { user, token, role } = useAuth();
  const [eventType, setEventType] = useState("WORKNOTE");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setIsSubmitting(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/engagements/${activeCustomer.id}/timeline/worknotes`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          event_type: eventType,
          title: title.trim(),
          description: description.trim(),
          actor_name: user?.name || (role === "MANAGER" ? "Engineering Manager" : "FDE User")
        })
      });

      if (res.ok) {
        setSuccessMessage("Context captured successfully in shared memory!");
        if (typeof window !== "undefined") {
          localStorage.setItem(`brief_invalidated_${activeCustomer.id}`, Date.now().toString());
          window.dispatchEvent(new CustomEvent("calmwork-state-change", { detail: { engagementId: activeCustomer.id, type: "WORKNOTE" } }));
        }
        setTimeout(() => {
          setSuccessMessage("");
          setTitle("");
          setDescription("");
          onClose();
        }, 1200);
      }
    } catch (err) {
      console.error("Failed to record worknote:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-2xs flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-worknote-title"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-white border-l border-slate-200 h-full max-h-[100dvh] flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-900 text-white rounded">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <h2 id="record-worknote-title" className="text-sm font-bold text-slate-900 font-display">Record Work Context</h2>
              <p className="text-[11px] text-slate-500 font-mono">FDE Shared Memory Capture</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition cursor-pointer"
            aria-label="Close work context drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 flex-1 overflow-y-auto text-xs">
          {successMessage ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-center space-y-1">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto" />
              <p className="font-semibold text-xs">{successMessage}</p>
              <p className="text-[11px] text-emerald-600">All 5 specialist capabilities (PLAN, KNOW, MOVE, DELIVER, SUPPORT) now reflect this reality.</p>
            </div>
          ) : (
            <>
              {/* Event Type Category Selector */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-800 uppercase tracking-wider text-[10px] block">
                  Context Category
                </label>
                <div className="grid grid-cols-2 gap-1.5 font-medium text-slate-700">
                  {[
                    { id: "WORKNOTE", label: "Worknote", icon: FileText },
                    { id: "CUSTOMER_INPUT", label: "Customer Input", icon: MessageSquare },
                    { id: "DECISION", label: "Decision", icon: CheckCircle2 },
                    { id: "OBSERVATION", label: "Observation", icon: AlertCircle }
                  ].map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = eventType === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setEventType(cat.id)}
                        className={`p-2.5 min-h-[44px] rounded border text-left flex items-center gap-2 transition cursor-pointer ${
                          isSelected
                            ? "bg-slate-900 text-white border-slate-900 font-semibold shadow-2xs"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <Icon className={`h-3.5 w-3.5 ${isSelected ? "text-white" : "text-slate-500"}`} />
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title Field */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-800 uppercase tracking-wider text-[10px] block">
                  Context Title / Headline
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Security team requested SAML 2.0 OAuth credentials"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2.5 min-h-[44px] border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 text-xs bg-slate-50/50"
                />
              </div>

              {/* Detailed Description Field */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-800 uppercase tracking-wider text-[10px] block">
                  Detailed Context & Evidence
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder="Record what happened, customer feedback, decisions made, or technical progress..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 text-xs bg-slate-50/50 resize-none"
                />
              </div>

              {/* Shared Memory Insight Card */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-900 font-semibold">
                  <Sparkles className="h-3.5 w-3.5 text-slate-700" />
                  <span>Shared Memory Protocol</span>
                </div>
                <p className="leading-relaxed">
                  Submitting this context updates the authoritative workspace timeline. All specialists (PLAN, KNOW, MOVE, DELIVER, SUPPORT) will read this new evidence immediately.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 min-h-[44px] border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 min-h-[44px] bg-slate-900 hover:bg-slate-800 text-white rounded-md font-semibold flex items-center gap-1.5 transition shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Persisting..." : "Save to Shared Memory"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
