"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useEngagement } from "@/context/EngagementContext";
import AppShell from "@/components/layout/AppShell";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

export default function TimelineLegacyPage() {
  const router = useRouter();
  const { activeCustomer, customers } = useEngagement();
  const targetId = activeCustomer?.id || customers?.[0]?.id || "eng-acme-001";
  const targetHref = `/engagements/${targetId}?tab=timeline`;

  useEffect(() => {
    let finalHref = targetHref;
    if (typeof window !== "undefined" && window.location.search) {
      const sp = new URLSearchParams(window.location.search);
      sp.set("tab", "timeline");
      finalHref = `/engagements/${targetId}?${sp.toString()}`;
    }
    router.replace(finalHref);
  }, [targetHref, targetId, router]);

  return (
    <AppShell>
      <div className="flex h-[50vh] flex-col items-center justify-center text-xs text-slate-500 space-y-3">
        <RefreshCw className="h-5 w-5 animate-spin text-slate-700" />
        <p>Redirecting to Audit Timeline in {activeCustomer?.customerName || "engagement"} workspace...</p>
        <Link href={targetHref} className="text-purple-600 underline font-semibold">
          Click here if not redirected automatically
        </Link>
      </div>
    </AppShell>
  );
}
