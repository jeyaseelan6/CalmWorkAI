"use client";

import React, { useState } from "react";
import { Sparkles, Send, Bot, User, CheckCircle2, ShieldCheck, ArrowRight, AlertTriangle, BookOpen } from "lucide-react";
import { useEngagement } from "@/context/EngagementContext";
import { getNowISTTime } from "@/utils/date";

interface ChatMessage {
  id: string;
  sender: "USER" | "SUPERVISOR";
  text: string;
  intent?: string;
  capabilitiesUsed?: string[];
  sources?: { title: string; snippet: string }[];
  suggestedFollowups?: string[];
  timestamp: string;
}

export default function AskCalmWorkChat() {
  const { activeCustomer } = useEngagement();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-welcome",
      sender: "SUPERVISOR",
      text: `Hello! I am the CalmWork Plan Agent. Ask me anything about ${activeCustomer.customerName}'s current state, scope changes, blockers, or stakeholder communications.`,
      intent: "SUPERVISOR",
      capabilitiesUsed: ["UNDERSTAND", "KNOW", "MOVE", "DELIVER"],
      timestamp: "Just now"
    }
  ]);

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
      const res = await fetch(`http://localhost:8000/api/v1/engagements/${activeCustomer.id}/supervisor/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q.trim() })
      });
      const data = await res.json();

      if (data.success) {
        const supMsg: ChatMessage = {
          id: `msg-${Date.now()}-sup`,
          sender: "SUPERVISOR",
          text: data.data.answer,
          intent: data.data.intent_detected,
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
    <div className="bg-white border border-slate-200 rounded-lg shadow-2xs flex flex-col h-[600px] text-xs">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-slate-900 text-white rounded">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display font-bold text-sm text-slate-900">Ask CalmWork (Universal Assistant)</h2>
            <p className="text-[11px] text-slate-500 font-mono">Plan Agent — Central Orchestration & Routing</p>
          </div>
        </div>
      </div>

      {/* Suggested Prompt Chips */}
      <div className="p-3 bg-slate-50/50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto text-[11px]">
        <span className="font-semibold text-slate-400 shrink-0 uppercase tracking-wider text-[10px] font-mono">Suggested:</span>
        {[
          "What changed today?",
          "Why is production blocked?",
          "What should I do next?",
          "Prepare a customer update."
        ].map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(chip)}
            className="px-2.5 py-1 bg-white border border-slate-200 hover:border-slate-400 text-slate-700 rounded-full shrink-0 transition font-medium"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Message Feed */}
      <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/30">
        {messages.map((m) => {
          const isUser = m.sender === "USER";
          return (
            <div key={m.id} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
              {!isUser && (
                <div className="h-7 w-7 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div className={`max-w-2xl space-y-2 ${isUser ? "text-right" : "text-left"}`}>
                <div className={`inline-block p-3.5 rounded-lg text-xs ${
                  isUser 
                    ? "bg-slate-900 text-white shadow-2xs" 
                    : "bg-white border border-slate-200 text-slate-900 shadow-2xs"
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                </div>

                {!isUser && m.capabilitiesUsed && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="font-mono text-slate-400">Capabilities:</span>
                    {m.capabilitiesUsed.map((cap) => (
                      <span key={cap} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded font-mono font-semibold">
                        {cap}
                      </span>
                    ))}
                  </div>
                )}

                {!isUser && m.sources && m.sources.length > 0 && (
                  <div className="p-2 bg-slate-100/80 border border-slate-200 rounded text-[11px] text-slate-600 space-y-1">
                    <div className="flex items-center gap-1 font-semibold text-slate-800">
                      <BookOpen className="h-3 w-3 text-slate-500" />
                      <span>Verified Sources:</span>
                    </div>
                    {m.sources.map((s, idx) => (
                      <div key={idx} className="font-mono text-[10px] text-slate-600">
                        • {s.title}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {isUser && (
                <div className="h-7 w-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}
        {loading && (
          <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px] p-2 bg-white border border-slate-200 rounded w-fit animate-pulse">
            <Bot className="h-4 w-4 text-slate-700 animate-bounce" />
            <span>Plan Agent orchestrating specialists...</span>
          </div>
        )}
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
          className="flex-1 px-3 py-2 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 bg-slate-50/50"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md font-semibold text-xs transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
        >
          <span>Ask</span>
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
