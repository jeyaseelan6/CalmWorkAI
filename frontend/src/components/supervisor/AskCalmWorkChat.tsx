"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  Bot,
  User,
  Compass,
  Zap,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  RefreshCw
} from "lucide-react";
import { useEngagement } from "@/context/EngagementContext";
import { getNowISTTime } from "@/utils/date";

interface DelegatedAgent {
  id: string;
  name: string;
  role: string;
  badge_label: string;
  color: string;
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
  timestamp: string;
}
import { API_BASE } from "@/utils/api";

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
  UNDERSTAND: {
    name: "UNDERSTAND Agent",
    role: "Requirements & Scope Intelligence",
    badge: "Scope & Contract Specialist",
    icon: Compass,
    headerBg: "bg-purple-50/90",
    borderCol: "border-purple-200",
    iconCol: "text-purple-600",
    badgeBg: "bg-purple-100 text-purple-800 border-purple-300"
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
    name: "CalmWork Plan Agent",
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
  // Parse **bold**, *italic*, and `code`
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
  // Strip out redundant handover banners and trailing Source: lines
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

    // Header ###
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h4 key={idx} className="font-display font-bold text-xs text-slate-900 mt-2.5 pt-1 pb-0.5 border-b border-slate-200">
          {trimmed.replace(/^###\s*/, "")}
        </h4>
      );
      return;
    }

    // Bullet point
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

    // Highlight alerts (⚠️, ✅, ⏳)
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

    // Standard paragraph
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

export default function AskCalmWorkChat() {
  const { activeCustomer } = useEngagement();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-welcome",
      sender: "SUPERVISOR",
      text: `Hello! I am the CalmWork Universal Plan Agent. Ask me anything about ${activeCustomer.customerName}'s current state, scope changes, blockers, or stakeholder communications. I will automatically route your request to the specialized agent best equipped to assist you.`,
      intent: "MULTI_AGENT",
      delegatedAgent: {
        id: "MULTI_AGENT",
        name: "CalmWork Plan Agent",
        role: "Central Multi-Agent Orchestration",
        badge_label: "Universal Orchestrator",
        color: "slate"
      },
      capabilitiesUsed: ["UNDERSTAND", "MOVE", "DELIVER", "KNOW"],
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

  const handleSend = async (textToSend?: string) => {
    const q = textToSend || query;
    if (!q.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: "USER",
      text: q.trim(),
      timestamp: getNowISTTime(true)
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuery("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/engagements/${activeCustomer.id}/supervisor/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q.trim() })
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
          id: `msg-${Date.now()}-sup`,
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
    } catch (err) {
      console.error("Supervisor query failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-2xs flex flex-col h-[650px] text-xs">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-slate-900 text-white rounded">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display font-bold text-sm text-slate-900">Ask CalmWork (Universal Assistant)</h2>
            <p className="text-[11px] text-slate-500 font-mono">Plan Agent — Central Intent Classification & Specialist Handover</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
          <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">UNDERSTAND</span>
          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">MOVE</span>
          <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">DELIVER</span>
          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">KNOW</span>
        </div>
      </div>

      {/* Suggested Prompt Chips */}
      <div className="p-3 bg-slate-50/60 border-b border-slate-200 flex items-center gap-2 overflow-x-auto text-[11px]">
        <span className="font-semibold text-slate-400 shrink-0 uppercase tracking-wider text-[10px] font-mono">Suggested:</span>
        {[
          { label: "What changed today?", tag: "Scope" },
          { label: "Why is production blocked?", tag: "Blockers" },
          { label: "What should I do next?", tag: "Velocity" },
          { label: "Prepare a customer update.", tag: "Stakeholders" }
        ].map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(chip.label)}
            className="px-2.5 py-1 bg-white border border-slate-200 hover:border-slate-400 text-slate-700 rounded-full shrink-0 transition font-medium flex items-center gap-1 shadow-2xs hover:bg-slate-50"
          >
            <span>{chip.label}</span>
          </button>
        ))}
      </div>

      {/* Message Feed */}
      <div className="flex-1 p-5 overflow-y-auto space-y-5 bg-slate-50/30">
        {messages.map((m) => {
          const isUser = m.sender === "USER";
          const intentKey = m.intent || "MULTI_AGENT";
          const meta = AGENT_META[intentKey] || AGENT_META["MULTI_AGENT"];
          const AgentIcon = meta.icon;

          return (
            <div key={m.id} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
              {!isUser && (
                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 border shadow-2xs ${meta.headerBg} ${meta.borderCol}`}>
                  <AgentIcon className={`h-4 w-4 ${meta.iconCol}`} />
                </div>
              )}

              <div className={`max-w-2xl space-y-2 ${isUser ? "text-right" : "text-left"}`}>
                <div className={`inline-block rounded-lg text-xs overflow-hidden ${
                  isUser 
                    ? "p-3.5 bg-slate-900 text-white shadow-2xs" 
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
                      <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                      <div className="text-[9px] text-slate-400 font-mono mt-1 text-right">
                        {m.timestamp}
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
                        TIMELINE: "bg-slate-200 text-slate-800 border-slate-300"
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
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 text-slate-700 rounded-full text-[10px] transition font-medium flex items-center gap-1 shadow-2xs"
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
                <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Dynamic Specialist Routing State */}
        {loading && (
          <div className="flex items-center gap-2.5 text-slate-600 font-mono text-[11px] p-3 bg-white border border-slate-200 rounded-lg w-fit shadow-2xs">
            <RefreshCw className="h-3.5 w-3.5 text-slate-700 animate-spin" />
            <span>Plan Agent detecting intent & handing over to specialist agent...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3 border-t border-slate-200 bg-white flex items-center gap-2"
      >
        <input
          type="text"
          placeholder="Ask CalmWork anything about requirements, blockers, or next steps..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 px-3.5 py-2 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 bg-slate-50/50"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md font-semibold text-xs transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
        >
          <span>Ask</span>
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
