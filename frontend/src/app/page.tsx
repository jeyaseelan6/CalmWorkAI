"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";

export default function MainPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/engagements");
  }, [router]);

  return (
    <AppShell>
      <div className="flex h-[60vh] items-center justify-center text-xs text-slate-400 font-mono">
        <div className="animate-pulse flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-slate-400 animate-ping" />
          <span>Opening engagements portfolio...</span>
        </div>
      </div>
    </AppShell>
  );
}
