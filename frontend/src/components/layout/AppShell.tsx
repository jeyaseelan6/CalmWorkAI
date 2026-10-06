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
  Lock,
  Building2,
  ChevronDown
} from "lucide-react";

export type Role = "FDE" | "MANAGER";

export interface CustomerEngagement {
  id: string;
  customerName: string;
  engagementName: string;
  status: "HEALTHY" | "NEEDS_REASSESSMENT" | "BLOCKED" | "AT_RISK";
}

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface AppShellProps {
  children: React.ReactNode;
  activeCustomer?: CustomerEngagement;
  onSelectCustomer?: (customer: CustomerEngagement) => void;
  availableCustomers?: CustomerEngagement[];
}

const DEFAULT_CUSTOMERS: CustomerEngagement[] = [
  {
    id: "eng-acme-001",
    customerName: "Acme Corp",
    engagementName: "Onboarding Modernization",
    status: "NEEDS_REASSESSMENT"
  },
  {
    id: "eng-globex-002",
    customerName: "Globex Corp",
    engagementName: "Legacy Data Migration",
    status: "HEALTHY"
  }
];

export default function AppShell({ 
  children,
  activeCustomer = DEFAULT_CUSTOMERS[0],
  onSelectCustomer,
  availableCustomers = DEFAULT_CUSTOMERS
}: AppShellProps) {
  const [role, setRole] = useState<Role>("FDE");
  const [activeTab, setActiveTab] = useState<string>("my-work");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const fdeNav = [
    { id: "my-work", label: "My Work Cockpit", icon: Briefcase },
    { id: "engagements", label: "All Engagements", icon: CheckSquare },
    { id: "knowledge", label: "Knowledge Base", icon: BookOpen },
    { id: "timeline", label: "Audit Timeline", icon: Clock },
  ];

  const managerNav = [
    { id: "control-center", label: "Control Center", icon: LayoutDashboard },
    { id: "engagements", label: "All Engagements", icon: CheckSquare },
    { id: "approvals", label: "Approval Center", icon: ShieldCheck, badge: 1 },
    { id: "knowledge", label: "Knowledge Base", icon: BookOpen },
    { id: "timeline", label: "Audit Timeline", icon: Clock },
  ];

  const currentNav = role === "FDE" ? fdeNav : managerNav;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900 flex flex-col justify-between p-4">
        <div>
          {/* Logo & Application Header */}
          <div className="flex items-center gap-3 px-2 py-3 mb-4 border-b border-slate-800">
            <div className="h-8 w-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 font-bold text-lg">
              C
            </div>
            <div>
              <h1 className="font-semibold text-slate-100 text-sm tracking-wide">CalmWork AI</h1>
              <p className="text-xs text-slate-400">Work-Intelligence Layer</p>
            </div>
          </div>

          {/* Active Customer Switcher (Multi-Tenant / Multi-Customer Isolation) */}
          <div className="mb-5 relative px-2">
            <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
              <Building2 className="h-3 w-3 text-teal-400" />
              Active Customer
            </label>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between text-left hover:border-slate-700 transition-all"
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
                  Switch Parallel Customer
                </div>
                {availableCustomers.map((cust) => (
                  <button
                    key={cust.id}
                    onClick={() => {
                      if (onSelectCustomer) onSelectCustomer(cust);
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
          <div className="mb-6 px-2">
            <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1.5">
              Role View
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
            {currentNav.map((item: NavItem) => {
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
            Customer-scoped data isolated & pseudonymized.
          </p>
        </div>
      </aside>

      {/* Main Content Workspace Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-slate-800 bg-slate-900/50 px-6 flex items-center justify-between">
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
