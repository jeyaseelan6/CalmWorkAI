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
  X
} from "lucide-react";
import RecordWorknoteDrawer from "@/components/layout/RecordWorknoteDrawer";
import CreateEngagementModal from "@/components/engagement/CreateEngagementModal";
import AskCalmWorkChat from "@/components/supervisor/AskCalmWorkChat";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

function NavLinks({ onItemClick }: { onItemClick?: () => void }) {
  const { role } = useAuth();
  const { activeCustomer, pendingApprovalsCount, activeTab } = useEngagement();
  const pathname = usePathname();

  const activeId = activeCustomer?.id || "eng-acme-001";

  const currentNav: NavItem[] = [
    { 
      id: "myday", 
      label: "My Day", 
      href: `/engagements/${activeId}?tab=myday`, 
      icon: CheckSquare 
    },
    { 
      id: "engagements", 
      label: "My Engagements", 
      href: "/engagements", 
      icon: Building2 
    },
    { 
      id: "supervisor", 
      label: "Ask CalmWork", 
      href: "/supervisor", 
      icon: Sparkles 
    },
    { 
      id: "approvals", 
      label: "Approvals", 
      href: "/approvals", 
      icon: ShieldCheck, 
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined 
    },
  ];

  return (
    <nav className="space-y-1">
      {currentNav.map((item: NavItem) => {
        const Icon = item.icon;
        let isActive = false;
        if (item.id === "myday") {
          isActive = (pathname?.startsWith(`/engagements/${activeId}`) && activeTab === "myday") || pathname === "/";
        } else if (item.id === "engagements") {
          isActive = pathname === "/engagements" || (pathname?.startsWith("/engagements/") && activeTab !== "myday");
        } else if (item.id === "supervisor") {
          isActive = pathname?.startsWith("/supervisor") || false;
        } else if (item.id === "approvals") {
          isActive = pathname?.startsWith("/approvals") || false;
        }

        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={onItemClick}
            className={`w-full flex items-center justify-between px-3 py-2.5 min-h-[44px] rounded-lg text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1 ${
              isActive
                ? "bg-slate-900 text-white font-semibold shadow-2xs"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-medium"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-slate-500"}`} />
              <span>{item.label}</span>
            </div>
            {item.badge ? (
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
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
    supervisorInitialQuery
  } = useEngagement();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isWorknoteDrawerOpen, setIsWorknoteDrawerOpen] = useState(false);
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

  const renderEngagementSwitcher = () => (
    <div className="mb-3 relative px-1">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
        Active Engagement
      </label>
      <button
        type="button"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 flex items-center justify-between text-left hover:border-slate-300 transition-all text-xs cursor-pointer"
      >
        <div className="truncate">
          <span className="font-semibold text-slate-900 block truncate">{activeCustomer.customerName}</span>
          <span className="text-[11px] text-slate-500 block truncate">{activeCustomer.engagementName}</span>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-1" />
      </button>

      {dropdownOpen && (
        <div className="absolute left-1 right-1 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-1.5 space-y-1">
          <div className="px-1.5 py-1 text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
            <span>Switch Workspace</span>
            <span className="font-mono text-[9px] text-slate-500">{customers.length} total</span>
          </div>

          {customers.length > 4 && (
            <div className="px-0.5 pb-1">
              <input
                type="text"
                placeholder="Search engagement..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          )}

          <div className="max-h-60 overflow-y-auto space-y-0.5">
            {filteredCustomers.map((cust) => (
              <button
                key={cust.id}
                type="button"
                onClick={() => {
                  switchEngagement(cust);
                  setDropdownOpen(false);
                  setIsMobileMenuOpen(false);
                  setCustomerSearch("");
                  if (pathname?.startsWith("/engagements")) {
                    router.push(`/engagements/${cust.id}${activeTab ? `?tab=${activeTab}` : ""}`);
                  }
                }}
                className={`w-full text-left p-2 rounded text-xs transition-colors flex items-center justify-between cursor-pointer ${
                  cust.id === activeCustomer.id 
                    ? "bg-slate-100 text-slate-900 font-semibold border-l-2 border-slate-900" 
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
            {filteredCustomers.length === 0 && (
              <div className="p-2 text-center text-xs text-slate-400">
                No matching engagements
              </div>
            )}
          </div>

          {isManager && (
            <div className="pt-1 mt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  setIsMobileMenuOpen(false);
                  setShowCreateModal(true);
                }}
                className="w-full text-left p-1.5 rounded text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-1.5 font-medium transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 text-slate-500" />
                <span>New Engagement...</span>
              </button>
            </div>
          )}
        </div>
      )}
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
                  href={`/engagements/${activeCustomer?.id || "eng-acme-001"}`}
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

              {/* Engagement Switcher */}
              {renderEngagementSwitcher()}

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

      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="hidden md:flex w-60 border-r border-slate-200 bg-white flex-col justify-between p-3.5 shrink-0">
        <div>
          {/* Logo & Application Header */}
          <Link href={`/engagements/${activeCustomer?.id || "eng-acme-001"}`} className="flex items-center gap-2.5 px-2 py-2 mb-3 border-b border-slate-200 group">
            <div className="h-7 w-7 rounded bg-slate-900 text-white flex items-center justify-center font-display font-bold text-sm shadow-2xs">
              C
            </div>
            <div>
              <h1 className="font-display font-bold text-slate-900 text-sm tracking-tight">CalmWork AI</h1>
            </div>
          </Link>

          {/* Active Customer Switcher */}
          {renderEngagementSwitcher()}

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
            {/* "+ New Engagement" on desktop (Manager only) */}
            {isManager && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="hidden lg:flex border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs px-2.5 py-1.5 rounded-md items-center gap-1.5 transition cursor-pointer shadow-2xs"
                title="Create a new customer engagement (Manager role required)"
              >
                <Building2 className="h-3.5 w-3.5 text-slate-500" />
                <span>+ New Engagement</span>
              </button>
            )}

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

          {/* 2. My Engagements */}
          <Link
            href="/engagements"
            className={`flex flex-col items-center justify-center py-1 px-2 min-h-[44px] min-w-[44px] rounded-lg text-[10px] font-medium transition ${
              pathname === "/engagements" || (pathname?.startsWith("/engagements/") && activeTab !== "myday")
                ? "text-slate-900 font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Building2 className="h-4 w-4 mb-0.5" />
            <span>Engagements</span>
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

        {/* Floating Ask CalmWork trigger in bottom-right (Desktop) */}
        {!isSupervisorDrawerOpen && (
          <button
            onClick={() => setIsSupervisorDrawerOpen(true)}
            className="hidden md:flex fixed bottom-6 right-6 z-40 bg-purple-50/90 hover:bg-purple-100 text-purple-800 border border-purple-200 hover:border-purple-300 font-medium text-xs px-3.5 py-2 rounded-lg items-center gap-2 shadow-sm hover:shadow-md transition cursor-pointer backdrop-blur-xs"
            title="Open contextual Ask CalmWork Assistant Drawer"
          >
            <Sparkles className="h-4 w-4 text-purple-600" />
            <span>Ask CalmWork</span>
          </button>
        )}

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
