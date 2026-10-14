"use client";

import React from "react";
import AppShell from "@/components/layout/AppShell";
import MyDayView from "@/components/engagement/MyDayView";
import { useEngagement } from "@/context/EngagementContext";

export default function MyDayPage() {
  const { activeCustomer } = useEngagement();
  return (
    <AppShell>
      <MyDayView key={activeCustomer?.id} />
    </AppShell>
  );
}
