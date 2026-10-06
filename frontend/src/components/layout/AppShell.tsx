"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Briefcase, 
  CheckSquare, 
  BookOpen, 
  Clock, 
  ShieldCheck, 
  LayoutDashboard, 
  UserCheck, 
  AlertTriangle,
  Search,
  Lock
} from "lucide-react";

export type Role = "FDE" | "MANAGER";

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [role, setRole] = useState<Role>("FDE");
  const [activeTab, setActiveTab] = useState<string>("my-work");

  const fdeNav: NavItem[] = [
    { id: "my-work", label: "My Work", icon: Briefcase },
    { id: "engagements", label: "Engagements", icon: CheckSquare },
    { id: "knowledge", label: "Knowledge", icon: BookOpen },
    { id: "timeline", label: "Timeline", icon: Clock },
  ];

  const managerNav: NavItem[] = [
    { id: "control-center", label: "Control Center", icon: LayoutDashboard },
    { id: "engagements", label: "Engagements", icon: CheckSquare },
    { id: "approvals", label: "Approvals", icon: ShieldCheck, badge: 1 },
    { id: "knowledge", label: "Knowledge", icon: BookOpen },
    { id: "timeline", label: "Timeline", icon: Clock },
  ];

  const currentNav = role === "FDE" ? fdeNav : managerNav;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900 flex flex-col justify-between p-4">
        <div>
          {/* Logo & Workspace Title */}
          <div className="flex items-center gap-3 px-2 py-3 mb-6 border-b border-slate-800">
            <div className="h-8 w-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 font-bold text-lg">
              C
            </div>
            <div>
              <h1 className="font-semibold text-slate-100 text-sm tracking-wide">CalmWork AI</h1>
              <p className="text-xs text-slate-400">Work-Intelligence Layer</p>
            </div>
          </div>

          {/* Role Switcher */}
          <div className="mb-6 px-2">
            <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-2">
              View Experience
            </label>
            <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-md border border-slate-800 text-xs font-medium">
              <button
                onClick={() => {
                  setRole("FDE");
                  setActiveTab("my-work");
                }}
                className={`py-1.5 rounded transition-all text-center ${
                  role === "FDE" 
                    ? "bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm" 
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                FDE
              </button>
              <button
                onClick={() => {
                  setRole("MANAGER");
                  setActiveTab("control-center");
                }}
                className={`py-1.5 rounded transition-all text-center ${
                  role === "MANAGER" 
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm" 
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Manager
              </button>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {currentNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-slate-800 text-teal-400 border-l-2 border-teal-400"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge ? (
                    <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded-full border border-amber-500/30">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Privacy Guardrail Active Footer */}
        <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 text-xs">
          <div className="flex items-center gap-2 text-teal-400 font-medium mb-1">
            <Lock className="h-3.5 w-3.5" />
            <span>AI Privacy Guardrail</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-tight">
            Pre-boundary DLP & stable token reference active.
          </p>
        </div>
      </aside>

      {/* Main Content Workspace Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-slate-800 bg-slate-900/50 px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Ask or search engagement..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500/50"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono">
              Role: <strong className={role === "FDE" ? "text-teal-400" : "text-amber-400"}>{role}</strong>
            </span>
            <div className="h-7 w-7 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center text-xs font-semibold">
              {role === "FDE" ? "FE" : "MG"}
            </div>
          </div>
        </header>

        {/* Main Body Canvas */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
