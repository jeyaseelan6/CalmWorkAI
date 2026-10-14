"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useEngagement } from "@/context/EngagementContext";
import AppShell from "@/components/layout/AppShell";

export default function EngagementsIndexPage() {
  const router = useRouter();
  const { activeCustomer, customers } = useEngagement();

  useEffect(() => {
    const targetId = activeCustomer?.id || customers[0]?.id || "eng-acme-001";
    router.replace(`/engagements/${targetId}`);
  }, [activeCustomer?.id, customers, router]);

  return (
    <AppShell>
      <div className="flex h-[60vh] items-center justify-center text-xs text-slate-400 font-mono">
        <div className="animate-pulse flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-slate-400 animate-ping" />
          <span>Opening {activeCustomer?.customerName || customers[0]?.customerName || "engagement"} workspace...</span>
        </div>
      </div>
    </AppShell>
  );
}
