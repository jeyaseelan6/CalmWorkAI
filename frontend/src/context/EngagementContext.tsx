"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

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

import { API_BASE } from "@/utils/api";
import { formatISTDateTime } from "@/utils/date";

interface EngagementContextType {
  customers: CustomerEngagement[];
  activeCustomer: CustomerEngagement;
  setActiveCustomer: (cust: CustomerEngagement) => void;
  switchEngagement: (cust: CustomerEngagement) => void;
  activeEngagementData: any;
  nextActionData: any;
  nextActionError: string | null;
  backendError: string | null;
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
  deleteEngagement: (engagementId: string) => Promise<{ success: boolean; error?: string }>;
  pendingApprovals: any[];
  pendingApprovalsCount: number;
  fetchPendingApprovals: () => Promise<void>;
  respondToApproval: (approvalId: string, action: "APPROVE" | "REJECT", decisionNote?: string) => Promise<boolean>;
  handleApproveChange: () => Promise<void>;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedItemContext: string | null;
  setSelectedItemContext: (ctx: string | null) => void;
  isSupervisorDrawerOpen: boolean;
  setIsSupervisorDrawerOpen: (open: boolean) => void;
  openSupervisorWithContext: (opts?: { tab?: string; selectedItem?: string; initialQuery?: string }) => void;
  supervisorInitialQuery: string | null;
  setSupervisorInitialQuery: (q: string | null) => void;
  brief: any;
  setBrief: React.Dispatch<React.SetStateAction<any>>;
  briefLoading: boolean;
  streamEvent: any;
  lastRefreshed: string | null;
  hasFreshEvidence: boolean;
  setHasFreshEvidence: React.Dispatch<React.SetStateAction<boolean>>;
  runMorningBrief: () => Promise<void>;
}

const EngagementContext = createContext<EngagementContextType | undefined>(undefined);

export function EngagementProvider({ children }: { children: React.ReactNode }) {
  const [customers, setCustomers] = useState<CustomerEngagement[]>(DEFAULT_CUSTOMERS);
  const [activeCustomer, setActiveCustomer] = useState<CustomerEngagement>(DEFAULT_CUSTOMERS[0]);
  const [activeEngagementData, setActiveEngagementData] = useState<any>(null);
  const [nextActionData, setNextActionData] = useState<any>(null);
  const [nextActionError, setNextActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [approvedAcme, setApprovedAcme] = useState<boolean>(false);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>("myday");
  const [selectedItemContext, setSelectedItemContext] = useState<string | null>(null);
  const [isSupervisorDrawerOpen, setIsSupervisorDrawerOpen] = useState<boolean>(false);
  const [supervisorInitialQuery, setSupervisorInitialQuery] = useState<string | null>(null);
  const [brief, setBrief] = useState<any>(null);
  const [briefLoading, setBriefLoading] = useState<boolean>(false);
  const [streamEvent, setStreamEvent] = useState<any>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [hasFreshEvidence, setHasFreshEvidence] = useState<boolean>(false);

  const openSupervisorWithContext = (opts?: { tab?: string; selectedItem?: string; initialQuery?: string }) => {
    if (opts?.tab) setActiveTab(opts.tab);
    if (opts?.selectedItem !== undefined) setSelectedItemContext(opts.selectedItem);
    if (opts?.initialQuery) setSupervisorInitialQuery(opts.initialQuery);
    setIsSupervisorDrawerOpen(true);
  };

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
        await fetchEngagementDetail(activeCustomer.id, false);

        // Broadcast immediately across all open tabs & windows
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("calmwork-state-change", {
              detail: { engagementId: activeCustomer.id, type: "APPROVAL_DECISION", action, approvalId }
            })
          );
          try {
            const channel = new BroadcastChannel("calmwork_governance_bus");
            channel.postMessage({
              type: "APPROVAL_DECISION",
              action,
              approvalId,
              engagementId: activeCustomer.id
            });
            channel.close();
          } catch (e) {
            // BroadcastChannel fallback
          }
        }

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

  const fetchEngagementDetail = useCallback(async (id: string, wipeOldState: boolean = true) => {
    if (wipeOldState) {
      setActiveEngagementData(null);
      setNextActionData(null);
      setNextActionError(null);
      setApprovedAcme(false);
      setLoading(true);
    }
    setBackendError(null);
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
      } else {
        const errJson = await res.json().catch(() => null);
        setBackendError(errJson?.message || "The server is unavailable right now.");
        return;
      }
      // Fetch next-action only on explicit workspace switch or initial load (not on background heartbeat)
      if (wipeOldState) {
        fetch(`${API_BASE}/engagements/${id}/next-action`)
          .then((r) => r.json())
          .then((nextJson) => {
            if (nextJson.success && nextJson.data) {
              setNextActionData(nextJson.data);
              setNextActionError(null);
            } else if (!nextJson.success && nextJson.message) {
              setNextActionData(null);
              setNextActionError(nextJson.message);
            }
          })
          .catch(() => {
            setNextActionError("AI agents are temporarily unavailable. Click 'Morning Brief' to retry.");
          });
      }
    } catch (e) {
      console.warn("Backend API offline or unreachable; using local engagement state fallback.");
      setBackendError("The server is unavailable right now.");
    } finally {
      if (wipeOldState) {
        setLoading(false);
      }
    }
  }, []);

  const switchEngagement = (cust: CustomerEngagement) => {
    setActiveCustomer(cust);
    setActiveEngagementData(null);
    setNextActionData(null);
    setNextActionError(null);
    setApprovedAcme(false);
    setSelectedItemContext(null);
    setSupervisorInitialQuery(null);
    setLoading(true);
  };

  useEffect(() => {
    fetchEngagementDetail(activeCustomer.id);
  }, [activeCustomer.id, fetchEngagementDetail]);

  // Cross-Tab & Cross-Window Governance Listener
  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel("calmwork_governance_bus");
    channel.onmessage = (event) => {
      if (event?.data?.type === "APPROVAL_DECISION" || event?.data?.type === "TASK_CHANGE") {
        fetchPendingApprovals();
        fetchEngagementDetail(activeCustomer.id, false);
      }
    };
    return () => {
      channel.close();
    };
  }, [activeCustomer.id, fetchEngagementDetail]);

  // Periodic heartbeat (every 20 seconds) to guarantee multi-device state consistency without exhausting API quota
  useEffect(() => {
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchPendingApprovals();
        fetchEngagementDetail(activeCustomer.id, false);
      }
    }, 20000);
    return () => clearInterval(timer);
  }, [activeCustomer.id, fetchEngagementDetail]);

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
        await fetchPendingApprovals();
        await fetchEngagementDetail(activeCustomer.id, false);

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("calmwork-state-change", {
              detail: { engagementId: activeCustomer.id, type: "OUTCOME_CHANGE", action: "APPROVE" }
            })
          );
          try {
            const channel = new BroadcastChannel("calmwork_governance_bus");
            channel.postMessage({
              type: "APPROVAL_DECISION",
              action: "APPROVE",
              engagementId: activeCustomer.id
            });
            channel.close();
          } catch (e) {
            // BroadcastChannel fallback
          }
        }
      } else {
        const errorJson = await res.json().catch(() => ({}));
        console.warn("Approval blocked by backend RBAC:", errorJson.detail || "Forbidden");
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

  const deleteEngagement = async (engagementId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("calmwork_auth_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}/engagements/${engagementId}`, {
        method: "DELETE",
        headers
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const remaining = customers.filter((c) => c.id !== engagementId);
        setCustomers(remaining.length > 0 ? remaining : DEFAULT_CUSTOMERS);

        if (activeCustomer.id === engagementId) {
          const nextActive = remaining.length > 0 ? remaining[0] : DEFAULT_CUSTOMERS[0];
          setActiveCustomer(nextActive);
        }

        await fetchEngagementsList();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("calmwork-state-change", { detail: { engagementId } }));
        }
        return { success: true };
      } else {
        return {
          success: false,
          error: data.detail || data.message || "Failed to delete engagement"
        };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  };

  // Fetch latest pre-computed morning brief from database on customer change
  useEffect(() => {
    setBrief(null);
    setLastRefreshed(null);
    setStreamEvent(null);
    setHasFreshEvidence(false);

    if (activeCustomer?.id) {
      const token = typeof window !== "undefined" ? localStorage.getItem("calmwork_auth_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      fetch(`${API_BASE}/engagements/${activeCustomer.id}/supervisor/brief/latest`, { headers })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.success && data?.has_brief && data?.data) {
            setBrief(data.data);
            const ts = data.generated_at || data.data.persisted_at || data.data.timestamp;
            if (ts) {
              setLastRefreshed(typeof ts === "string" && ts.includes("T") ? formatISTDateTime(ts) : String(ts));
            }
          }
        })
        .catch((e) => {
          console.debug("No previously generated morning brief found in database:", e);
        });
    }
  }, [activeCustomer?.id]);

  // Listen for state changes to flag fresh evidence
  useEffect(() => {
    const handleStateChange = (e: any) => {
      if (e?.detail?.engagementId === activeCustomer?.id) {
        setHasFreshEvidence(true);
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("calmwork-state-change", handleStateChange);
      return () => window.removeEventListener("calmwork-state-change", handleStateChange);
    }
  }, [activeCustomer?.id]);

  // Run sequential Morning Brief (PLAN -> KNOW -> MOVE)
  const runMorningBrief = useCallback(async () => {
    if (!activeCustomer?.id) return;
    setBriefLoading(true);
    setStreamEvent({
      agent: "SUPERVISOR",
      stage: "INIT",
      message: "Starting sequential Morning Brief across PLAN, KNOW, and MOVE agents...",
      step: 1,
      total_steps: 5
    });

    const token = typeof window !== "undefined" ? localStorage.getItem("calmwork_auth_token") : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch(`${API_BASE}/engagements/${activeCustomer.id}/supervisor/brief/stream`, {
        method: "POST",
        headers
      });

      if (!res.ok || !res.body) {
        throw new Error("Stream not available, using fallback");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ")) {
            try {
              const event = JSON.parse(trimmed.slice(6));
              if (event.type === "progress") {
                setStreamEvent(event);
              } else if (event.type === "complete" && event.data) {
                setBrief(event.data);
                const ts = event.generated_at || event.data.persisted_at || new Date().toISOString();
                setLastRefreshed(typeof ts === "string" && ts.includes("T") ? formatISTDateTime(ts) : String(ts));
                setStreamEvent(null);
                setHasFreshEvidence(false);
                fetchEngagementDetail(activeCustomer.id);
              }
            } catch (e) {
              console.warn("SSE parse error in brief stream:", e);
            }
          }
        }
      }
    } catch (err) {
      console.warn("Streaming morning brief encountered error, using standard fallback:", err);
      try {
        const fallbackRes = await fetch(`${API_BASE}/engagements/${activeCustomer.id}/supervisor/brief`, {
          method: "POST",
          headers
        });
        const fallbackData = await fallbackRes.json();
        if (fallbackData.success && fallbackData.data) {
          setBrief(fallbackData.data);
          const ts = fallbackData.generated_at || fallbackData.data.persisted_at || new Date().toISOString();
          setLastRefreshed(typeof ts === "string" && ts.includes("T") ? formatISTDateTime(ts) : String(ts));
          setHasFreshEvidence(false);
          fetchEngagementDetail(activeCustomer.id);
        }
      } catch (fallbackErr) {
        console.error("Failed to generate Morning Brief:", fallbackErr);
      }
    } finally {
      setBriefLoading(false);
      setStreamEvent(null);
    }
  }, [activeCustomer?.id, fetchEngagementDetail]);

  return (
    <EngagementContext.Provider
      value={{
        customers,
        activeCustomer,
        setActiveCustomer,
        switchEngagement,
        activeEngagementData,
        nextActionData,
        nextActionError,
        backendError,
        loading,
        approvedAcme,
        fetchEngagementDetail,
        fetchEngagementsList,
        createEngagement,
        deleteEngagement,
        handleApproveChange,
        pendingApprovals,
        pendingApprovalsCount: pendingApprovals.length,
        fetchPendingApprovals,
        respondToApproval,
        activeTab,
        setActiveTab,
        selectedItemContext,
        setSelectedItemContext,
        isSupervisorDrawerOpen,
        setIsSupervisorDrawerOpen,
        openSupervisorWithContext,
        supervisorInitialQuery,
        setSupervisorInitialQuery,
        brief,
        setBrief,
        briefLoading,
        streamEvent,
        lastRefreshed,
        hasFreshEvidence,
        setHasFreshEvidence,
        runMorningBrief
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
