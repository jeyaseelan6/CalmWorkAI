"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useEngagement } from "@/context/EngagementContext";
import AppShell from "@/components/layout/AppShell";

export default function EngagementsIndexPage() {
  const router = useRouter();
  const { activeCustomer } = useEngagement();

  useEffect(() => {
    const targetId = activeCustomer?.id || "eng-acme-001";
    router.replace(`/engagements/${targetId}`);
  }, [activeCustomer?.id, router]);

  return (
    <AppShell>
      <div className="flex h-[60vh] items-center justify-center text-xs text-slate-400">
        <div className="animate-pulse">Loading {activeCustomer?.customerName || "engagement"} workspace...</div>
      </div>
    </AppShell>
  );
}
