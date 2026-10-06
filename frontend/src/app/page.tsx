"use client";

import React, { useState, useEffect } from "react";
import AppShell, { CustomerEngagement } from "@/components/layout/AppShell";
import OutcomeCard from "@/components/engagement/OutcomeCard";
import ChangeImpactCard from "@/components/intelligence/ChangeImpactCard";
import WorkCycleStepper from "@/components/engagement/WorkCycleStepper";
import KnowledgePanel from "@/components/knowledge/KnowledgePanel";
import { CheckCircle, Sparkles, Building2, Clock, RefreshCw } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface ApiEngagement {
  id: string;
  customer_name: string;
  name: string;
  description: string;
  status: string;
  progress: number;
  current_work_cycle: string;
  current_outcome_id: string;
  current_outcome: string;
  version: number;
  success_criteria: Array<{ id: string; title: string; completed: boolean }>;
}

export default function Home() {
  const [customers, setCustomers] = useState<CustomerEngagement[]>([
    {
      id: "eng-acme-001",
      customerName: "Acme Corp",
      engagementName: "Onboarding Modernization",
      status: "NEEDS_REASSESSMENT"
    },
    {
      id: "eng-globex-002",
      customerName: "Globex Corp",
      engagementName: "Legacy Data Migration",
      status: "HEALTHY"
    }
  ]);

  const [activeCustomer, setActiveCustomer] = useState<CustomerEngagement>(customers[0]);
  const [activeEngagementData, setActiveEngagementData] = useState<any>(null);
  const [nextActionData, setNextActionData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [approvedAcme, setApprovedAcme] = useState(false);

  // Fetch engagement detail from backend
  const fetchEngagementDetail = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/engagements/${id}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setActiveEngagementData(json.data);
          if (json.data.outcome?.version >= 2) {
            setApprovedAcme(true);
          }
        }
      }
      // Fetch Next Best Action from MOVE Agent endpoint
      const nextRes = await fetch(`${API_BASE}/engagements/${id}/next-action`);
      if (nextRes.ok) {
        const nextJson = await nextRes.json();
        if (nextJson.success && nextJson.data) {
          setNextActionData(nextJson.data);
        }
      }
    } catch (e) {
      console.warn("Backend server not reachable, using local engagement state fallback.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEngagementDetail(activeCustomer.id);
  }, [activeCustomer.id]);

  const handleApproveChange = async () => {
    try {
      const res = await fetch(`${API_BASE}/engagements/${activeCustomer.id}/approvals/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", actor_id: "manager_user_1" })
      });
      if (res.ok) {
        setApprovedAcme(true);
        fetchEngagementDetail(activeCustomer.id);
      } else {
        setApprovedAcme(true);
      }
    } catch (e) {
      setApprovedAcme(true);
    }
  };

  const isAcme = activeCustomer.id === "eng-acme-001";
  const currentStepNumber = isAcme ? 4 : 5;

  return (
    <AppShell
      activeCustomer={activeCustomer}
      onSelectCustomer={(cust) => setActiveCustomer(cust)}
      availableCustomers={customers}
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Header Summary */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-teal-400" />
              <h1 className="text-xl font-bold text-slate-100">{activeCustomer.customerName} Cockpit</h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Outcome & execution intelligence for {activeCustomer.engagementName}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchEngagementDetail(activeCustomer.id)}
              className="flex items-center gap-1.5 text-xs bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 hover:border-slate-700 px-3 py-1.5 rounded-lg transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-teal-400" : ""}`} />
              <span>Sync REST API</span>
            </button>

            {isAcme && approvedAcme && (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-3 py-1.5 rounded-lg">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                <span>Manager approved outcome DoD transition to Version 2 for {activeCustomer.customerName}.</span>
              </div>
            )}
          </div>
        </div>

        {/* 6 FDE Engagement Work Cycles Stepper */}
        <WorkCycleStepper
          currentStepNumber={currentStepNumber}
          customerName={activeCustomer.customerName}
        />

        {/* Current Customer Engagement Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Outcome Card */}
            {isAcme ? (
              <OutcomeCard
                customerName={activeCustomer.customerName}
                engagementName={activeCustomer.engagementName}
                outcomeStatement="Reduce manual customer onboarding time from 30 minutes to under 5 minutes."
                version={approvedAcme ? 2 : (activeEngagementData?.outcome?.version || 1)}
                status={approvedAcme ? "HEALTHY" : "NEEDS_REASSESSMENT"}
                progress={approvedAcme ? 75 : 70}
                successCriteria={
                  approvedAcme
                    ? [
                        { id: "sc-1", title: "Automated onboarding workflow implemented", completed: true },
                        { id: "sc-2", title: "API integration complete", completed: true },
                        { id: "sc-3", title: "Production validation complete", completed: false },
                        { id: "sc-4", title: "Enterprise SSO configuration & validation (Added v2)", completed: false }
                      ]
                    : (activeEngagementData?.outcome?.success_criteria || [
                        { id: "sc-1", title: "Automated onboarding workflow implemented", completed: true },
                        { id: "sc-2", title: "API integration complete", completed: true },
                        { id: "sc-3", title: "Production validation complete", completed: false }
                      ])
                }
              />
            ) : (
              <OutcomeCard
                customerName={activeCustomer.customerName}
                engagementName={activeCustomer.engagementName}
                outcomeStatement={activeEngagementData?.outcome?.statement || "Migrate 50M records to Cloud SQL with zero data loss and under 15 min cutover window."}
                version={activeEngagementData?.outcome?.version || 1}
                status="HEALTHY"
                progress={45}
                successCriteria={activeEngagementData?.outcome?.success_criteria || [
                  { id: "sc-g1", title: "Schema mapping & transformation validation", completed: true },
                  { id: "sc-g2", title: "CDC replication stream active", completed: true },
                  { id: "sc-g3", title: "Cutover dry run & performance benchmark", completed: false }
                ]}
              />
            )}

            {/* Intelligence & Change Impact Section */}
            {isAcme ? (
              !approvedAcme ? (
                <ChangeImpactCard
                  changeTitle='Customer requirement changed: "SSO is required before production deployment."'
                  onApprove={handleApproveChange}
                  onReject={() => alert("Outcome recommendation rejected.")}
                />
              ) : (
                <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-5 shadow-lg space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                    <span>Outcome Version 2 Transition Completed</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Enterprise SSO requirement has been integrated into success criteria for <strong className="text-slate-100">Acme Corp</strong>. Active dependency recorded:
                    <strong className="text-slate-100"> Waiting on customer security owner for configuration.</strong>
                  </p>
                </div>
              )
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4" />
                    CDC Replication Health Status
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                    Stream Healthy
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  CDC replication stream is actively processing change events from on-prem PostgreSQL to Cloud SQL with zero lag. All schema mapping transformations are validated.
                </p>
              </div>
            )}

            {/* KNOW Agent Grounded RAG Intelligence Panel */}
            <KnowledgePanel
              engagementId={activeCustomer.id}
              customerName={activeCustomer.customerName}
            />
          </div>

          {/* Right Sidebar: Blockers & Next Actions */}
          <div className="space-y-6">
            {/* Next Best Action Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  Next Best Action (MOVE Agent)
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 font-mono">
                  {nextActionData?.priority_level || (isAcme ? "CRITICAL" : "HIGH_PRIORITY")}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-100">
                {nextActionData?.action_title || (isAcme
                  ? "Follow up with customer security owner for required SSO configuration."
                  : "Execute cutover performance dry-run test on staging replica.")}
              </p>
              <div className="text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded border border-slate-800 leading-relaxed">
                <strong>Why now:</strong>{" "}
                {nextActionData?.why_now || (isAcme
                  ? "This is currently the primary blocker preventing production validation in Step 4."
                  : "Dry run performance data is required to confirm the 15-minute cutover window for Step 5 deployment.")}
              </div>
            </div>

            {/* Active Blockers & Dependencies */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Active Blockers & Dependencies ({activeCustomer.customerName})
              </h3>
              <ul className="space-y-2.5 text-xs">
                {isAcme ? (
                  <>
                    <li className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between font-medium text-slate-200">
                        <span className="text-amber-400">● SSO Configuration</span>
                        <span className="text-[10px] text-slate-500">Waiting on Customer</span>
                      </div>
                      <p className="text-[11px] text-slate-400">Customer security team owns the dependency.</p>
                    </li>
                    <li className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between font-medium text-slate-200">
                        <span className="text-slate-400">○ Production Credentials</span>
                        <span className="text-[10px] text-slate-500">Pending Validation</span>
                      </div>
                      <p className="text-[11px] text-slate-400">Depends on SSO configuration approval.</p>
                    </li>
                  </>
                ) : (
                  <li className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between font-medium text-slate-200">
                      <span className="text-slate-300">● Staging Maintenance Window</span>
                      <span className="text-[10px] text-slate-500">Scheduled for Friday</span>
                    </div>
                    <p className="text-[11px] text-slate-400">Performance benchmark scheduled during off-peak hours.</p>
                  </li>
                )}
              </ul>
            </div>

            {/* Audit Timeline Quick Reference */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Recent Timeline Events</span>
                <Clock className="h-3.5 w-3.5 text-slate-500" />
              </h3>
              <ul className="space-y-2 text-xs text-slate-300">
                {activeEngagementData?.timeline ? (
                  activeEngagementData.timeline.map((evt: any) => (
                    <li key={evt.id} className="border-l-2 border-teal-400 pl-2.5 py-0.5">
                      <span className="text-[11px] text-slate-400 block font-mono">{evt.title}</span>
                      <span>{evt.description}</span>
                    </li>
                  ))
                ) : isAcme ? (
                  <>
                    <li className="border-l-2 border-amber-400 pl-2.5 py-0.5">
                      <span className="text-[11px] text-slate-400 block font-mono">10m ago</span>
                      <span>Customer requirement added: Enterprise SSO required.</span>
                    </li>
                    <li className="border-l-2 border-teal-400 pl-2.5 py-0.5">
                      <span className="text-[11px] text-slate-400 block font-mono">25m ago</span>
                      <span>API integration completed and verified.</span>
                    </li>
                  </>
                ) : (
                  <li className="border-l-2 border-teal-400 pl-2.5 py-0.5">
                    <span className="text-[11px] text-slate-400 block font-mono">1h ago</span>
                    <span>CDC stream initialized and verified active.</span>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
