"use client";

import React, { useState, useEffect } from "react";
import { useAuth, UserRole } from "@/context/AuthContext";
import { ShieldCheck, User, Lock, Sparkles, ArrowRight, Building2, CheckCircle2, AlertTriangle, Key } from "lucide-react";

export default function LoginPage() {
  const { loginWithCredentials, login, isAuthenticated, isLoadingAuth } = useAuth();
  
  const [selectedRole, setSelectedRole] = useState<UserRole>("FDE");
  const [email, setEmail] = useState("fde@calmwork.ai");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated with a valid JWT session, redirect to cockpit
  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) {
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    }
  }, [isLoadingAuth, isAuthenticated]);

  const handleRoleTabChange = (role: UserRole) => {
    setSelectedRole(role);
    setError(null);
    if (role === "MANAGER") {
      setEmail("manager@calmwork.ai");
    } else {
      setEmail("fde@calmwork.ai");
    }
    setPassword("password123");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await loginWithCredentials(email, password);
    setLoading(false);
    if (result.success) {
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    } else {
      setError(result.error || "Invalid email or password. Please verify your credentials.");
    }
  };

  const handleQuickDemoLogin = async (role: UserRole) => {
    setError(null);
    setLoading(true);
    const success = await login(role);
    setLoading(false);
    if (success) {
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    } else {
      setError(`Failed to sign in as Demo ${role}. Please check backend server connection.`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Logo Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/30 px-3.5 py-1.5 rounded-full text-teal-300 text-xs font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-teal-400" />
            <span>Secure Workspace Access</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight font-display">CalmWork AI</h1>
          <p className="text-xs text-slate-400">
            Outcome-Driven Work-Intelligence SaaS Platform for FDEs & Managers
          </p>
        </div>

        {/* Role Tab Selector */}
        <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 grid grid-cols-2 gap-1 text-xs">
          <button
            type="button"
            onClick={() => handleRoleTabChange("FDE")}
            className={`py-2.5 font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
              selectedRole === "FDE"
                ? "bg-teal-600 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <User className="h-3.5 w-3.5" />
            <span>Forward-Deployed Engineer</span>
          </button>
          <button
            type="button"
            onClick={() => handleRoleTabChange("MANAGER")}
            className={`py-2.5 font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
              selectedRole === "MANAGER"
                ? "bg-teal-600 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Engineering Manager</span>
          </button>
        </div>

        {/* Authentication Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-5">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-100">
              Sign In as {selectedRole === "FDE" ? "FDE (Forward-Deployed Engineer)" : "Engineering Manager"}
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              {selectedRole === "FDE"
                ? "Access customer engagement cockpits, 6 work cycles, knowledge search & work plans."
                : "Access manager governance, outcome version approvals, DoD checklist sign-off & customer updates."}
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-lg text-xs text-rose-300 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold block text-rose-200">Authentication Failed</span>
                <span className="text-rose-300/90 text-[11px] leading-relaxed">{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                Work Email
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500 font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold py-2.5 rounded-lg text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer shadow-md"
            >
              {loading ? (
                <Sparkles className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>Sign In to Cockpit</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Sign In Shortcuts */}
          <div className="pt-3 border-t border-slate-800/80 space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Quick Demo Access:
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin("FDE")}
                disabled={loading}
                className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 py-2 rounded-lg text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-400" />
                <span>Demo FDE (Sarah)</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin("MANAGER")}
                disabled={loading}
                className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 py-2 rounded-lg text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Demo Manager (David)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
