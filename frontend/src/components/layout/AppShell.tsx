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
    <nav className="space-y-0.5">
      {currentNav.map((item: NavItem) => {
        const Icon = item.icon;
        const isActive = (item.href === "/" && pathname === "/") || (item.href !== "/" && pathname?.startsWith(item.href));
        return (
          <Link
            key={item.id}
            href={item.href}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs transition-all ${
              isActive
                ? "bg-slate-100 text-slate-900 font-semibold border-l-2 border-blue-600"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
              <span>{item.label}</span>
            </div>
            {item.badge ? (
              <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded border border-amber-300 font-mono font-bold">
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
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 border-r border-slate-200 bg-white flex flex-col justify-between p-3.5 shrink-0">
        <div>
          {/* Logo & Application Header */}
          <Link href="/" className="flex items-center gap-2.5 px-2 py-2 mb-3 border-b border-slate-200 group">
            <div className="h-7 w-7 rounded bg-slate-900 text-white flex items-center justify-center font-display font-bold text-sm shadow-2xs">
              C
            </div>
            <div>
              <h1 className="font-display font-bold text-slate-900 text-sm tracking-tight">CalmWork AI</h1>
              <p className="text-[11px] text-slate-500 font-mono">Work-Intelligence SaaS</p>
            </div>
          </Link>

          {/* Active Customer Switcher */}
          <div className="mb-3 relative px-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
              Active Engagement
            </label>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 flex items-center justify-between text-left hover:border-slate-300 transition-all text-xs"
            >
              <div className="truncate">
                <span className="font-semibold text-slate-900 block truncate">{activeCustomer.customerName}</span>
                <span className="text-[11px] text-slate-500 block truncate">{activeCustomer.engagementName}</span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-1" />
            </button>

            {dropdownOpen && (
              <div className="absolute left-1 right-1 top-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-50 p-1 space-y-0.5">
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
                    className={`w-full text-left p-2 rounded text-xs transition-colors flex items-center justify-between ${
                      cust.id === activeCustomer.id 
                        ? "bg-slate-100 text-slate-900 font-semibold border-l-2 border-blue-600" 
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="truncate">
                      <div className="font-semibold truncate">{cust.customerName}</div>
                      <div className="text-[10px] text-slate-500 truncate">{cust.engagementName}</div>
                    </div>
                    {cust.status === "NEEDS_REASSESSMENT" && (
                      <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0 ml-1.5" title="Needs Reassessment" />
                    )}
                    {cust.status === "HEALTHY" && (
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 ml-1.5" title="Healthy" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Role Experience Switcher */}
          <div className="mb-4 px-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Role Context
            </label>
            <div className="grid grid-cols-2 gap-0.5 bg-slate-100 p-0.5 rounded-md border border-slate-200 text-xs">
              <button
                onClick={() => switchRole("FDE")}
                className={`py-1 rounded text-center transition-all ${
                  role === "FDE" 
                    ? "bg-white text-slate-900 font-semibold shadow-2xs border border-slate-200" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                FDE
              </button>
              <button
                onClick={() => switchRole("MANAGER")}
                className={`py-1 rounded text-center transition-all ${
                  role === "MANAGER" 
                    ? "bg-white text-slate-900 font-semibold shadow-2xs border border-slate-200" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Manager
              </button>
            </div>
          </div>

          {/* Navigation Links wrapped in Suspense */}
          <Suspense fallback={<div className="h-24 bg-slate-100 rounded-md animate-pulse" />}>
            <NavLinks />
          </Suspense>
        </div>

        {/* User Profile & Auth Section */}
        <div className="space-y-2 pt-2 border-t border-slate-200 text-xs">
          {isAuthenticated && user ? (
            <div className="p-2 bg-slate-50 rounded-md border border-slate-200 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded bg-slate-200 text-slate-800 font-bold flex items-center justify-center text-[10px]">
                    {user.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900 truncate">{user.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{user.title}</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                  {role}
                </span>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-1 text-[11px] text-slate-500 hover:text-rose-600 py-0.5 transition font-medium"
              >
                <LogOut className="h-3 w-3" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-1.5 rounded-md text-xs flex items-center justify-center gap-1.5 transition"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Sign In</span>
            </Link>
          )}

          {/* Developer Observability & Privacy Footer */}
          <div className="p-2 bg-white rounded-md border border-slate-200 text-[11px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-slate-600 font-medium">
                <Lock className="h-3 w-3 text-slate-500" />
                <span>AI Guardrail</span>
              </div>
              <Link
                href="/supervisor"
                className="text-slate-600 hover:text-slate-900 flex items-center gap-1 font-mono font-medium transition"
                title="Supervisor Telemetry"
              >
                <Activity className="h-3 w-3 text-slate-500" />
                <span>SUPERVISOR</span>
              </Link>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Workspace Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        {/* Top Header Bar */}
        <header className="h-12 border-b border-slate-200 bg-white px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="relative w-72">
              <Search className="absolute left-3 top-2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder={`Search ${activeCustomer.customerName} engagement...`}
                className="w-full bg-slate-50 border border-slate-200 rounded-md pl-8 pr-3 py-1 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-slate-400 transition"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs px-2.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono">
              Role: <strong className="text-slate-900">{role}</strong>
            </span>
            <Link
              href="/login"
              className="text-xs text-slate-600 hover:text-slate-900 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md flex items-center gap-1.5 transition font-medium"
            >
              <User className="h-3.5 w-3.5 text-slate-500" />
              <span>{user ? user.name : "Account"}</span>
            </Link>
          </div>
        </header>

        {/* Main Body Canvas */}
        <main className="flex-1 overflow-y-auto p-5">
          {children}
        </main>
      </div>
    </div>
  );
}
