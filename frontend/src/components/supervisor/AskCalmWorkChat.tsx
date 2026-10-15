"use client";

import React, { useState, useRef, useEffect } from "react";
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
  Radio
} from "lucide-react";
import { useEngagement } from "@/context/EngagementContext";
import { getNowISTTime } from "@/utils/date";
import { API_BASE } from "@/utils/api";

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
  }
};

function renderFormattedInline(str: string) {
  const segments = str.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
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
    const rows = tableRows.map((r) =>
      r
        .split("|")
        .map((c) => c.trim())
        .filter((_, i, arr) => i > 0 && i < arr.length - 1)
    );
    const filteredRows = rows.filter((r) => !r.every((c) => /^[-:\s]+$/.test(c)));
    if (filteredRows.length > 0) {
      const headerRow = filteredRows[0];
      const bodyRows = filteredRows.slice(1);
      elements.push(
        <div key={`table-${key}`} className="my-2 overflow-x-auto rounded border border-slate-200 shadow-2xs">
          <table className="min-w-full divide-y divide-slate-200 text-[11px]">
            <thead className="bg-slate-50 font-semibold text-slate-700">
              <tr>
                {headerRow.map((col, cIdx) => (
                  <th key={cIdx} className="px-2.5 py-1.5 text-left font-mono text-[10px] uppercase tracking-wider">
                    {renderFormattedInline(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {bodyRows.map((bRow, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50/50">
                  {bRow.map((cell, cIdx) => (
                    <td key={cIdx} className="px-2.5 py-1.5 text-slate-800">
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
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      tableRows.push(trimmed);
      return;
    }
    if (tableRows.length > 0) {
      flushTable(idx);
    }

    if (!trimmed) {
      elements.push(<div key={idx} className="h-1" />);
      return;
    }

    if (trimmed.startsWith("### ")) {
      elements.push(
        <h4 key={idx} className="font-display font-bold text-xs text-slate-900 mt-2.5 pt-1 pb-0.5 border-b border-slate-200">
          {trimmed.replace(/^###\s*/, "")}
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
      <p key={idx}>
        {renderFormattedInline(trimmed)}
      </p>
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

  const [query, setQuery] = useState(initialQuery || "");
  const [loading, setLoading] = useState(false);
  const [attachedScreenshot, setAttachedScreenshot] = useState<AttachedScreenshot | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [simulatedEscalations, setSimulatedEscalations] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const msgSeqRef = useRef<number>(1);

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
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
        "What changed today?",
        "Why is production blocked?",
        "What should I do next?",
        "Prepare a customer update."
      ],
      timestamp: getNowISTTime(true)
    }
  ]);

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

    setMessages((prev) => [...prev, userMsg]);
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
          setMessages((prev) => [...prev, supMsg]);
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
            timestamp: getNowISTTime(true)
          };
          setMessages((prev) => [...prev, supMsg]);
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
      setMessages((prev) => [...prev, errMsg]);
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
            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">SUPPORT</span>
          </div>

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
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <ImageIcon className="h-3 w-3 text-slate-600" />
                            <span>Visual Telemetry Findings</span>
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
                  ) : (
                    <FormattedMessageBody rawText={m.text} />
                  )}
                </div>

                {/* Capabilities Used */}
                {!isUser && m.capabilitiesUsed && m.capabilitiesUsed.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] pl-1">
                    <span className="font-mono text-slate-400">Capabilities:</span>
                    {m.capabilitiesUsed.map((cap) => (
                      <span key={cap} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded font-mono font-semibold">
                        {cap}
                      </span>
                    ))}
                  </div>
                )}

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
            <span>CalmWork Supervisor detecting intent & handing over to specialist agent...</span>
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
