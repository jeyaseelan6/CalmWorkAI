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
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${
              isActive
                ? "bg-blue-50 text-blue-700 font-semibold border-l-4 border-blue-600 shadow-xs"
                : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 font-medium"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-blue-600" : "text-slate-500"}`} />
              <span>{item.label}</span>
            </div>
            {item.badge ? (
              <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full border border-amber-300 font-mono font-bold">
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
    <div className="flex h-screen bg-white text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200 bg-slate-50/80 flex flex-col justify-between p-4 shrink-0">
        <div>
          {/* Logo & Application Header */}
          <Link href="/" className="flex items-center gap-3 px-2 py-3 mb-4 border-b border-slate-200 group">
            <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-display font-bold text-xl shadow-sm group-hover:bg-blue-700 transition">
              C
            </div>
            <div>
              <h1 className="font-display font-bold text-slate-900 text-base tracking-tight">CalmWork AI</h1>
              <p className="text-xs text-blue-600 font-mono font-semibold">Dedicated Agent Workspaces</p>
            </div>
          </Link>

          {/* Active Customer Switcher */}
          <div className="mb-4 relative px-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-blue-600" />
              Active Customer
            </label>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full bg-white border border-slate-200 shadow-xs rounded-xl p-2.5 flex items-center justify-between text-left hover:border-slate-300 transition-all"
            >
              <div>
                <span className="text-xs font-bold text-slate-900 block">{activeCustomer.customerName}</span>
                <span className="text-xs text-slate-500 block truncate">{activeCustomer.engagementName}</span>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
            </button>

            {dropdownOpen && (
              <div className="absolute left-2 right-2 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-1.5 space-y-1">
                <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-400">
                  Switch Customer Workspace
                </div>
                {customers.map((cust) => (
                  <button
                    key={cust.id}
                    onClick={() => {
                      setActiveCustomer(cust);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg text-xs transition-colors flex items-center justify-between ${
                      cust.id === activeCustomer.id 
                        ? "bg-blue-50 text-blue-700 font-semibold border border-blue-200" 
                        : "hover:bg-slate-100 text-slate-700"
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{cust.customerName}</div>
                      <div className="text-[11px] text-slate-500">{cust.engagementName}</div>
                    </div>
                    {cust.status === "NEEDS_REASSESSMENT" && (
                      <span className="h-2 w-2 rounded-full bg-amber-500" title="Needs Reassessment" />
                    )}
                    {cust.status === "HEALTHY" && (
                      <span className="h-2 w-2 rounded-full bg-emerald-500" title="Healthy" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Role Experience Switcher */}
          <div className="mb-5 px-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Role View Context
            </label>
            <div className="grid grid-cols-2 gap-1 bg-slate-200/60 p-1 rounded-xl border border-slate-300/80 text-xs font-semibold">
              <button
                onClick={() => switchRole("FDE")}
                className={`py-1.5 rounded-lg transition-all text-center ${
                  role === "FDE" 
                    ? "bg-white text-blue-700 shadow-xs border border-slate-300 font-bold" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                FDE
              </button>
              <button
                onClick={() => switchRole("MANAGER")}
                className={`py-1.5 rounded-lg transition-all text-center ${
                  role === "MANAGER" 
                    ? "bg-white text-amber-700 shadow-xs border border-slate-300 font-bold" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Manager
              </button>
            </div>
          </div>

          {/* Navigation Links wrapped in Suspense */}
          <Suspense fallback={<div className="h-24 bg-slate-100 rounded-xl animate-pulse" />}>
            <NavLinks />
          </Suspense>
        </div>

        {/* User Profile & Auth Section */}
        <div className="space-y-2.5 pt-3 border-t border-slate-200">
          {isAuthenticated && user ? (
            <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center text-xs font-bold">
                    {user.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{user.name}</p>
                    <p className="text-[11px] text-slate-500">{user.title}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  role === "MANAGER" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                }`}>
                  {role}
                </span>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-rose-600 py-1 transition font-medium"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-xs"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Sign In</span>
            </Link>
          )}

          {/* Developer Observability & Privacy Footer */}
          <div className="p-2 bg-slate-100/70 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-blue-700 font-medium">
                <Lock className="h-3 w-3" />
                <span className="text-[11px] font-semibold">AI Guardrail</span>
              </div>
              <Link
                href="/supervisor"
                className="text-[11px] text-slate-600 hover:text-amber-700 flex items-center gap-1 font-mono font-semibold transition"
                title="Supervisor Telemetry"
              >
                <Activity className="h-3 w-3 text-amber-600" />
                <span>SUPERVISOR</span>
              </Link>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Workspace Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-slate-200 bg-white px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="relative w-80">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={`Search ${activeCustomer.customerName} engagement...`}
                className="w-full bg-slate-100/80 border border-slate-200 rounded-full pl-10 pr-4 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-mono font-semibold">
              Role Context: <strong className={role === "FDE" ? "text-blue-700" : "text-amber-700"}>{role}</strong>
            </span>
            <Link
              href="/login"
              className="text-xs text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 border border-slate-200 px-3 py-1.5 rounded-full flex items-center gap-1.5 transition font-medium"
            >
              <User className="h-3.5 w-3.5 text-blue-600" />
              <span>{user ? user.name : "Switch Account"}</span>
            </Link>
          </div>
        </header>

        {/* Main Body Canvas */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-50/40">
          {children}
        </main>
      </div>
    </div>
  );
}
