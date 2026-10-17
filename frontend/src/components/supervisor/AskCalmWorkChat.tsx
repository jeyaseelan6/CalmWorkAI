"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  Send,
  User,
  Compass,
  Zap,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Image as ImageIcon,
  X,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Radio,
  Trash2,
  Printer,
  FileText,
  Check,
  Clock,
  UserCheck
} from "lucide-react";
import { useEngagement } from "@/context/EngagementContext";
import { useAuth } from "@/context/AuthContext";
import { printCustomerUpdateDocument } from "@/utils/pdfGenerator";
import { getNowISTTime } from "@/utils/date";
import { API_BASE } from "@/utils/api";

export interface CustomerUpdateDraft {
  engagement_id: string;
  customer_name: string;
  subject: string;
  executive_summary: string;
  key_milestones_achieved: string[];
  next_milestone_target: string;
  customer_action_items: string[];
  status: string;
  privacy_scrubbed: boolean;
}

// Fast in-memory cache keyed by workspace (engagementId) to ensure zero-latency switching
const workspaceChatMemoryCache: Record<string, ChatMessage[]> = {};

interface DelegatedAgent {
  id: string;
  name: string;
  role: string;
  badge_label: string;
  color: string;
}

export interface IncidentInvestigationResult {
  incident_id: string;
  engagement_id: string;
  customer_name: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | string;
  summary: string;
  root_cause_hypothesis: string;
  affected_components: string[];
  suggested_workaround?: string | null;
  runbook_recommendations: string[];
  visual_diagnostic_findings?: string | null;
  image_url?: string | null;
  evidence_citations: string[];
  privacy_scrubbed: boolean;
  investigated_at: string;
}

interface ChatMessage {
  id: string;
  sender: "USER" | "SUPERVISOR";
  text: string;
  intent?: string;
  delegatedAgent?: DelegatedAgent;
  capabilitiesUsed?: string[];
  sources?: { title: string; snippet: string; source_type?: string }[];
  suggestedFollowups?: string[];
  screenshotPreview?: string;
  supportResult?: IncidentInvestigationResult;
  customerUpdate?: CustomerUpdateDraft;
  timestamp: string;
}

interface AttachedScreenshot {
  dataUrl: string;
  filename: string;
  sizeBytes: number;
  fileType: string;
}

export interface AskCalmWorkChatProps {
  isDrawer?: boolean;
  onClose?: () => void;
  engagementId?: string;
  customerName?: string;
  activeTab?: string;
  selectedItemContext?: string | null;
  initialQuery?: string | null;
}

const AGENT_META: Record<string, {
  name: string;
  role: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  headerBg: string;
  borderCol: string;
  iconCol: string;
  badgeBg: string;
}> = {
  PLAN: {
    name: "PLAN Agent",
    role: "Planning & Scope Intelligence",
    badge: "Planning & Scope Specialist",
    icon: Compass,
    headerBg: "bg-purple-50/90",
    borderCol: "border-purple-200",
    iconCol: "text-purple-600",
    badgeBg: "bg-purple-100 text-purple-800 border-purple-300"
  },
  UNDERSTAND: {
    name: "PLAN Agent",
    role: "Planning & Scope Intelligence",
    badge: "Scope & Planning Specialist",
    icon: Compass,
    headerBg: "bg-purple-50/90",
    borderCol: "border-purple-200",
    iconCol: "text-purple-600",
    badgeBg: "bg-purple-100 text-purple-800 border-purple-300"
  },
  SUPPORT: {
    name: "SUPPORT Agent",
    role: "Production Support & Visual Diagnostics",
    badge: "Incident & Diagnostic Specialist",
    icon: ShieldCheck,
    headerBg: "bg-emerald-50/90",
    borderCol: "border-emerald-200",
    iconCol: "text-emerald-600",
    badgeBg: "bg-emerald-100 text-emerald-800 border-emerald-300"
  },
  MOVE: {
    name: "MOVE Agent",
    role: "Operational Velocity & Next Actions",
    badge: "Velocity & Blocker Specialist",
    icon: Zap,
    headerBg: "bg-amber-50/90",
    borderCol: "border-amber-200",
    iconCol: "text-amber-600",
    badgeBg: "bg-amber-100 text-amber-800 border-amber-300"
  },
  DELIVER: {
    name: "DELIVER Agent",
    role: "Stakeholder Communications",
    badge: "Executive Updates Specialist",
    icon: Send,
    headerBg: "bg-rose-50/90",
    borderCol: "border-rose-200",
    iconCol: "text-rose-600",
    badgeBg: "bg-rose-100 text-rose-800 border-rose-300"
  },
  KNOW: {
    name: "KNOW Agent",
    role: "Grounded Technical Documentation",
    badge: "Verified Knowledge Specialist",
    icon: BookOpen,
    headerBg: "bg-blue-50/90",
    borderCol: "border-blue-200",
    iconCol: "text-blue-600",
    badgeBg: "bg-blue-100 text-blue-800 border-blue-300"
  },
  MULTI_AGENT: {
    name: "CalmWork Supervisor",
    role: "Central Multi-Agent Orchestration",
    badge: "Universal Orchestrator",
    icon: Sparkles,
    headerBg: "bg-slate-100/90",
    borderCol: "border-slate-200",
    iconCol: "text-slate-800",
    badgeBg: "bg-slate-200 text-slate-800 border-slate-300"
  },
  SUPERVISOR: {
    name: "CalmWork Supervisor",
    role: "Central Multi-Agent Orchestration",
    badge: "Supervisor Agent",
    icon: Sparkles,
    headerBg: "bg-slate-100/90",
    borderCol: "border-slate-200",
    iconCol: "text-slate-800",
    badgeBg: "bg-slate-200 text-slate-800 border-slate-300"
  }
};

function renderInlineTokens(str: string) {
  // Gracefully balance unclosed bold or italic tags (e.g. truncated "**Ticket")
  let sanitized = str;
  const boldCount = (sanitized.match(/\*\*/g) || []).length;
  if (boldCount % 2 !== 0) {
    sanitized += "**";
  }
  const italicCount = (sanitized.match(/(?<!\*)\*(?!\*)/g) || []).length;
  if (italicCount % 2 !== 0) {
    sanitized += "*";
  }

  const segments = sanitized.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return segments.map((seg, i) => {
    if (seg.startsWith("**") && seg.endsWith("**")) {
      return <strong key={i} className="font-semibold text-slate-900">{seg.slice(2, -2)}</strong>;
    }
    if (seg.startsWith("*") && seg.endsWith("*")) {
      return <em key={i} className="italic text-slate-700">{seg.slice(1, -1)}</em>;
    }
    if (seg.startsWith("`") && seg.endsWith("`")) {
      return <code key={i} className="px-1 py-0.5 bg-slate-100 text-slate-800 font-mono text-[11px] rounded border border-slate-200">{seg.slice(1, -1)}</code>;
    }
    return seg;
  });
}

function renderFormattedInline(str: string) {
  // Split on HTML break tags (<br>, <br/>, <br />) or literal newlines
  const parts = str.split(/<br\s*\/?>/gi);
  return parts.map((part, pIdx) => {
    const trimmed = part.trim();
    if (!trimmed) return null;
    const isBullet = trimmed.startsWith("• ") || trimmed.startsWith("- ") || trimmed.startsWith("* ");
    const isNumbered = /^\d+[\.\)]\s/.test(trimmed);
    const bulletContent = isBullet 
      ? trimmed.replace(/^[•\-\*]\s*/, "") 
      : isNumbered 
      ? trimmed.replace(/^\d+[\.\)]\s*/, "")
      : trimmed;

    return (
      <div 
        key={pIdx} 
        className={isBullet || isNumbered ? "flex items-start gap-1.5 my-1" : pIdx > 0 ? "mt-1.5" : ""}
      >
        {isBullet && <span className="text-slate-400 select-none shrink-0 leading-normal">•</span>}
        {isNumbered && (
          <span className="text-slate-500 font-medium select-none shrink-0 leading-normal text-[11px]">
            {trimmed.match(/^\d+[\.\)]/)?.[0]}
          </span>
        )}
        <span className="flex-1 leading-normal">{renderInlineTokens(bulletContent)}</span>
      </div>
    );
  });
}

function FormattedMessageBody({ rawText }: { rawText: string }) {
  const cleaned = rawText
    .replace(/^([🎯⚡📢📚🧭\s]*(\*{1,2})?\[Handed over to [^\]]+\](\*{1,2})?\s*\n*)+/i, "")
    .replace(/^(\*{1,2})?\[Handed over to [^\]]+\](\*{1,2})?\s*\n*/i, "")
    .replace(/\n+(\*|_)?Source[s]?:\s*.*$/i, "")
    .trim();

  const lines = cleaned.split("\n");
  const elements: React.ReactNode[] = [];
  let tableRows: string[] = [];

  const flushTable = (key: number) => {
    if (tableRows.length === 0) return;
    const rows = tableRows.map((r) => {
      const parts = r.split("|").map((c) => c.trim());
      if (parts.length > 0 && parts[0] === "") parts.shift();
      if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
      return parts;
    });

    const filteredRows = rows.filter((r) => !r.every((c) => /^[-:\s]+$/.test(c)));
    if (filteredRows.length > 0) {
      const headerRow = filteredRows[0];
      const bodyRows = filteredRows.slice(1);
      elements.push(
        <div key={`table-${key}`} className="my-2.5 overflow-x-auto rounded-lg border border-slate-200 shadow-2xs">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 font-semibold text-slate-700">
              <tr>
                {headerRow.map((col, cIdx) => (
                  <th key={cIdx} className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-slate-600 bg-slate-50">
                    {renderFormattedInline(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {bodyRows.map((bRow, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50/60 transition-colors">
                  {bRow.map((cell, cIdx) => (
                    <td 
                      key={cIdx} 
                      className={`px-3 py-2 text-slate-800 align-top ${
                        cIdx === 0 && bRow.length > 1 
                          ? "font-semibold text-slate-900 whitespace-nowrap bg-slate-50/40 w-32" 
                          : ""
                      }`}
                    >
                      {renderFormattedInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    tableRows = [];
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    // Accept table rows even if trailing pipe is omitted or line has multiple cells
    const isTableRow = trimmed.startsWith("|") && (trimmed.endsWith("|") || (trimmed.match(/\|/g) || []).length >= 2);
    if (isTableRow) {
      let normalized = trimmed;
      if (!normalized.endsWith("|")) {
        normalized += " |";
      }
      tableRows.push(normalized);
      return;
    }
    if (tableRows.length > 0) {
      flushTable(idx);
    }

    if (!trimmed) {
      elements.push(<div key={idx} className="h-1" />);
      return;
    }

    if (trimmed.startsWith("# ") || trimmed.startsWith("## ") || trimmed.startsWith("### ")) {
      const headingText = trimmed.replace(/^#+\s*/, "");
      elements.push(
        <h4 key={idx} className="font-display font-bold text-xs text-slate-900 mt-2.5 pt-1 pb-0.5 border-b border-slate-200">
          {headingText}
        </h4>
      );
      return;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      const content = trimmed.substring(2);
      elements.push(
        <div key={idx} className="flex items-start gap-1.5 pl-1.5">
          <span className="text-slate-400 select-none mt-0.5">•</span>
          <span className="flex-1">{renderFormattedInline(content)}</span>
        </div>
      );
      return;
    }

    if (trimmed.startsWith("⚠️") || trimmed.startsWith("✅") || trimmed.startsWith("⏳")) {
      const isWarning = trimmed.startsWith("⚠️");
      elements.push(
        <div
          key={idx}
          className={`p-2 rounded text-[11px] border font-medium ${
            isWarning
              ? "bg-amber-50 text-amber-900 border-amber-200"
              : "bg-emerald-50 text-emerald-900 border-emerald-200"
          }`}
        >
          {renderFormattedInline(trimmed)}
        </div>
      );
      return;
    }

    elements.push(
      <div key={idx} className="leading-relaxed">
        {renderFormattedInline(trimmed)}
      </div>
    );
  });

  if (tableRows.length > 0) {
    flushTable(lines.length);
  }

  return <div className="space-y-2 text-xs leading-relaxed text-slate-800">{elements}</div>;
}

export default function AskCalmWorkChat({
  isDrawer = false,
  onClose,
  engagementId,
  customerName,
  activeTab: propActiveTab,
  selectedItemContext: propSelectedItemContext,
  initialQuery
}: AskCalmWorkChatProps) {
  const {
    activeCustomer,
    activeTab: contextActiveTab,
    selectedItemContext: contextSelectedItem,
    setSelectedItemContext
  } = useEngagement();

  const targetEngagementId = engagementId || activeCustomer.id;
  const targetCustomerName = customerName || activeCustomer.customerName;
  const currentTab = propActiveTab || contextActiveTab || "myday";
  const currentSelectedItem = propSelectedItemContext !== undefined ? propSelectedItemContext : contextSelectedItem;
  const { isManager, isFDE, user, token } = useAuth();
  const [query, setQuery] = useState(initialQuery || "");
  const [loading, setLoading] = useState(false);
  const [attachedScreenshot, setAttachedScreenshot] = useState<AttachedScreenshot | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [simulatedEscalations, setSimulatedEscalations] = useState<Record<string, boolean>>({});
  const [approvedUpdates, setApprovedUpdates] = useState<Record<string, boolean>>({});
  const [submittedUpdates, setSubmittedUpdates] = useState<Record<string, boolean>>({});
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const handleApproveCustomerUpdateInChat = async (engId: string) => {
    setActionLoadingId(engId);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const authToken = isManager && token ? token : "demo-manager-token";
      headers["Authorization"] = `Bearer ${authToken}`;
      const res = await fetch(`${API_BASE}/engagements/${engId}/customer-updates/approve`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "APPROVE",
          actor_id: user?.id || "usr-mgr-002",
          decision_note: "Manager authorized customer update via CalmWork Chat."
        })
      });
      if (res.ok) {
        setApprovedUpdates((prev) => ({ ...prev, [engId]: true }));
        setSubmittedUpdates((prev) => ({ ...prev, [engId]: false }));
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("calmwork-state-change", { detail: { engagementId: engId } }));
          if ("BroadcastChannel" in window) {
            const ch = new BroadcastChannel("calmwork_governance_bus");
            ch.postMessage({ engagementId: engId, type: "CUSTOMER_UPDATE_APPROVED" });
            ch.close();
          }
        }
      }
    } catch (err) {
      console.error("Failed to approve update in chat:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Authoritative background synchronization of customer update approval status
  const checkUpdateApprovalStatus = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/engagements/${targetEngagementId}/customer-updates/status`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          if (json.data.approved) {
            setApprovedUpdates((prev) => ({ ...prev, [targetEngagementId]: true }));
            setSubmittedUpdates((prev) => ({ ...prev, [targetEngagementId]: false }));
          } else if (json.data.status === "PENDING") {
            setApprovedUpdates((prev) => ({ ...prev, [targetEngagementId]: false }));
            setSubmittedUpdates((prev) => ({ ...prev, [targetEngagementId]: true }));
          } else {
            setApprovedUpdates((prev) => ({ ...prev, [targetEngagementId]: false }));
            setSubmittedUpdates((prev) => ({ ...prev, [targetEngagementId]: false }));
          }
        }
      }
    } catch {
      // Status rehydration fallback
    }
  }, [targetEngagementId, token]);

  useEffect(() => {
    checkUpdateApprovalStatus();

    const handleSync = (e: any) => {
      if (!e?.detail?.engagementId || e.detail.engagementId === targetEngagementId) {
        checkUpdateApprovalStatus();
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("calmwork-state-change", handleSync);
    }

    let ch: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        ch = new BroadcastChannel("calmwork_governance_bus");
        ch.onmessage = (event) => {
          if (!event.data?.engagementId || event.data.engagementId === targetEngagementId) {
            checkUpdateApprovalStatus();
          }
        };
      } catch {
        // BroadcastChannel fallback
      }
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("calmwork-state-change", handleSync);
      }
      if (ch) ch.close();
    };
  }, [checkUpdateApprovalStatus, targetEngagementId]);

  const handleSubmitCustomerUpdateInChat = async (draft: CustomerUpdateDraft) => {
    setActionLoadingId(draft.engagement_id);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/engagements/${draft.engagement_id}/customer-updates/submit`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          subject: draft.subject,
          executive_summary: draft.executive_summary,
          key_milestones_achieved: draft.key_milestones_achieved,
          next_milestone_target: draft.next_milestone_target,
          customer_action_items: draft.customer_action_items,
          privacy_scrubbed: draft.privacy_scrubbed
        })
      });
      if (res.ok) {
        setSubmittedUpdates((prev) => ({ ...prev, [draft.engagement_id]: true }));
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("calmwork-state-change", { detail: { engagementId: draft.engagement_id } }));
          if ("BroadcastChannel" in window) {
            const ch = new BroadcastChannel("calmwork_governance_bus");
            ch.postMessage({ engagementId: draft.engagement_id, type: "CUSTOMER_UPDATE_SUBMITTED" });
            ch.close();
          }
        }
      }
    } catch (err) {
      console.error("Failed to submit update in chat:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handlePrintCustomerUpdateInChat = (draft: CustomerUpdateDraft) => {
    printCustomerUpdateDocument({
      customerName: draft.customer_name || targetCustomerName,
      engagementName: targetCustomerName,
      subject: draft.subject,
      executiveSummary: draft.executive_summary,
      keyMilestonesAchieved: draft.key_milestones_achieved,
      nextMilestoneTarget: draft.next_milestone_target,
      customerActionItems: draft.customer_action_items,
      status: "APPROVED",
      isApproved: true,
      privacyScrubbed: draft.privacy_scrubbed
    });
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const msgSeqRef = useRef<number>(1);
  const defaultWelcomeMessage: ChatMessage = {
    id: `msg-welcome-${targetEngagementId}`,
    sender: "SUPERVISOR",
    text: `Hello! I am the CalmWork Supervisor for ${targetCustomerName}. Ask about project status, scope changes, blockers, or attach error logs and screenshots for quick diagnosis.`,
    intent: "MULTI_AGENT",
    delegatedAgent: {
      id: "MULTI_AGENT",
      name: "CalmWork Supervisor",
      role: "Multi-Agent Orchestration",
      badge_label: "Universal Orchestrator",
      color: "slate"
    },
    capabilitiesUsed: ["PLAN", "KNOW", "MOVE", "DELIVER", "SUPPORT"],
    suggestedFollowups: [
      "What changed today in scope & work plan?",
      "What should I do next? (Next action)",
      "What is the technical architecture & specs?",
      "Draft an executive customer update."
    ],
    timestamp: getNowISTTime(true)
  };

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return workspaceChatMemoryCache[targetEngagementId] || [defaultWelcomeMessage];
  });

  const [fetchingHistory, setFetchingHistory] = useState(false);

  // Sync / Rehydrate chat history from in-memory cache and PostgreSQL database on workspace switch
  useEffect(() => {
    // 1. Instant recall from memory cache (0ms perceived lag)
    if (workspaceChatMemoryCache[targetEngagementId] && workspaceChatMemoryCache[targetEngagementId].length > 0) {
      setMessages(workspaceChatMemoryCache[targetEngagementId]);
    } else {
      setMessages([defaultWelcomeMessage]);
    }

    // 2. Background rehydration from PostgreSQL database
    let isCancelled = false;
    setFetchingHistory(!workspaceChatMemoryCache[targetEngagementId]);

    fetch(`${API_BASE}/engagements/${targetEngagementId}/supervisor/messages`)
      .then((res) => res.json())
      .then((data) => {
        if (!isCancelled && data.success && Array.isArray(data.data) && data.data.length > 0) {
          workspaceChatMemoryCache[targetEngagementId] = data.data;
          setMessages(data.data);
        }
      })
      .catch((err) => {
        console.warn("Failed to fetch persisted workspace chat history:", err);
      })
      .finally(() => {
        if (!isCancelled) {
          setFetchingHistory(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [targetEngagementId, targetCustomerName]);

  const appendMessage = (newMsg: ChatMessage) => {
    setMessages((prev) => {
      const updated = [...prev, newMsg];
      workspaceChatMemoryCache[targetEngagementId] = updated;
      return updated;
    });
  };

  const handleClearHistory = async () => {
    if (!confirm(`Clear conversation history for workspace "${targetCustomerName}"?`)) return;
    try {
      await fetch(`${API_BASE}/engagements/${targetEngagementId}/supervisor/messages`, {
        method: "DELETE"
      });
      delete workspaceChatMemoryCache[targetEngagementId];
      setMessages([defaultWelcomeMessage]);
    } catch (err) {
      console.error("Failed to clear workspace chat history:", err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const [prevInitialQuery, setPrevInitialQuery] = useState(initialQuery);
  if (initialQuery !== prevInitialQuery) {
    setPrevInitialQuery(initialQuery);
    if (initialQuery) {
      setQuery(initialQuery);
    }
  }

  // File size limit: 4.5 MB
  const MAX_FILE_BYTES = 4.5 * 1024 * 1024;

  const processImageFile = (file: File, fallbackName = "screenshot.png") => {
    setAttachmentError(null);

    // Validate MIME type
    if (!file.type.startsWith("image/")) {
      setAttachmentError("Unsupported file type. Please select an image (PNG, JPEG, WebP, GIF).");
      return;
    }

    // Validate File Size
    if (file.size > MAX_FILE_BYTES) {
      const mbSize = (file.size / (1024 * 1024)).toFixed(1);
      setAttachmentError(`Image size (${mbSize} MB) exceeds maximum allowed payload limit of 4.5 MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachedScreenshot({
        dataUrl: reader.result as string,
        filename: file.name || fallbackName,
        sizeBytes: file.size,
        fileType: file.type || "image/png"
      });
    };
    reader.onerror = () => {
      setAttachmentError("Failed to read image file. Please try again.");
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    // Reset file input so the same file can be re-selected if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          processImageFile(file, `pasted-screenshot-${Date.now().toString().slice(-4)}.png`);
          break;
        }
      }
    }
  };

  const handleSend = async (textToSend?: string) => {
    const q = textToSend !== undefined ? textToSend : query;
    if ((!q.trim() && !attachedScreenshot) || loading) return;

    const userText = q.trim() || (attachedScreenshot ? "Analyze attached screenshot for production incident diagnostic." : "");
    const capturedScreenshot = attachedScreenshot;

    const userMsg: ChatMessage = {
      id: `msg-usr-${msgSeqRef.current++}`,
      sender: "USER",
      text: userText,
      screenshotPreview: capturedScreenshot?.dataUrl,
      timestamp: getNowISTTime(true)
    };

    appendMessage(userMsg);
    setQuery("");
    setAttachedScreenshot(null);
    setAttachmentError(null);
    setLoading(true);

    try {
      if (capturedScreenshot) {
        // Route screenshot investigation through SUPPORT Agent endpoint
        const res = await fetch(`${API_BASE}/engagements/${targetEngagementId}/support/investigate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            issue_description: userText,
            screenshot_base64: capturedScreenshot.dataUrl,
            screenshot_metadata: {
              filename: capturedScreenshot.filename,
              size_bytes: capturedScreenshot.sizeBytes,
              mime_type: capturedScreenshot.fileType,
              active_tab: currentTab,
              selected_item: currentSelectedItem
            }
          })
        });

        const data = await res.json();
        if (data.success && data.data) {
          const inv: IncidentInvestigationResult = data.data;
          const supMsg: ChatMessage = {
            id: `msg-sup-${msgSeqRef.current++}`,
            sender: "SUPERVISOR",
            text: inv.summary,
            intent: "SUPPORT",
            delegatedAgent: {
              id: "SUPPORT",
              name: "SUPPORT Agent",
              role: "Production Support & Visual Diagnostics",
              badge_label: "Incident & Diagnostic Specialist",
              color: "emerald"
            },
            supportResult: inv,
            capabilitiesUsed: ["SUPPORT", "KNOW"],
            sources: inv.evidence_citations?.map((c, i) => ({
              title: `Runbook Citation #${i + 1}`,
              snippet: c,
              source_type: "INCIDENT_EVIDENCE"
            })),
            suggestedFollowups: [
              "What is the recommended runbook fix?",
              "Simulate SRE escalation",
              "How does this incident affect current milestone tasks?"
            ],
            timestamp: getNowISTTime(true)
          };
          appendMessage(supMsg);
        } else {
          throw new Error(data.detail || data.message || "Failed to investigate screenshot");
        }
      } else {
        // Normal text query through Supervisor Query endpoint with contextual grounding
        const contextPrefix = currentTab
          ? `[Context: Active Tab "${currentTab}"${currentSelectedItem ? `, Selected: "${currentSelectedItem}"` : ""}] `
          : "";

        const res = await fetch(`${API_BASE}/engagements/${targetEngagementId}/supervisor/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: `${contextPrefix}${userText}` })
        });
        const data = await res.json();

        if (data.success) {
          const intentDetected = data.data.intent_detected || "MULTI_AGENT";
          const meta = AGENT_META[intentDetected] || AGENT_META["MULTI_AGENT"];

          const delegated = data.data.delegated_agent || {
            id: intentDetected,
            name: meta.name,
            role: meta.role,
            badge_label: meta.badge,
            color: "slate"
          };

          const supMsg: ChatMessage = {
            id: `msg-sup-${msgSeqRef.current++}`,
            sender: "SUPERVISOR",
            text: data.data.answer,
            intent: intentDetected,
            delegatedAgent: delegated,
            capabilitiesUsed: data.data.capabilities_used,
            sources: data.data.sources,
            suggestedFollowups: data.data.suggested_followups,
            customerUpdate: data.data.customer_update,
            timestamp: getNowISTTime(true)
          };
          appendMessage(supMsg);
        }
      }
    } catch (err: unknown) {
      console.error("Supervisor / Support query failed:", err);
      const errMsg: ChatMessage = {
        id: `msg-err-${msgSeqRef.current++}`,
        sender: "SUPERVISOR",
        text: `⚠️ Query processing error: ${(err as Error).message || "Unable to reach CalmWork Supervisor"}. Please check connectivity or retry.`,
        intent: "MULTI_AGENT",
        timestamp: getNowISTTime(true)
      };
      appendMessage(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateEscalation = (incidentId: string) => {
    setSimulatedEscalations((prev) => ({
      ...prev,
      [incidentId]: true
    }));
  };

  return (
    <div
      onPaste={handlePaste}
      className={`bg-white border border-slate-200 rounded-lg shadow-2xs flex flex-col text-xs ${
        isDrawer ? "h-full w-full rounded-none border-0 shadow-none" : "h-[calc(100vh-210px)] min-h-[480px] sm:h-[650px]"
      }`}
    >
      {/* Header */}
      <div className="px-4 sm:px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 bg-slate-900 text-white rounded shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="truncate">
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-sm text-slate-900 truncate">Ask CalmWork</h2>
            </div>
            <p className="text-[11px] text-slate-500 font-mono truncate">
              {targetCustomerName} · Supervisor Multi-Agent Router & SUPPORT Diagnostics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-slate-500">
            <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">PLAN</span>
            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">KNOW</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">MOVE</span>
            <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">DELIVER</span>
          </div>

          <button
            type="button"
            onClick={handleClearHistory}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
            title="Clear workspace conversation history"
            aria-label="Clear chat history"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          {isDrawer && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition cursor-pointer"
              aria-label="Close Assistant Drawer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Selected Item Context Banner (if provided) */}
      {currentSelectedItem && (
        <div className="px-3.5 py-1.5 bg-purple-50/70 border-b border-purple-100 flex items-center justify-between text-[11px] text-purple-900 shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <Compass className="h-3.5 w-3.5 text-purple-600 shrink-0" />
            <span className="font-semibold text-purple-700">Item Context:</span>
            <span className="truncate font-mono">{currentSelectedItem}</span>
          </div>
          <button
            onClick={() => setSelectedItemContext(null)}
            className="text-purple-500 hover:text-purple-800 ml-2 text-[10px] underline cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}


      {/* Message Feed */}
      <div 
        role="log"
        aria-live="polite"
        aria-label="Conversation messages"
        className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 bg-slate-50/30"
      >
        {messages.map((m) => {
          const isUser = m.sender === "USER";
          const intentKey = m.intent || "MULTI_AGENT";
          const meta = AGENT_META[intentKey] || AGENT_META["MULTI_AGENT"];
          const AgentIcon = meta.icon;

          return (
            <div key={m.id} className={`flex gap-2.5 sm:gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
              {!isUser && (
                <div className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center shrink-0 border shadow-2xs ${meta.headerBg} ${meta.borderCol}`}>
                  <AgentIcon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${meta.iconCol}`} />
                </div>
              )}

              <div className={`max-w-2xl space-y-2 ${isUser ? "text-right" : "text-left"}`}>
                <div className={`inline-block rounded-lg text-xs overflow-hidden ${
                  isUser 
                    ? "p-3 bg-slate-900 text-white shadow-2xs" 
                    : "p-4 bg-white border border-slate-200 text-slate-900 shadow-2xs w-full"
                }`}>
                  {/* Explicit Specialist Handover Banner */}
                  {!isUser && (
                    <div className={`flex items-center justify-between p-2.5 -m-4 mb-3 border-b ${meta.headerBg} ${meta.borderCol}`}>
                      <div className="flex items-center gap-2">
                        <AgentIcon className={`h-3.5 w-3.5 ${meta.iconCol}`} />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-slate-900">
                              {m.delegatedAgent?.name || meta.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                              • {m.delegatedAgent?.role || meta.role}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {m.timestamp}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Message Content */}
                  {isUser ? (
                    <div>
                      {m.screenshotPreview && (
                        <div className="mb-2 rounded overflow-hidden border border-slate-700 bg-slate-950/40 p-1">
                          <img
                            src={m.screenshotPreview}
                            alt="Attached screenshot telemetry"
                            className="max-h-48 w-auto rounded object-contain mx-auto"
                          />
                        </div>
                      )}
                      <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                      <div className="text-[9px] text-slate-400 font-mono mt-1 text-right">
                        {m.timestamp}
                      </div>
                    </div>
                  ) : m.supportResult ? (
                    /* Structured SUPPORT Diagnostic Result */
                    <div className="space-y-3">
                      {/* Severity & Incident Badge */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                            m.supportResult.severity === "CRITICAL"
                              ? "bg-rose-100 text-rose-800 border-rose-300"
                              : m.supportResult.severity === "HIGH"
                              ? "bg-amber-100 text-amber-800 border-amber-300"
                              : m.supportResult.severity === "MEDIUM"
                              ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                              : "bg-emerald-100 text-emerald-800 border-emerald-300"
                          }`}>
                            {m.supportResult.severity} Incident
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            ID: {m.supportResult.incident_id}
                          </span>
                        </div>
                        {m.supportResult.privacy_scrubbed && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono">
                            <Lock className="h-2.5 w-2.5" />
                            <span>Privacy Scrubbed</span>
                          </span>
                        )}
                      </div>

                      {/* Summary */}
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs mb-1">Diagnostic Summary</h4>
                        <p className="text-slate-700 leading-relaxed">{m.supportResult.summary}</p>
                      </div>

                      {/* Visual Findings if present */}
                      {m.supportResult.visual_diagnostic_findings && (
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-[11px] space-y-1">
                          <div className="font-semibold text-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <ImageIcon className="h-3 w-3 text-slate-600" />
                              <span>Visual Telemetry Findings</span>
                            </div>
                            {m.supportResult.image_url && (
                              <a
                                href={m.supportResult.image_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-teal-700 hover:text-teal-900 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span>Cloudinary CDN</span>
                                <ArrowRight className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </div>
                          <p className="text-slate-600 font-mono text-[10px] leading-relaxed">
                            {m.supportResult.visual_diagnostic_findings}
                          </p>
                        </div>
                      )}

                      {/* Root Cause Hypothesis (Clearly labeled with uncertainty) */}
                      <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded text-[11px] space-y-1">
                        <div className="font-semibold text-amber-900 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                            <span>Root Cause Hypothesis</span>
                          </div>
                          <span className="text-[9px] font-mono font-medium text-amber-700 uppercase">
                            Hypothesis Grounded
                          </span>
                        </div>
                        <p className="text-amber-950 leading-relaxed font-sans">
                          {m.supportResult.root_cause_hypothesis}
                        </p>
                      </div>

                      {/* Affected Components */}
                      {m.supportResult.affected_components && m.supportResult.affected_components.length > 0 && (
                        <div>
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                            Affected Components:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {m.supportResult.affected_components.map((comp, idx) => (
                              <span key={idx} className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[10px] text-slate-800">
                                {comp}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Suggested Workaround */}
                      {m.supportResult.suggested_workaround && (
                        <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded text-[11px] space-y-1">
                          <div className="font-semibold text-emerald-900 flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Suggested Immediate Workaround</span>
                          </div>
                          <p className="text-emerald-950 leading-relaxed">
                            {m.supportResult.suggested_workaround}
                          </p>
                        </div>
                      )}

                      {/* Runbook Recommendations */}
                      {m.supportResult.runbook_recommendations && m.supportResult.runbook_recommendations.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <h5 className="font-semibold text-slate-900 text-[11px] flex items-center gap-1.5">
                            <BookOpen className="h-3.5 w-3.5 text-blue-600" />
                            <span>Runbook Remediation Steps:</span>
                          </h5>
                          <ul className="space-y-1 pl-1">
                            {m.supportResult.runbook_recommendations.map((step, sIdx) => (
                              <li key={sIdx} className="flex items-start gap-1.5 text-slate-700 text-[11px]">
                                <span className="font-mono text-blue-600 font-bold text-[10px] mt-0.5">{sIdx + 1}.</span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Simulated Human Handoff (Constraint: Honest, explicit simulation) */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                        {simulatedEscalations[m.supportResult.incident_id] ? (
                          <div className="p-2 bg-slate-100 border border-slate-200 rounded text-[10px] text-slate-600 w-full flex items-start gap-1.5">
                            <Radio className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                            <div>
                              <span className="font-bold text-slate-800">Simulated Incident Alert: </span>
                              <span>
                                Incident diagnosis recorded to CalmWork internal timeline. Note: No external paging or ticketing service was dispatched per sandbox environment policy.
                              </span>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSimulateEscalation(m.supportResult!.incident_id)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 rounded text-[11px] font-medium transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                          >
                            <Radio className="h-3 w-3 text-slate-500" />
                            <span>Simulate SRE Escalation</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : m.customerUpdate ? (
                    /* Structured DELIVER Executive Customer Update */
                    <div className="space-y-3">
                      {/* Header & Status Badge */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {approvedUpdates[m.customerUpdate.engagement_id] ? (
                            <span className="font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              <span>APPROVED BY MANAGER · READY TO DELIVER</span>
                            </span>
                          ) : submittedUpdates[m.customerUpdate.engagement_id] ? (
                            <span className="font-mono font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                              <Clock className="h-3 w-3 text-blue-600" />
                              <span>SUBMITTED FOR APPROVAL · PENDING MANAGER REVIEW</span>
                            </span>
                          ) : (
                            <span className="font-mono font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                              <FileText className="h-3 w-3 text-slate-500" />
                              <span>EXECUTIVE UPDATE DRAFT · EDITABLE</span>
                            </span>
                          )}
                        </div>
                        {m.customerUpdate.privacy_scrubbed && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-mono">
                            <ShieldCheck className="h-2.5 w-2.5 text-slate-500" />
                            <span>Privacy Scrubbed</span>
                          </span>
                        )}
                      </div>

                      {/* Subject */}
                      <div>
                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-0.5">Subject:</span>
                        <h4 className="font-bold text-slate-900 text-xs">{m.customerUpdate.subject}</h4>
                      </div>

                      {/* Executive Summary */}
                      <div>
                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-0.5">Executive Summary:</span>
                        <p className="text-slate-700 leading-relaxed text-xs whitespace-pre-wrap">{m.customerUpdate.executive_summary}</p>
                      </div>

                      {/* Key Milestones Achieved */}
                      {m.customerUpdate.key_milestones_achieved && m.customerUpdate.key_milestones_achieved.length > 0 && (
                        <div>
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-0.5">Key Milestones Achieved:</span>
                          <ul className="list-disc list-inside space-y-1 text-slate-700 text-xs">
                            {m.customerUpdate.key_milestones_achieved.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Next Milestone Target */}
                      {m.customerUpdate.next_milestone_target && (
                        <div>
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-0.5">Next Milestone Target:</span>
                          <p className="text-slate-700 text-xs">{m.customerUpdate.next_milestone_target}</p>
                        </div>
                      )}

                      {/* Customer Action Items */}
                      {m.customerUpdate.customer_action_items && m.customerUpdate.customer_action_items.length > 0 && (
                        <div className="p-2 bg-amber-50/70 border border-amber-200 rounded">
                          <span className="text-[10px] font-mono text-amber-800 font-bold uppercase tracking-wider block mb-0.5">Required Customer Action:</span>
                          <ul className="list-disc list-inside space-y-0.5 text-amber-950 font-medium text-xs">
                            {m.customerUpdate.customer_action_items.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Action Footer */}
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {!approvedUpdates[m.customerUpdate.engagement_id] ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleSubmitCustomerUpdateInChat(m.customerUpdate!)}
                                disabled={actionLoadingId === m.customerUpdate.engagement_id}
                                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                                title="Submit this customer update draft for Manager review"
                              >
                                <Send className="h-3 w-3 text-blue-300" />
                                <span>
                                  {actionLoadingId === m.customerUpdate.engagement_id
                                    ? "Submitting..."
                                    : submittedUpdates[m.customerUpdate.engagement_id]
                                    ? "Re-Send for Approval"
                                    : "Send for Approval"}
                                </span>
                              </button>

                              {isManager && (
                                <button
                                  type="button"
                                  onClick={() => handleApproveCustomerUpdateInChat(m.customerUpdate!.engagement_id)}
                                  disabled={actionLoadingId === m.customerUpdate.engagement_id}
                                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                                  title="Authorize and approve release for client distribution"
                                >
                                  {actionLoadingId === m.customerUpdate.engagement_id ? (
                                    <Sparkles className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  )}
                                  <span>
                                    {actionLoadingId === m.customerUpdate.engagement_id
                                      ? "Approving..."
                                      : "Approve Customer Update"}
                                  </span>
                                </button>
                              )}

                              {!isManager && submittedUpdates[m.customerUpdate.engagement_id] && (
                                <span className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded font-medium flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-blue-600" />
                                  <span>Pending Manager Approval</span>
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded font-semibold flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              <span>Approved by Manager · Ready to Deliver</span>
                            </span>
                          )}

                          {/* Print / Preview button — Available to Both Roles Once Approved */}
                          <button
                            type="button"
                            onClick={() => handlePrintCustomerUpdateInChat(m.customerUpdate!)}
                            disabled={!approvedUpdates[m.customerUpdate.engagement_id]}
                            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs ${
                              approvedUpdates[m.customerUpdate.engagement_id]
                                ? "bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 cursor-pointer"
                                : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60"
                            }`}
                            title={approvedUpdates[m.customerUpdate.engagement_id] ? "Print / Preview Executive Report" : "Available after Engineering Manager approval"}
                          >
                            <Printer className="h-3.5 w-3.5 text-slate-500" />
                            <span>Print / Preview</span>
                          </button>
                        </div>

                        <a
                          href={`/engagements/${m.customerUpdate.engagement_id}?tab=updates`}
                          className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold underline flex items-center gap-1"
                        >
                          <span>Open Update Studio</span>
                          <ArrowRight className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <FormattedMessageBody rawText={m.text} />
                  )}
                </div>


                {/* Grounded Knowledge Sources */}
                {!isUser && m.sources && m.sources.length > 0 && (
                  <div className="p-2.5 bg-slate-100/80 border border-slate-200 rounded text-[11px] text-slate-700 space-y-1.5 ml-1">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                      <BookOpen className="h-3.5 w-3.5 text-blue-600" />
                      <span>Verified Knowledge Sources ({m.sources.length}):</span>
                    </div>
                    {m.sources.map((s, idx) => {
                      const typeBadge = {
                        DOCUMENT: "bg-blue-100 text-blue-800 border-blue-200",
                        WORKNOTE: "bg-emerald-100 text-emerald-800 border-emerald-200",
                        CUSTOMER_INPUT: "bg-purple-100 text-purple-800 border-purple-200",
                        DECISION: "bg-amber-100 text-amber-800 border-amber-200",
                        OBSERVATION: "bg-cyan-100 text-cyan-800 border-cyan-200",
                        WORK_PLAN: "bg-indigo-100 text-indigo-800 border-indigo-200",
                        OUTCOME: "bg-rose-100 text-rose-800 border-rose-200",
                        TIMELINE: "bg-slate-200 text-slate-800 border-slate-300",
                        INCIDENT_EVIDENCE: "bg-emerald-100 text-emerald-800 border-emerald-200"
                      }[s.source_type || "DOCUMENT"] || "bg-blue-100 text-blue-800 border-blue-200";

                      return (
                        <div key={idx} className="font-mono text-[10px] text-slate-600 pl-2 border-l-2 border-blue-400 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${typeBadge}`}>
                              {s.source_type || "DOCUMENT"}
                            </span>
                            <span className="font-bold text-slate-800">{s.title}</span>
                          </div>
                          <div className="text-slate-600">{s.snippet}</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Dynamic Suggested Follow-ups */}
                {!isUser && m.suggestedFollowups && m.suggestedFollowups.length > 0 && (
                  <div className="pt-1.5 pl-1 space-y-1">
                    <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider block">
                      Suggested Follow-Ups:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {m.suggestedFollowups.map((followUp, fIdx) => (
                        <button
                          key={fIdx}
                          onClick={() => handleSend(followUp)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 text-slate-700 rounded-full text-[10px] transition font-medium flex items-center gap-1 shadow-2xs cursor-pointer"
                        >
                          <span>{followUp}</span>
                          <ArrowRight className="h-2.5 w-2.5 text-slate-400" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {isUser && (
                <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                  <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Dynamic Specialist Routing State */}
        {loading && (
          <div className="flex items-center gap-2.5 text-slate-600 font-mono text-[11px] p-3 bg-white border border-slate-200 rounded-lg w-fit shadow-2xs animate-fadeIn">
            <RefreshCw className="h-3.5 w-3.5 text-slate-700 animate-spin" />
            <span>CalmWork AI is thinking now and will handover to specialist agent</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachment Preview Chip */}
      {attachedScreenshot && (
        <div className="px-3 py-2 bg-emerald-50/60 border-t border-emerald-200 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={attachedScreenshot.dataUrl}
              alt="Screenshot attachment preview"
              className="h-9 w-9 rounded object-cover border border-emerald-300 shadow-2xs shrink-0"
            />
            <div className="truncate">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-emerald-950 truncate">{attachedScreenshot.filename}</span>
                <span className="text-[10px] font-mono text-emerald-700">
                  ({(attachedScreenshot.sizeBytes / 1024).toFixed(0)} KB)
                </span>
              </div>
              <span className="text-[10px] text-emerald-800 font-medium">
                Routes to SUPPORT Agent · Diagnostic Investigation
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAttachedScreenshot(null)}
            className="p-1 rounded text-emerald-700 hover:text-emerald-950 hover:bg-emerald-100 transition cursor-pointer"
            aria-label="Remove screenshot attachment"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Attachment Error Notice */}
      {attachmentError && (
        <div className="px-3 py-2 bg-rose-50 border-t border-rose-200 flex items-center justify-between text-xs text-rose-800 shrink-0">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
            <span>{attachmentError}</span>
          </div>
          <button
            type="button"
            onClick={() => setAttachmentError(null)}
            className="text-rose-600 hover:text-rose-800 text-[10px] font-bold uppercase underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-2.5 sm:p-3 border-t border-slate-200 bg-white flex items-center gap-2 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        {/* Hidden File Input for Image Selection */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Upload screenshot or error image"
        />

        {/* Paperclip / Image Attachment Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition cursor-pointer border border-slate-200 shrink-0 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          title="Attach or paste screenshot for SUPPORT agent diagnostic (Ctrl+V / Cmd+V supported)"
          aria-label="Attach screenshot or error log"
        >
          <ImageIcon className="h-4 w-4" />
        </button>

        <input
          type="text"
          placeholder={
            attachedScreenshot
              ? "Describe observed issue or leave blank for automated visual triage..."
              : "Ask CalmWork anything, or paste a screenshot (Ctrl+V)..."
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Ask CalmWork query input"
          className="flex-1 px-3.5 py-2.5 border border-slate-200 rounded-md text-base sm:text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 bg-slate-50/50 min-h-[44px]"
        />

        <button
          type="submit"
          disabled={loading || (!query.trim() && !attachedScreenshot)}
          className="px-4 py-2.5 min-h-[44px] min-w-[44px] bg-slate-900 hover:bg-slate-800 text-white rounded-md font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        >
          <span>{attachedScreenshot ? "Investigate" : "Ask"}</span>
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
