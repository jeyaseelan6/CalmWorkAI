"use client";

import React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEngagement } from "@/context/EngagementContext";
import { useAuth } from "@/context/AuthContext";
import { Plus, LayoutGrid } from "lucide-react";

interface WorkspaceRailProps {
  onOpenCreateModal?: () => void;
}

const CLIENT_GRADIENTS: Record<string, string> = {
  "eng-acme-001": "from-indigo-600 to-indigo-800",
  "eng-globex-002": "from-sky-600 to-blue-800",
  "eng-helios-003": "from-emerald-600 to-teal-800",
  "eng-initech-004": "from-violet-600 to-purple-800",
  "eng-stark-005": "from-amber-600 to-orange-800",
};

const DEFAULT_GRADIENTS = [
  "from-indigo-600 to-indigo-800",
  "from-sky-600 to-blue-800",
  "from-emerald-600 to-teal-800",
  "from-violet-600 to-purple-800",
  "from-amber-600 to-orange-800",
  "from-rose-600 to-pink-800",
];

function getClientInitials(name: string): string {
  if (!name) return "CW";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function WorkspaceRail({ onOpenCreateModal }: WorkspaceRailProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { customers, activeCustomer, switchEngagement, activeTab } = useEngagement();
  const { isManager } = useAuth();

  const handleSwitch = (cust: typeof customers[0]) => {
    switchEngagement(cust);
    if (pathname?.startsWith("/engagements")) {
      router.push(`/engagements/${cust.id}${activeTab ? `?tab=${activeTab}` : ""}`);
    } else {
      router.push(`/engagements/${cust.id}?tab=myday`);
    }
  };

  return (
    <nav
      aria-label="Workspace Switcher Rail"
      className="hidden md:flex w-16 bg-slate-950 border-r border-slate-900 flex-col items-center justify-between py-3 shrink-0 z-30 select-none shadow-sm"
    >
      {/* Top Stack: Brand + Engagements */}
      <div className="flex flex-col items-center gap-2.5 w-full">
        {/* CalmWork Logo Icon */}
        <Link
          href="/engagements"
          title="CalmWork AI · All Engagements"
          className="relative group p-1 flex items-center justify-center focus:outline-none"
        >
          <div className="w-10 h-10 rounded-2xl bg-white text-slate-950 font-display font-black text-base flex items-center justify-center shadow-md transition-all group-hover:rounded-xl group-hover:scale-105">
            C
          </div>
          {/* Tooltip */}
          <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-[11px] font-semibold rounded-md shadow-xl border border-slate-800 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
            Portfolio Hub
          </div>
        </Link>

        {/* Subtle Separator */}
        <div className="w-8 h-px bg-slate-800/80 my-0.5" />

        {/* Customer Engagements Stack */}
        <div className="flex flex-col items-center gap-2.5 w-full">
          {customers.map((cust, idx) => {
            const isActive = cust.id === activeCustomer?.id;
            const isHealthy = cust.status === "HEALTHY";
            const initials = getClientInitials(cust.customerName);
            const gradient =
              CLIENT_GRADIENTS[cust.id] ||
              DEFAULT_GRADIENTS[idx % DEFAULT_GRADIENTS.length];

            return (
              <div key={cust.id} className="relative group flex items-center justify-center w-full">
                {/* Active Left Indicator Bar (Discord style) */}
                <span
                  className={`absolute left-0 w-1 bg-white rounded-r-md transition-all duration-200 ${
                    isActive
                      ? "h-8 opacity-100"
                      : "h-2 opacity-0 group-hover:opacity-70 group-hover:h-5"
                  }`}
                />

                {/* Squircle Avatar Button */}
                <button
                  type="button"
                  onClick={() => handleSwitch(cust)}
                  aria-label={`Switch to ${cust.customerName}`}
                  className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${gradient} text-white font-bold text-xs flex items-center justify-center shadow-sm relative transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/50 ${
                    isActive
                      ? "rounded-xl ring-2 ring-white ring-offset-2 ring-offset-slate-950 scale-102"
                      : "opacity-80 hover:opacity-100 hover:rounded-xl hover:scale-105"
                  }`}
                >
                  <span className="tracking-tight">{initials}</span>

                  {/* Health Status Dot Badge */}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-950 ${
                      isHealthy
                        ? "bg-emerald-400"
                        : "bg-amber-400 animate-pulse"
                    }`}
                    title={isHealthy ? "Healthy" : "Needs Review"}
                  />
                </button>

                {/* Hover Flyout Tooltip */}
                <div className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900 text-white rounded-lg shadow-2xl border border-slate-800 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-50 flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-white">{cust.customerName}</span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold ${
                        isHealthy
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          : "bg-amber-950 text-amber-300 border border-amber-800"
                      }`}
                    >
                      {isHealthy ? "Healthy" : "Needs Review"}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 truncate max-w-[180px]">
                    {cust.engagementName}
                  </span>
                </div>
              </div>
            );
          })}

          {/* "+ New Engagement" Button (Manager role) */}
          {isManager && onOpenCreateModal && (
            <div className="relative group flex items-center justify-center w-full mt-1">
              <button
                type="button"
                onClick={onOpenCreateModal}
                title="Create New Engagement"
                className="w-10 h-10 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center border border-dashed border-slate-700/80 hover:border-slate-500 transition-all duration-200 cursor-pointer hover:rounded-xl focus:outline-none"
              >
                <Plus className="h-4 w-4" />
              </button>
              {/* Tooltip */}
              <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-[11px] font-semibold rounded-md shadow-xl border border-slate-800 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                New Engagement
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Stack: Portfolio Overview Shortcut */}
      <div className="flex flex-col items-center gap-2 w-full pt-2 border-t border-slate-900">
        <Link
          href="/engagements"
          title="All Engagements Portfolio"
          className="relative group p-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-xl transition-all cursor-pointer focus:outline-none"
        >
          <LayoutGrid className="h-5 w-5" />
          <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-[11px] font-semibold rounded-md shadow-xl border border-slate-800 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
            Portfolio Grid
          </div>
        </Link>
      </div>
    </nav>
  );
}
