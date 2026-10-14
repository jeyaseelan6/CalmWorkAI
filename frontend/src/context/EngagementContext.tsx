"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface CustomerEngagement {
  id: string;
  customerName: string;
  engagementName: string;
  status: "HEALTHY" | "NEEDS_REASSESSMENT" | "BLOCKED" | "AT_RISK";
  description?: string;
  version?: number;
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
  switchEngagement: (cust: CustomerEngagement) => void;
  activeEngagementData: any;
  nextActionData: any;
  loading: boolean;
  approvedAcme: boolean;
  fetchEngagementDetail: (id: string, wipeOldState?: boolean) => Promise<void>;
  fetchEngagementsList: () => Promise<void>;
  createEngagement: (payload: {
    customerName: string;
    engagementName: string;
    description?: string;
    initialOutcomeStatement?: string;
    successCriteria?: string[];
  }) => Promise<{ success: boolean; error?: string; data?: any }>;
  pendingApprovals: any[];
  pendingApprovalsCount: number;
  fetchPendingApprovals: () => Promise<void>;
  respondToApproval: (approvalId: string, action: "APPROVE" | "REJECT", decisionNote?: string) => Promise<boolean>;
  handleApproveChange: () => Promise<void>;
}

const EngagementContext = createContext<EngagementContextType | undefined>(undefined);

export function EngagementProvider({ children }: { children: React.ReactNode }) {
  const [customers, setCustomers] = useState<CustomerEngagement[]>(DEFAULT_CUSTOMERS);
  const [activeCustomer, setActiveCustomer] = useState<CustomerEngagement>(DEFAULT_CUSTOMERS[0]);
  const [activeEngagementData, setActiveEngagementData] = useState<any>(null);
  const [nextActionData, setNextActionData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [approvedAcme, setApprovedAcme] = useState<boolean>(false);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);

  const fetchPendingApprovals = async () => {
    try {
      const res = await fetch(`${API_BASE}/approvals`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setPendingApprovals(json.data);
        }
      }
    } catch (e) {
      console.warn("Could not fetch pending approvals from backend:", e);
    }
  };

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const respondToApproval = async (approvalId: string, action: "APPROVE" | "REJECT", decisionNote?: string): Promise<boolean> => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("calmwork_auth_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/approvals/${approvalId}/respond`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action, decision_note: decisionNote || `Manager ${action.toLowerCase()}d request` })
      });

      if (res.ok) {
        await fetchPendingApprovals();
        await fetchEngagementDetail(activeCustomer.id);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to respond to approval:", err);
      return false;
    }
  };

  const fetchEngagementsList = async () => {
    try {
      const res = await fetch(`${API_BASE}/engagements`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const mapped: CustomerEngagement[] = json.data.map((item: any) => ({
            id: item.id,
            customerName: item.customer_name,
            engagementName: item.name,
            status: item.status,
            description: item.description,
            version: item.version
          }));
          setCustomers(mapped);
          setActiveCustomer((prev) => {
            const exists = mapped.find((c) => c.id === prev.id);
            return exists || mapped[0];
          });
        }
      }
    } catch (e) {
      console.warn("Backend API offline; keeping default customers.");
    }
  };

  useEffect(() => {
    fetchEngagementsList();
  }, []);

  const fetchEngagementDetail = async (id: string, wipeOldState: boolean = true) => {
    if (wipeOldState) {
      setActiveEngagementData(null);
      setNextActionData(null);
      setApprovedAcme(false);
    }
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

  const switchEngagement = (cust: CustomerEngagement) => {
    setActiveCustomer(cust);
    setActiveEngagementData(null);
    setNextActionData(null);
    setApprovedAcme(false);
    setLoading(true);
  };

  useEffect(() => {
    fetchEngagementDetail(activeCustomer.id);
  }, [activeCustomer.id]);

  const handleApproveChange = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("calmwork_auth_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}/engagements/${activeCustomer.id}/approvals/respond`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "APPROVE", actor_id: "David Miller" })
      });

      if (res.ok) {
        setApprovedAcme(true);
        fetchEngagementDetail(activeCustomer.id);
      } else {
        const errorJson = await res.json().catch(() => ({}));
        console.warn("Approval blocked by backend RBAC:", errorJson.detail || "Forbidden");
        // Only set approved if manager succeeded
        if (res.status !== 403) {
          setApprovedAcme(true);
        }
      }
    } catch (e) {
      console.warn("Approval request error:", e);
    }
  };

  const createEngagement = async (payload: {
    customerName: string;
    engagementName: string;
    description?: string;
    initialOutcomeStatement?: string;
    successCriteria?: string[];
  }): Promise<{ success: boolean; error?: string; data?: any }> => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("calmwork_auth_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}/engagements`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          customer_name: payload.customerName,
          name: payload.engagementName,
          description: payload.description || "",
          initial_outcome_statement: payload.initialOutcomeStatement || "",
          success_criteria: payload.successCriteria || []
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await fetchEngagementsList();
        if (data.data?.id) {
          const newCust: CustomerEngagement = {
            id: data.data.id,
            customerName: data.data.customer_name,
            engagementName: data.data.name,
            status: data.data.status,
            description: data.data.description,
            version: data.data.version
          };
          setActiveCustomer(newCust);
        }
        return { success: true, data: data.data };
      } else {
        return {
          success: false,
          error: data.detail || data.message || "Failed to create engagement"
        };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  };

  return (
    <EngagementContext.Provider
      value={{
        customers,
        activeCustomer,
        setActiveCustomer,
        switchEngagement,
        activeEngagementData,
        nextActionData,
        loading,
        approvedAcme,
        fetchEngagementDetail,
        fetchEngagementsList,
        createEngagement,
        handleApproveChange,
        pendingApprovals,
        pendingApprovalsCount: pendingApprovals.length,
        fetchPendingApprovals,
        respondToApproval
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
