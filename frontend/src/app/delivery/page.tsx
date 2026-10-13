"use client";

import React from "react";
import AppShell from "@/components/layout/AppShell";
import CustomerUpdatePanel from "@/components/delivery/CustomerUpdatePanel";
import AiLifecycleTracker from "@/components/engagement/AiLifecycleTracker";
import { useEngagement } from "@/context/EngagementContext";
import { CheckSquare, Send, Sparkles, MessageSquare, Mail, Copy, Lock } from "lucide-react";

export default function DeliveryPage() {
  const { activeCustomer } = useEngagement();

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Calm Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-display text-slate-900">Customer Updates</h1>
              <span className="text-slate-300">·</span>
              <span className="text-sm text-slate-600 font-medium">{activeCustomer.customerName}</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Draft, review, and authorize executive stakeholder updates and milestone summaries
            </p>
          </div>
        </div>

        {/* End-to-End Gen AI Lifecycle Tracker */}
        <AiLifecycleTracker 
          engagementId={activeCustomer.id} 
          customerName={activeCustomer.customerName} 
        />

        {/* Interactive Customer Update Studio Panel */}
        <CustomerUpdatePanel
          engagementId={activeCustomer.id}
          customerName={activeCustomer.customerName}
          engagementName={activeCustomer.engagementName}
        />
      </div>
    </AppShell>
  );
}
