"use client";

import React from "react";
import AppShell from "@/components/layout/AppShell";
import { useEngagement } from "@/context/EngagementContext";
import { Clock, ShieldCheck, AlertTriangle, FileText, CheckCircle, RefreshCw } from "lucide-react";

interface TimelineItem {
  id: string;
  event_type: string;
  title: string;
  description: string;
  actor_type: string;
  actor_id: string;
  created_at: string;
}

export default function TimelinePage() {
  const { activeCustomer, activeEngagementData, loading, fetchEngagementDetail } = useEngagement();

  const timelineList: TimelineItem[] = activeEngagementData?.timeline || [];

  const getEventBadge = (type: string) => {
    switch (type) {
      case "OUTCOME_APPROVED":
        return {
          dot: "bg-emerald-400",
          titleColor: "text-emerald-300",
          badge: "bg-emerald-950/60 border-emerald-500/40 text-emerald-400"
        };
      case "OUTCOME_PROPOSED":
      case "CHANGE_DETECTED":
        return {
          dot: "bg-amber-400",
          titleColor: "text-amber-400",
          badge: "bg-amber-950/60 border-amber-500/40 text-amber-400"
        };
      case "ENGAGEMENT_CREATED":
        return {
          dot: "bg-teal-400",
          titleColor: "text-teal-400",
          badge: "bg-teal-950/60 border-teal-500/40 text-teal-400"
        };
      case "MORNING_BRIEF_GENERATED":
        return {
          dot: "bg-blue-400",
          titleColor: "text-blue-400",
          badge: "bg-blue-950/60 border-blue-500/40 text-blue-400"
        };
      case "WORKNOTE_LOGGED":
        return {
          dot: "bg-purple-400",
          titleColor: "text-purple-400",
          badge: "bg-purple-950/60 border-purple-500/40 text-purple-400"
        };
      default:
        return {
          dot: "bg-slate-400",
          titleColor: "text-slate-300",
          badge: "bg-slate-950/60 border-slate-700 text-slate-400"
        };
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return isoString;
    }
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Calm Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-display text-slate-900">Timeline</h1>
              <span className="text-slate-300">·</span>
              <span className="text-sm text-slate-600 font-medium">{activeCustomer.customerName}</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Chronological audit trail of requirement changes, approvals, and delivery milestones
            </p>
          </div>

          <button
            onClick={() => fetchEngagementDetail(activeCustomer.id)}
            className="flex items-center gap-1.5 text-xs bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 px-3 py-1.5 rounded-md transition font-medium cursor-pointer"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin text-slate-600" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Clean Chronological List */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs">
          {timelineList.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <Clock className="h-6 w-6 text-slate-400 mx-auto" />
              <p className="text-slate-700 text-xs font-medium">No audit events recorded yet for {activeCustomer.customerName}.</p>
              <p className="text-slate-400 text-[11px]">Events will appear automatically as work cycles and approvals are logged.</p>
            </div>
          ) : (
            <ul className="relative pl-6 space-y-5 border-l border-slate-200 ml-3">
              {timelineList.map((evt) => {
                const isImportant = evt.event_type.includes("APPROVED") || evt.event_type.includes("CHANGE");
                return (
                  <li key={evt.id} className="relative">
                    <span className={`absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white ring-2 ${
                      isImportant ? "bg-blue-600 ring-blue-100" : "bg-slate-400 ring-slate-100"
                    }`} />
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${isImportant ? "text-slate-900" : "text-slate-800"}`}>
                            {evt.title}
                          </span>
                          <span className="px-2 py-0.25 rounded text-[10px] font-mono text-slate-500 bg-slate-100 border border-slate-200">
                            {evt.event_type}
                          </span>
                        </div>
                        <span className="text-slate-400 font-mono text-[11px]">{formatDate(evt.created_at)}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {evt.description}
                      </p>
                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
                        <span>Actor: {evt.actor_type}</span>
                        {evt.actor_id && <span>· ID: {evt.actor_id}</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
