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
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl relative">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-teal-400" />
                <h1 className="text-xl font-bold text-slate-100">Audit Trail Timeline</h1>
              </div>
              <p className="text-xs text-slate-400">
                Immutable evidence trail of requirement changes, AI impact analysis, manager approvals, and state shifts for {activeCustomer.customerName}.
              </p>
            </div>

            <button
              onClick={() => fetchEngagementDetail(activeCustomer.id)}
              className="flex items-center gap-1.5 text-xs bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition font-medium"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-teal-400" : ""}`} />
              <span>Refresh Trail</span>
            </button>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
          {timelineList.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <Clock className="h-8 w-8 text-slate-600 mx-auto" />
              <p className="text-slate-400 text-sm">No audit trail events recorded yet for {activeCustomer.customerName}.</p>
              <p className="text-slate-600 text-xs">Events will automatically appear as work cycles, changes, and approvals are executed.</p>
            </div>
          ) : (
            <ul className="space-y-6 relative border-l-2 border-slate-800 ml-3 pl-6">
              {timelineList.map((evt) => {
                const style = getEventBadge(evt.event_type);
                return (
                  <li key={evt.id} className="relative">
                    <span className={`absolute -left-[31px] top-0 h-4 w-4 rounded-full ${style.dot} border-4 border-slate-900`} />
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${style.titleColor} uppercase tracking-wider`}>
                            {evt.title}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${style.badge}`}>
                            {evt.event_type}
                          </span>
                        </div>
                        <span className="text-slate-500 font-mono text-[11px]">{formatDate(evt.created_at)}</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {evt.description}
                      </p>
                      <div className="text-[11px] text-slate-500 font-mono flex items-center gap-3">
                        <span>Actor: {evt.actor_type}</span>
                        {evt.actor_id && <span>• ID: {evt.actor_id}</span>}
                        <span>• Ref: {evt.id}</span>
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
