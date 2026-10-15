"use client";

import React, { useState } from "react";
import {
  Clock,
  Filter,
  Plus,
  Send,
  AlertCircle,
  CheckCircle2,
  FileText,
  Sparkles,
  User,
  Bot,
  X
} from "lucide-react";
import { formatISTDateTime } from "@/utils/date";
import { API_BASE } from "@/utils/api";
import { useAuth } from "@/context/AuthContext";

export interface TimelineEventItem {
  id: string;
  event_type: string;
  title: string;
  description?: string | null;
  actor_type: string;
  actor_id?: string;
  created_at: string;
}

interface TimelinePanelProps {
  engagementId: string;
  customerName: string;
  timeline: TimelineEventItem[];
  onRefresh: () => void;
}

export default function TimelinePanel({
  engagementId,
  customerName,
  timeline = [],
  onRefresh
}: TimelinePanelProps) {
  const { user, isManager, token } = useAuth();

  // Filter state
  const [filterType, setFilterType] = useState<string>("ALL");

  // Worknote logging state
  const [showLogForm, setShowLogForm] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteDescription, setNoteDescription] = useState("");
  const [eventType, setEventType] = useState<"WORKNOTE" | "OBSERVATION" | "DECISION">("WORKNOTE");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const handleLogWorknote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) {
      setSubmitError("Please enter a title for the note or observation.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const authToken = token || (typeof window !== "undefined" ? localStorage.getItem("calmwork_auth_token") : null);
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      const res = await fetch(`${API_BASE}/engagements/${engagementId}/timeline/worknotes`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: noteTitle.trim(),
          description: noteDescription.trim() || undefined,
          event_type: eventType,
          actor_name: user?.name || (isManager ? "David Miller" : "Sarah Chen")
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSubmitSuccess("Worknote logged to engagement timeline and shared memory.");
        setNoteTitle("");
        setNoteDescription("");
        setShowLogForm(false);
        onRefresh();
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("calmwork-state-change", {
              detail: { engagementId, type: "WORKNOTE_LOGGED" }
            })
          );
        }
        setTimeout(() => setSubmitSuccess(null), 4000);
      } else {
        setSubmitError(json.detail || json.message || "Failed to log worknote.");
      }
    } catch (err: unknown) {
      setSubmitError((err as Error).message || "Network error logging worknote.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredEvents = timeline.filter((evt) => {
    if (filterType === "ALL") return true;
    const t = evt.event_type.toUpperCase();
    if (filterType === "WORKNOTES") {
      return t === "WORKNOTE" || t === "OBSERVATION" || t === "DECISION" || t === "DECISION_RECORDED";
    }
    if (filterType === "PLANS") {
      return t.includes("PLAN") || t.includes("OUTCOME") || t.includes("TASK") || t.includes("GOAL");
    }
    if (filterType === "DOCUMENTS") {
      return t.includes("DOCUMENT") || t.includes("INGEST") || t.includes("EVIDENCE");
    }
    if (filterType === "APPROVALS") {
      return t.includes("APPROVAL") || t.includes("DECISION") || t.includes("AUTHORIZ");
    }
    return true;
  });

  const getActorBadge = (actorType: string, actorId?: string) => {
    const act = (actorType || "").toUpperCase();
    if (act === "MANAGER") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-semibold">
          <User className="h-3 w-3 text-purple-600" />
          Manager {actorId ? `· ${actorId}` : ""}
        </span>
      );
    }
    if (act === "AI_SYSTEM" || act === "AI" || act.includes("AGENT")) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 font-semibold">
          <Bot className="h-3 w-3 text-teal-600" />
          AI System
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
        <User className="h-3 w-3 text-blue-600" />
        FDE {actorId ? `· ${actorId}` : ""}
      </span>
    );
  };

  const getEventTypeBadge = (eventType: string) => {
    const t = (eventType || "").toUpperCase();
    if (t === "WORKNOTE" || t === "OBSERVATION") {
      return (
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
          NOTE
        </span>
      );
    }
    if (t === "DECISION" || t.includes("APPROVAL")) {
      return (
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
          DECISION
        </span>
      );
    }
    if (t.includes("PLAN") || t.includes("OUTCOME")) {
      return (
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
          PLAN
        </span>
      );
    }
    if (t.includes("DOCUMENT")) {
      return (
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-800 border border-cyan-200">
          EVIDENCE
        </span>
      );
    }
    return (
      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
        {t.replace(/_/g, " ")}
      </span>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-slate-700" />
            <h2 className="text-base font-bold font-display text-slate-900">
              Engagement Audit Trail &amp; Shared Memory
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono">
              {timeline.length} Events Recorded
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Chronological audit record of architectural decisions, document evidence, plan revisions, task states, and manager approvals for <strong className="text-slate-700">{customerName}</strong>.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowLogForm(!showLogForm);
            setSubmitError(null);
          }}
          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-2xs self-start sm:self-auto"
        >
          {showLogForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          <span>{showLogForm ? "Cancel Note" : "Log Observation"}</span>
        </button>
      </div>

      {/* Success Notification */}
      {submitSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{submitSuccess}</span>
        </div>
      )}

      {/* Collapsible Fast Context Capture Form */}
      {showLogForm && (
        <form onSubmit={handleLogWorknote} className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-xs font-bold text-slate-900 uppercase font-mono flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-slate-600" />
              Fast Context Capture (Shared Memory Timeline)
            </span>
            <span className="text-[11px] text-slate-400">Recorded as authoritative event</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 block">
                Event Title *
              </label>
              <input
                type="text"
                placeholder="e.g. Customer confirmed legacy database cutover window at 02:00 IST"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 block">
                Event Classification
              </label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value as "WORKNOTE" | "OBSERVATION" | "DECISION")}
                className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="WORKNOTE">Worknote / Context</option>
                <option value="OBSERVATION">Technical Observation</option>
                <option value="DECISION">Architectural Decision</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-700 block">
              Context Details &amp; Supporting Technical Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Provide exact details, stakeholder decisions, error output, or architecture constraints..."
              value={noteDescription}
              onChange={(e) => setNoteDescription(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md p-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          {submitError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowLogForm(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-md transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !noteTitle.trim()}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              {isSubmitting ? (
                <>
                  <Sparkles className="h-3.5 w-3.5 animate-spin" />
                  <span>Logging to Shared Memory...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Commit to Timeline</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2 text-xs overflow-x-auto">
        <span className="text-slate-400 font-medium text-[11px] mr-1 flex items-center gap-1">
          <Filter className="h-3 w-3" /> Filter:
        </span>
        {[
          { id: "ALL", label: "All Events" },
          { id: "WORKNOTES", label: "Notes & Decisions" },
          { id: "PLANS", label: "Plans & Goals" },
          { id: "DOCUMENTS", label: "Evidence & Docs" },
          { id: "APPROVALS", label: "Approvals" }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterType(tab.id)}
            className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer whitespace-nowrap text-xs ${
              filterType === tab.id
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Timeline Event Feed */}
      {filteredEvents.length > 0 ? (
        <div className="relative pl-4 border-l-2 border-slate-200 space-y-5 my-2">
          {filteredEvents.map((evt) => (
            <div key={evt.id} className="relative group">
              {/* Timeline dot */}
              <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-slate-400 group-hover:bg-slate-900 transition border-2 border-white" />

              <div className="bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-lg p-3.5 transition space-y-1.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getEventTypeBadge(evt.event_type)}
                    {getActorBadge(evt.actor_type, evt.actor_id)}
                    <span className="font-semibold text-xs text-slate-900">
                      {evt.title}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono shrink-0">
                    {formatISTDateTime(evt.created_at)}
                  </span>
                </div>

                {evt.description && (
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap pl-0.5">
                    {evt.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 px-4 bg-slate-50 rounded-lg border border-dashed border-slate-200 space-y-2">
          <Clock className="h-6 w-6 text-slate-400 mx-auto" />
          <h3 className="text-xs font-semibold text-slate-700">
            {filterType === "ALL" ? "No Timeline Events Recorded Yet" : "No Events Match Current Filter"}
          </h3>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
            {filterType === "ALL"
              ? "All actions, planning revisions, document uploads, and engineering observations for this engagement will appear here chronologically."
              : "Switch filter to 'All Events' or log a new observation above."}
          </p>
        </div>
      )}
    </div>
  );
}
