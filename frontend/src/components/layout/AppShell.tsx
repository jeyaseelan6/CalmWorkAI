"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useEngagement } from "@/context/EngagementContext";
import { 
  Briefcase, 
  CheckSquare, 
  BookOpen, 
  Clock, 
  ShieldCheck, 
  LayoutDashboard, 
  Search,
  Lock,
  Building2,
  ChevronDown,
  LogOut,
  LogIn,
  User,
  Activity,
  Sparkles,
  Zap,
  Send
} from "lucide-react";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

function NavLinks() {
  const { role } = useAuth();
  const { approvedAcme } = useEngagement();
  const pathname = usePathname();

  const fdeNav: NavItem[] = [
    { id: "my-work", label: "My Work Cockpit", href: "/", icon: Briefcase },
    { id: "actions", label: "Next Best Action (MOVE)", href: "/actions", icon: Zap },
    { id: "intelligence", label: "Scope Impact (UNDERSTAND)", href: "/intelligence", icon: Sparkles },
    { id: "knowledge", label: "Knowledge Base (KNOW)", href: "/knowledge", icon: BookOpen },
    { id: "delivery", label: "Customer Studio (DELIVER)", href: "/delivery", icon: Send },
    { id: "timeline", label: "Audit Timeline", href: "/timeline", icon: Clock },
  ];

  const managerNav: NavItem[] = [
    { id: "control-center", label: "Control Center", href: "/", icon: LayoutDashboard },
    { id: "approvals", label: "Manager Approvals", href: "/approvals", icon: ShieldCheck, badge: approvedAcme ? undefined : 1 },
    { id: "actions", label: "Next Best Action (MOVE)", href: "/actions", icon: Zap },
    { id: "intelligence", label: "Scope Impact (UNDERSTAND)", href: "/intelligence", icon: Sparkles },
    { id: "knowledge", label: "Knowledge Base (KNOW)", href: "/knowledge", icon: BookOpen },
    { id: "delivery", label: "Customer Studio (DELIVER)", href: "/delivery", icon: Send },
    { id: "timeline", label: "Audit Timeline", href: "/timeline", icon: Clock },
  ];

  const currentNav = role === "FDE" ? fdeNav : managerNav;

  return (
    <nav className="space-y-1">
      {currentNav.map((item: NavItem) => {
        const Icon = item.icon;
        const isActive = (item.href === "/" && pathname === "/") || (item.href !== "/" && pathname?.startsWith(item.href));
        return (
          <Link
            key={item.id}
            href={item.href}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isActive
                ? "bg-slate-800 text-teal-300 font-semibold border-l-2 border-teal-400 shadow-sm"
                : "text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </div>
            {item.badge ? (
              <span className="bg-amber-500/20 text-amber-300 text-xs px-2 py-0.5 rounded-full border border-amber-500/30 animate-pulse font-mono font-semibold">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, role, switchRole, logout, isAuthenticated } = useAuth();
  const { customers, activeCustomer, setActiveCustomer } = useEngagement();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900 flex flex-col justify-between p-4 shrink-0">
        <div>
          {/* Logo & Application Header */}
          <Link href="/" className="flex items-center gap-3 px-2 py-3 mb-4 border-b border-slate-800 group">
            <div className="h-9 w-9 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 font-display font-bold text-xl group-hover:bg-teal-500/20 transition">
              C
            </div>
            <div>
              <h1 className="font-display font-bold text-slate-100 text-base tracking-tight">CalmWork AI</h1>
              <p className="text-xs text-teal-400 font-mono font-medium">Dedicated Agent Workspaces</p>
            </div>
          </Link>

          {/* Active Customer Switcher (Multi-Tenant Isolation) */}
          <div className="mb-4 relative px-2">
            <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Building2 className="h-3 w-3 text-teal-400" />
              Active Customer
            </label>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 flex items-center justify-between text-left hover:border-slate-700 transition-all"
            >
              <div>
                <span className="text-xs font-bold text-slate-100 block">{activeCustomer.customerName}</span>
                <span className="text-[11px] text-slate-400 block truncate">{activeCustomer.engagementName}</span>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
            </button>

            {dropdownOpen && (
              <div className="absolute left-2 right-2 top-full mt-1 bg-slate-900 border border-slate-800 rounded-lg shadow-xl z-50 p-1 space-y-1">
                <div className="px-2 py-1 text-[10px] uppercase font-semibold text-slate-500">
                  Switch Customer Workspace
                </div>
                {customers.map((cust) => (
                  <button
                    key={cust.id}
                    onClick={() => {
                      setActiveCustomer(cust);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-md text-xs transition-colors flex items-center justify-between ${
                      cust.id === activeCustomer.id 
                        ? "bg-teal-500/10 text-teal-300 border border-teal-500/30" 
                        : "hover:bg-slate-800 text-slate-300"
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{cust.customerName}</div>
                      <div className="text-[10px] text-slate-400">{cust.engagementName}</div>
                    </div>
                    {cust.status === "NEEDS_REASSESSMENT" && (
                      <span className="h-2 w-2 rounded-full bg-amber-400" title="Needs Reassessment" />
                    )}
                    {cust.status === "HEALTHY" && (
                      <span className="h-2 w-2 rounded-full bg-emerald-400" title="Healthy" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Role Experience Switcher */}
          <div className="mb-5 px-2">
            <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1.5">
              Role View Context
            </label>
            <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-md border border-slate-800 text-xs font-medium">
              <button
                onClick={() => switchRole("FDE")}
                className={`py-1 rounded transition-all text-center ${
                  role === "FDE" 
                    ? "bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm" 
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                FDE
              </button>
              <button
                onClick={() => switchRole("MANAGER")}
                className={`py-1 rounded transition-all text-center ${
                  role === "MANAGER" 
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm" 
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Manager
              </button>
            </div>
          </div>

          {/* Navigation Links wrapped in Suspense */}
          <Suspense fallback={<div className="h-24 bg-slate-950 rounded-lg animate-pulse" />}>
            <NavLinks />
          </Suspense>
        </div>

        {/* User Profile & Auth Section */}
        <div className="space-y-2.5 pt-3 border-t border-slate-800">
          {isAuthenticated && user ? (
            <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center text-[10px] font-bold">
                    {user.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-100">{user.name}</p>
                    <p className="text-[10px] text-slate-400">{user.title}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  role === "MANAGER" ? "bg-amber-500/20 text-amber-300" : "bg-teal-500/20 text-teal-300"
                }`}>
                  {role}
                </span>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-1.5 text-[11px] text-slate-400 hover:text-rose-400 py-0.5 transition"
              >
                <LogOut className="h-3 w-3" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="w-full bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Sign In</span>
            </Link>
          )}

          {/* Developer Observability & Privacy Footer */}
          <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-teal-400 font-medium">
                <Lock className="h-3 w-3" />
                <span className="text-[10px]">AI Guardrail</span>
              </div>
              <Link
                href="/supervisor"
                className="text-[10px] text-slate-400 hover:text-amber-300 flex items-center gap-1 font-mono transition"
                title="Supervisor Telemetry"
              >
                <Activity className="h-3 w-3 text-amber-400" />
                <span>SUPERVISOR</span>
              </Link>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Workspace Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-slate-800 bg-slate-900/50 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="relative w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={`Search ${activeCustomer.customerName} engagement...`}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500/50"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono">
              Role Context: <strong className={role === "FDE" ? "text-teal-400" : "text-amber-400"}>{role}</strong>
            </span>
            <Link
              href="/login"
              className="text-xs text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
            >
              <User className="h-3.5 w-3.5 text-teal-400" />
              <span>{user ? user.name : "Switch Account"}</span>
            </Link>
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
