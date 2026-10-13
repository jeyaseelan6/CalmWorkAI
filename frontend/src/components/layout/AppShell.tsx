"use client";

import React, { useState, useEffect, Suspense } from "react";
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
  Send,
  Plus
} from "lucide-react";
import RecordWorknoteDrawer from "@/components/layout/RecordWorknoteDrawer";

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
    { id: "my-work", label: "My Day", href: "/", icon: Briefcase },
    { id: "engagements", label: "Engagements", href: "/engagements", icon: Building2 },
    { id: "approvals", label: "Approvals", href: "/approvals", icon: ShieldCheck, badge: approvedAcme ? undefined : 1 },
    { id: "delivery", label: "Customer Updates", href: "/delivery", icon: Send },
    { id: "knowledge", label: "Knowledge", href: "/knowledge", icon: BookOpen },
    { id: "timeline", label: "Timeline", href: "/timeline", icon: Clock },
    { id: "supervisor", label: "Ask CalmWork", href: "/supervisor", icon: Sparkles },
  ];

  const managerNav: NavItem[] = [
    { id: "control-center", label: "My Day", href: "/", icon: LayoutDashboard },
    { id: "engagements", label: "Engagements", href: "/engagements", icon: Building2 },
    { id: "approvals", label: "Approvals", href: "/approvals", icon: ShieldCheck, badge: approvedAcme ? undefined : 1 },
    { id: "delivery", label: "Customer Updates", href: "/delivery", icon: Send },
    { id: "knowledge", label: "Knowledge", href: "/knowledge", icon: BookOpen },
    { id: "timeline", label: "Timeline", href: "/timeline", icon: Clock },
    { id: "supervisor", label: "Ask CalmWork", href: "/supervisor", icon: Sparkles },
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
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
              isActive
                ? "bg-slate-100 text-slate-900 font-semibold"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
            }`}
          >
            <div className="flex items-center gap-2">
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-slate-900" : "text-slate-400"}`} />
              <span>{item.label}</span>
            </div>
            {item.badge ? (
              <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.2 rounded font-mono font-medium">
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
  const { user, role, logout, isAuthenticated, isLoadingAuth } = useAuth();
  const { customers, activeCustomer, setActiveCustomer } = useEngagement();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isWorknoteDrawerOpen, setIsWorknoteDrawerOpen] = useState(false);

  // Route protection: If unauthenticated, redirect to login screen
  useEffect(() => {
    if (!isLoadingAuth && !isAuthenticated) {
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  }, [isLoadingAuth, isAuthenticated]);

  if (isLoadingAuth) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <div className="h-9 w-9 rounded-lg bg-slate-900 text-white font-display font-bold flex items-center justify-center mx-auto animate-pulse text-sm shadow-md">
            C
          </div>
          <p className="text-xs text-slate-500 font-medium">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

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
                className="w-full flex items-center justify-center gap-1.5 text-[11px] text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 py-1 rounded transition font-medium cursor-pointer"
                title="Sign out of current session and return to login"
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
        </div>
      </aside>

      {/* Main Content Workspace Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        {/* Top Header Bar */}
        <header className="h-12 border-b border-slate-200 bg-white px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search specs, tasks, decisions..."
                className="w-full bg-slate-50 border border-slate-200 rounded-md pl-8 pr-3 py-1 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-slate-300 transition"
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsWorknoteDrawerOpen(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Record Note</span>
            </button>

            <span className="text-xs px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-700 font-medium">
              {role === "MANAGER" ? "Manager" : "Engineer"}
            </span>

            {user && (
              <div className="flex items-center gap-2 border-l border-slate-200 pl-2.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-700">
                  <div className="h-5 w-5 rounded bg-slate-800 text-white font-bold flex items-center justify-center text-[10px]">
                    {user.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <span className="font-semibold text-slate-800">{user.name}</span>
                </div>

                <button
                  onClick={logout}
                  className="text-xs text-slate-500 hover:text-rose-600 px-2 py-1 rounded border border-slate-200 hover:border-rose-200 bg-white hover:bg-rose-50 transition font-medium flex items-center gap-1 cursor-pointer"
                  title="Sign out of current session"
                >
                  <LogOut className="h-3 w-3" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Main Body Canvas */}
        <main className="flex-1 overflow-y-auto p-5">
          {children}
        </main>

        {/* Global Quick Context Capture Drawer */}
        <RecordWorknoteDrawer
          isOpen={isWorknoteDrawerOpen}
          onClose={() => setIsWorknoteDrawerOpen(false)}
        />
      </div>
    </div>
  );
}
