"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface CustomerEngagement {
  id: string;
  customerName: string;
  engagementName: string;
  status: "HEALTHY" | "NEEDS_REASSESSMENT" | "BLOCKED" | "AT_RISK";
}

export const DEFAULT_CUSTOMERS: CustomerEngagement[] = [
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
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface EngagementContextType {
  customers: CustomerEngagement[];
  activeCustomer: CustomerEngagement;
  setActiveCustomer: (cust: CustomerEngagement) => void;
  activeEngagementData: any;
  nextActionData: any;
  loading: boolean;
  approvedAcme: boolean;
  fetchEngagementDetail: (id: string) => Promise<void>;
  handleApproveChange: () => Promise<void>;
}

const EngagementContext = createContext<EngagementContextType | undefined>(undefined);

export function EngagementProvider({ children }: { children: React.ReactNode }) {
  const [customers] = useState<CustomerEngagement[]>(DEFAULT_CUSTOMERS);
  const [activeCustomer, setActiveCustomer] = useState<CustomerEngagement>(DEFAULT_CUSTOMERS[0]);
  const [activeEngagementData, setActiveEngagementData] = useState<any>(null);
  const [nextActionData, setNextActionData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [approvedAcme, setApprovedAcme] = useState<boolean>(false);

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
      const nextRes = await fetch(`${API_BASE}/engagements/${id}/next-action`);
      if (nextRes.ok) {
        const nextJson = await nextRes.json();
        if (nextJson.success && nextJson.data) {
          setNextActionData(nextJson.data);
        }
      }
    } catch (e) {
      console.warn("Backend API offline or unreachable; using local engagement state fallback.");
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

  return (
    <EngagementContext.Provider
      value={{
        customers,
        activeCustomer,
        setActiveCustomer,
        activeEngagementData,
        nextActionData,
        loading,
        approvedAcme,
        fetchEngagementDetail,
        handleApproveChange
      }}
    >
      {children}
    </EngagementContext.Provider>
  );
}

export function useEngagement() {
  const context = useContext(EngagementContext);
  if (!context) {
    throw new Error("useEngagement must be used within an EngagementProvider");
  }
  return context;
}
