"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Sparkles, 
  Target, 
  ShieldCheck, 
  BookOpen, 
  Send, 
  CheckCircle2, 
  Lock, 
  ArrowRight,
  Check
} from "lucide-react";
import { useEngagement } from "@/context/EngagementContext";
import { useAuth } from "@/context/AuthContext";

interface AiLifecycleTrackerProps {
  engagementId?: string;
  customerName?: string;
}

export default function AiLifecycleTracker({ 
  engagementId, 
  customerName 
}: AiLifecycleTrackerProps) {
  const pathname = usePathname();
  const { activeCustomer, activeEngagementData, approvedAcme } = useEngagement();
  const { isManager, isFDE } = useAuth();

  const id = engagementId || activeCustomer.id;
  const clientName = customerName || activeCustomer.customerName;
  const isAcme = id === "eng-acme-001";

  // Check deliver approval state from local or backend
  const isDeliveryApproved = React.useMemo(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(`cu_approved_${id}`) === "true";
    }
    return false;
  }, [id, approvedAcme]);

  const stages = [
    {
      id: "plan",
      number: "1",
      agent: "PLAN Agent",
      label: "Work Plan & Outcome Goals",
      desc: "Decompose goals into structured milestones & tasks",
      href: `/engagements/${id}?tab=plan`,
      activeMatch: pathname?.includes("/engagements") && (!pathname?.includes("tab") || pathname?.includes("plan")),
      icon: Target,
      statusBadge: isAcme && approvedAcme ? "Outcome Goals v2 Active" : "Outcome Goals v1 Active",
      statusColor: "text-emerald-700 bg-emerald-50 border-emerald-200",
      isComplete: true,
    },
    {
      id: "supervisor",
      number: "2",
      agent: "SUPERVISOR Agent",
      label: "Risk & Guardrails",
      desc: "Continuous drift detection & privacy containment",
      href: "/supervisor",
      activeMatch: pathname === "/supervisor",
      icon: ShieldCheck,
      statusBadge: "Guardrail Active",
      statusColor: "text-blue-700 bg-blue-50 border-blue-200",
      isComplete: true,
    },
    {
      id: "knowledge",
      number: "3",
      agent: "KNOWLEDGE Agent",
      label: "Architecture RAG",
      desc: "Grounded semantic retrieval from technical specs",
      href: "/knowledge",
      activeMatch: pathname === "/knowledge",
      icon: BookOpen,
      statusBadge: "Specs Grounded",
      statusColor: "text-purple-700 bg-purple-50 border-purple-200",
      isComplete: true,
    },
    {
      id: "deliver",
      number: "4",
      agent: "DELIVER Agent",
      label: "Executive PDF Release",
      desc: "Summarize milestones with manager approval gate",
      href: "/delivery",
      activeMatch: pathname === "/delivery",
      icon: Send,
      statusBadge: isDeliveryApproved ? "Manager Approved · PDF Ready" : "Manager Sign-off Gate",
      statusColor: isDeliveryApproved 
        ? "text-emerald-700 bg-emerald-50 border-emerald-200" 
        : "text-amber-700 bg-amber-50 border-amber-200",
      isComplete: isDeliveryApproved,
    },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-slate-900 text-white flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              End-to-End Gen AI Delivery Lifecycle
            </h3>
            <p className="text-xs text-slate-500">
              Cohesive agent workflow executing for <strong className="text-slate-800">{clientName}</strong>
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
          4 Integrated Agents &middot; Human-in-the-Loop
        </span>
      </div>

      {/* Responsive Lifecycle Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {stages.map((stg, idx) => {
          const Icon = stg.icon;
          const isCurrentPage = stg.activeMatch;

          return (
            <Link
              key={stg.id}
              href={stg.href}
              className={`p-3 rounded-lg border transition-all text-left relative flex flex-col justify-between group ${
                isCurrentPage
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-slate-50 hover:bg-white border-slate-200 hover:border-slate-300 text-slate-800"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                    isCurrentPage 
                      ? "bg-white/20 text-white" 
                      : "bg-slate-200 text-slate-700"
                  }`}>
                    Stage {stg.number}
                  </span>

                  <span className={`text-xs px-2 py-0.5 rounded border font-medium ${
                    isCurrentPage 
                      ? "bg-white/10 text-slate-100 border-white/20" 
                      : stg.statusColor
                  }`}>
                    {stg.statusBadge}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 mt-2">
                  <Icon className={`h-4 w-4 shrink-0 ${isCurrentPage ? "text-blue-300" : "text-slate-600 group-hover:text-slate-900"}`} />
                  <span className="text-xs font-bold leading-tight block">
                    {stg.agent}
                  </span>
                </div>

                <p className={`text-xs mt-1 leading-snug line-clamp-2 ${
                  isCurrentPage ? "text-slate-300" : "text-slate-600"
                }`}>
                  {stg.desc}
                </p>
              </div>

              <div className="pt-2 mt-2 border-t border-dashed border-slate-200/50 flex items-center justify-between">
                <span className={`text-xs font-medium ${isCurrentPage ? "text-blue-300" : "text-blue-600 group-hover:underline"}`}>
                  Open Workspace
                </span>
                <ArrowRight className={`h-3 w-3 ${isCurrentPage ? "text-blue-300" : "text-slate-400 group-hover:text-blue-600"}`} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
