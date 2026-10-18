"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  User,
  Activity,
  Sparkles,
  Zap,
  Send,
  Plus,
  Menu,
  X,
  ListTodo,
  FileText
} from "lucide-react";
import RecordWorknoteDrawer from "@/components/layout/RecordWorknoteDrawer";
import CreateEngagementModal from "@/components/engagement/CreateEngagementModal";
import AskCalmWorkChat from "@/components/supervisor/AskCalmWorkChat";
import WorkspaceRail from "@/components/layout/WorkspaceRail";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  tab?: string;
}

function NavLinks({ onItemClick }: { onItemClick?: () => void }) {
  const { role } = useAuth();
  const { activeCustomer, pendingApprovalsCount, activeTab, setActiveTab } = useEngagement();
  const pathname = usePathname();

  const activeId = activeCustomer?.id || "eng-acme-001";

  const currentNav: NavItem[] = [
    { 
      id: "engagements", 
      label: "My Workspaces", 
      href: "/engagements", 
      icon: Building2 
    },
    { 
      id: "myday", 
      label: "My day", 
      href: `/engagements/${activeId}?tab=myday`, 
      icon: CheckSquare,
      tab: "myday"
    },
    { 
      id: "plan", 
      label: "Plan & Tasks", 
      href: `/engagements/${activeId}?tab=plan`, 
      icon: ListTodo,
      tab: "plan"
    },
    { 
      id: "knowledge", 
      label: "Knowledge", 
      href: `/engagements/${activeId}?tab=knowledge`, 
      icon: BookOpen,
      tab: "knowledge"
    },
    { 
      id: "notes", 
      label: "Work Notes", 
      href: `/engagements/${activeId}?tab=timeline`, 
      icon: FileText,
      tab: "timeline"
    },
    { 
      id: "deliver", 
      label: "Deliver", 
      href: `/engagements/${activeId}?tab=updates`, 
      icon: Send,
      tab: "updates"
    },
    { 
      id: "approvals", 
      label: "Waiting Approvals", 
      href: "/approvals", 
      icon: ShieldCheck, 
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined 
    },
    { 
      id: "supervisor", 
      label: "Ask Calm Work AI", 
      href: "/supervisor", 
      icon: Sparkles 
    },
  ];

  return (
    <nav className="space-y-1">
      {currentNav.map((item: NavItem) => {
        const Icon = item.icon;
        let isActive = false;
        if (item.id === "engagements") {
          isActive = pathname === "/engagements" || pathname === "/";
        } else if (item.id === "myday") {
          isActive = pathname?.startsWith("/engagements/") && (activeTab === "myday" || !activeTab);
        } else if (item.id === "plan") {
          isActive = pathname?.startsWith("/engagements/") && activeTab === "plan";
        } else if (item.id === "knowledge") {
          isActive = pathname?.startsWith("/engagements/") && activeTab === "knowledge";
        } else if (item.id === "notes") {
          isActive = pathname?.startsWith("/engagements/") && activeTab === "timeline";
        } else if (item.id === "deliver") {
          isActive = pathname?.startsWith("/engagements/") && activeTab === "updates";
        } else if (item.id === "approvals") {
          isActive = pathname?.startsWith("/approvals") || false;
        } else if (item.id === "supervisor") {
          isActive = pathname?.startsWith("/supervisor") || false;
        }

        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={() => {
              if (item.tab) {
                setActiveTab(item.tab);
              }
              if (onItemClick) {
                onItemClick();
              }
            }}
            className={`w-full flex items-center justify-between px-3 py-2 min-h-[38px] rounded-lg text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1 ${
              isActive
                ? "bg-slate-900 text-white font-semibold shadow-2xs"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-medium"
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-slate-500"}`} />
              <span className="truncate">{item.label}</span>
            </div>
            {item.badge ? (
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold shrink-0 ${
                isActive ? "bg-amber-400 text-slate-950" : "bg-amber-100 text-amber-900"
              }`}>
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
  const router = useRouter();
  const pathname = usePathname();
  const { user, role, logout, isAuthenticated, isLoadingAuth, isManager } = useAuth();
  const {
    customers,
    activeCustomer,
    switchEngagement,
    pendingApprovalsCount,
    activeTab,
    selectedItemContext,
    isSupervisorDrawerOpen,
    setIsSupervisorDrawerOpen,
    supervisorInitialQuery,
    isWorknoteDrawerOpen,
    setIsWorknoteDrawerOpen
  } = useEngagement();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const filteredCustomers = customers.filter(c => {
    if (!customerSearch.trim()) return true;
    const q = customerSearch.toLowerCase();
    return c.customerName.toLowerCase().includes(q) || c.engagementName.toLowerCase().includes(q);
  });

  // Keyboard accessibility: Escape key closes active drawers and modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isSupervisorDrawerOpen) setIsSupervisorDrawerOpen(false);
        if (isWorknoteDrawerOpen) setIsWorknoteDrawerOpen(false);
        if (showCreateModal) setShowCreateModal(false);
        if (isMobileMenuOpen) setIsMobileMenuOpen(false);
        if (dropdownOpen) setDropdownOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSupervisorDrawerOpen, isWorknoteDrawerOpen, showCreateModal, isMobileMenuOpen, dropdownOpen, setIsSupervisorDrawerOpen]);

  // Automatically close mobile menu & dropdown on navigation
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setDropdownOpen(false);
  }, [pathname]);

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



  const renderMobileEngagementSwitcher = () => (
    <div className="mb-3 px-1">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Switch Client ({customers.length})
        </span>
        {isManager && (
          <button
            type="button"
            onClick={() => {
              setIsMobileMenuOpen(false);
              setShowCreateModal(true);
            }}
            className="text-[10px] font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-0.5"
          >
            <Plus className="h-3 w-3" />
            <span>New</span>
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 no-scrollbar">
        {customers.map((cust) => {
          const isActive = cust.id === activeCustomer.id;
          const isHealthy = cust.status === "HEALTHY";
          const initials = cust.customerName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
          return (
            <button
              key={cust.id}
              type="button"
              onClick={() => {
                switchEngagement(cust);
                setIsMobileMenuOpen(false);
                if (pathname?.startsWith("/engagements")) {
                  router.push(`/engagements/${cust.id}${activeTab ? `?tab=${activeTab}` : ""}`);
                } else {
                  router.push(`/engagements/${cust.id}?tab=myday`);
                }
              }}
              className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center font-bold text-xs relative transition-all cursor-pointer ${
                isActive
                  ? "bg-slate-900 text-white shadow-md ring-2 ring-slate-900"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              <span>{initials}</span>
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                  isHealthy ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Mobile Slide-Out Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-fadeIn">
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative w-72 max-w-[85vw] bg-white h-full z-10 shadow-2xl flex flex-col justify-between p-4 overflow-y-auto">
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                <Link 
                  href="/engagements"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-2.5"
                >
                  <div className="h-7 w-7 rounded bg-slate-900 text-white flex items-center justify-center font-display font-bold text-sm shadow-2xs">
                    C
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-slate-900 text-sm tracking-tight">CalmWork AI</h2>
                    <p className="text-[10px] text-slate-500 font-mono">Mobile Workspace</p>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                  aria-label="Close navigation"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Mobile Client Switcher Strip */}
              {renderMobileEngagementSwitcher()}

              {/* Navigation Items */}
              <Suspense fallback={<div className="h-24 bg-slate-100 rounded-md animate-pulse" />}>
                <NavLinks onItemClick={() => setIsMobileMenuOpen(false)} />
              </Suspense>
            </div>

            {/* User Profile in Drawer */}
            <div className="pt-3 border-t border-slate-200 space-y-2 mt-4 text-xs">
              {user && (
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs">
                        {user.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-semibold text-slate-900 truncate">{user.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{user.title}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-bold">
                      {role}
                    </span>
                  </div>
                  <button
                    onClick={logout}
                    className="w-full flex items-center justify-center gap-1.5 text-xs text-rose-600 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 py-1.5 rounded-md transition font-semibold cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Slim Vertical Icon Rail (Leftmost Client Switcher, 56px) */}
      <WorkspaceRail onOpenCreateModal={() => setShowCreateModal(true)} />

      {/* Desktop Client Sidebar (hidden on mobile) */}
      <aside className="hidden md:flex w-60 h-screen max-h-screen border-r border-slate-200 bg-white flex-col justify-between p-3.5 shrink-0 overflow-y-auto no-scrollbar">
        <div>
          {/* Brand Header: Displayed before My Day */}
          <div className="pb-3 mb-2 px-1 border-b border-slate-100">
            <Link href="/engagements" className="block group">
              <h2 className="font-display font-bold text-sm text-slate-900 tracking-tight group-hover:text-slate-700 transition">
                Calm Work AI
              </h2>
              <p className="text-[10px] text-slate-400 font-mono font-medium mt-0.5">
                Clarity Driven Work Intelligence
              </p>
            </Link>
          </div>

          {/* Active Engagement Context Indicator */}
          {activeCustomer && (
            <div className="mb-2.5 px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                <span className="font-mono text-[9px] uppercase tracking-wider">Active Workspace</span>
                <span className={`h-1.5 w-1.5 rounded-full ${activeCustomer.status === "HEALTHY" ? "bg-emerald-500" : "bg-amber-500"}`} />
              </div>
              <p className="text-xs font-semibold text-slate-900 truncate mt-0.5" title={activeCustomer.customerName}>
                {activeCustomer.customerName}
              </p>
              <p className="text-[10px] text-slate-500 truncate" title={activeCustomer.engagementName}>
                {activeCustomer.engagementName}
              </p>
            </div>
          )}

          {/* Navigation Links wrapped in Suspense */}
          <Suspense fallback={<div className="h-24 bg-slate-100 rounded-md animate-pulse" />}>
            <NavLinks />
          </Suspense>
        </div>
      </aside>

      {/* Main Content Workspace Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 min-w-0">
        {/* Top Header Bar (Mobile & Desktop) */}
        <header className="h-13 sm:h-12 border-b border-slate-200 bg-white px-3 sm:px-5 flex items-center justify-between shrink-0 gap-3">
          {/* Left Side: Mobile Menu Button & Brand Chip & Expanded Desktop Search */}
          <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0 max-w-xl">
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-1.5 -ml-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition relative cursor-pointer"
              aria-label="Open Navigation Drawer"
            >
              <Menu className="h-5 w-5" />
              {pendingApprovalsCount > 0 && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>

            {/* Mobile Title / Engagement Chip */}
            <div className="flex md:hidden items-center gap-1.5 truncate">
              <span className="font-display font-bold text-xs text-slate-900 truncate">
                {activeCustomer.customerName}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">·</span>
              <span className="text-[11px] text-slate-500 truncate max-w-[120px]">
                {activeCustomer.engagementName}
              </span>
            </div>

            {/* Expanded Desktop Search Bar */}
            <div className="hidden md:block relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search specs, tasks, decisions..."
                className="w-full bg-slate-50 border border-slate-200 rounded-md pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-slate-300 transition shadow-2xs"
              />
            </div>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

            {/* Record Note button */}
            <button
              onClick={() => setIsWorknoteDrawerOpen(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md flex items-center gap-1 sm:gap-1.5 transition cursor-pointer shadow-2xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Record Note</span>
              <span className="sm:hidden text-[11px]">Note</span>
            </button>

            <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-700 font-mono font-medium">
              {role === "MANAGER" ? "Manager" : "Engineer"}
            </span>

            {user && (
              <div className="hidden sm:flex items-center gap-2 border-l border-slate-200 pl-2.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-700">
                  <div className="h-5 w-5 rounded bg-slate-800 text-white font-bold flex items-center justify-center text-[10px]">
                    {user.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <span className="font-semibold text-slate-800 hidden md:inline">{user.name}</span>
                </div>

                <button
                  onClick={logout}
                  className="text-xs text-slate-500 hover:text-rose-600 px-2 py-1 rounded border border-slate-200 hover:border-rose-200 bg-white hover:bg-rose-50 transition font-medium flex items-center gap-1 cursor-pointer"
                  title="Sign out of current session"
                >
                  <LogOut className="h-3 w-3" />
                  <span className="hidden md:inline">Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Main Body Canvas */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 pb-24 md:pb-5">
          {children}
        </main>

        {/* Mobile Bottom Navigation Bar (4 primary destinations + Menu) */}
        <nav 
          aria-label="Mobile Navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-1 py-1 flex items-center justify-around shadow-lg"
        >
          {/* 1. My Day */}
          <Link
            href={`/engagements/${activeCustomer?.id || "eng-acme-001"}?tab=myday`}
            className={`flex flex-col items-center justify-center py-1 px-2 min-h-[44px] min-w-[44px] rounded-lg text-[10px] font-medium transition ${
              (pathname?.startsWith("/engagements/") && activeTab === "myday") || pathname === "/"
                ? "text-slate-900 font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CheckSquare className="h-4 w-4 mb-0.5" />
            <span>My Day</span>
          </Link>

          {/* 2. My Workspaces */}
          <Link
            href="/engagements"
            className={`flex flex-col items-center justify-center py-1 px-2 min-h-[44px] min-w-[44px] rounded-lg text-[10px] font-medium transition ${
              pathname === "/engagements" || (pathname?.startsWith("/engagements/") && activeTab !== "myday")
                ? "text-slate-900 font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Building2 className="h-4 w-4 mb-0.5" />
            <span>Workspaces</span>
          </Link>

          {/* 3. Approvals */}
          <Link
            href="/approvals"
            className={`flex flex-col items-center justify-center py-1 px-2 min-h-[44px] min-w-[44px] rounded-lg text-[10px] font-medium relative transition ${
              pathname?.startsWith("/approvals")
                ? "text-slate-900 font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <div className="relative">
              <ShieldCheck className="h-4 w-4 mb-0.5" />
              {pendingApprovalsCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-amber-500 text-slate-950 font-bold text-[9px] h-3.5 min-w-[14px] px-0.5 rounded-full flex items-center justify-center font-mono">
                  {pendingApprovalsCount}
                </span>
              )}
            </div>
            <span>Approvals</span>
          </Link>

          {/* 4. Ask CalmWork Drawer Trigger */}
          <button
            type="button"
            onClick={() => setIsSupervisorDrawerOpen(true)}
            className={`flex flex-col items-center justify-center py-1 px-2 min-h-[44px] min-w-[44px] rounded-lg text-[10px] font-medium transition cursor-pointer ${
              isSupervisorDrawerOpen
                ? "text-purple-700 font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Sparkles className="h-4 w-4 mb-0.5 text-purple-600" />
            <span>Ask AI</span>
          </button>

          {/* 5. Menu Drawer */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-2 min-h-[44px] min-w-[44px] rounded-lg text-[10px] font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            aria-label="Open Workspace Navigation Menu"
          >
            <Menu className="h-4 w-4 mb-0.5" />
            <span>Menu</span>
          </button>
        </nav>

        {/* Global Quick Context Capture Drawer */}
        <RecordWorknoteDrawer
          isOpen={isWorknoteDrawerOpen}
          onClose={() => setIsWorknoteDrawerOpen(false)}
        />

        {/* Manager Create New Engagement Modal */}
        <CreateEngagementModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
        />


        {/* Contextual Supervisor Assistant Drawer */}
        {isSupervisorDrawerOpen && (
          <div
            className="fixed inset-0 z-50 flex justify-end animate-fadeIn"
            role="dialog"
            aria-modal="true"
            aria-label="CalmWork Supervisor Assistant"
          >
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity cursor-pointer"
              onClick={() => setIsSupervisorDrawerOpen(false)}
              aria-label="Close assistant backdrop"
            />

            {/* Slide-out Drawer Panel */}
            <div className="relative w-full sm:w-[500px] lg:w-[560px] max-w-[100vw] h-full bg-white z-10 shadow-2xl flex flex-col border-l border-slate-200">
              <AskCalmWorkChat
                key={activeCustomer?.id || "global"}
                isDrawer={true}
                onClose={() => setIsSupervisorDrawerOpen(false)}
                engagementId={activeCustomer?.id}
                customerName={activeCustomer?.customerName}
                activeTab={activeTab}
                selectedItemContext={selectedItemContext}
                initialQuery={supervisorInitialQuery}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
