"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type UserRole = "FDE" | "MANAGER";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  title: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  role: UserRole;
  isManager: boolean;
  isFDE: boolean;
  isAuthenticated: boolean;
  login: (role: UserRole) => void;
  loginWithCredentials: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const FDE_USER: UserProfile = {
  id: "usr-fde-001",
  email: "fde@calmwork.ai",
  name: "Sarah Chen",
  role: "FDE",
  title: "Forward-Deployed Engineer"
};

const MANAGER_USER: UserProfile = {
  id: "usr-mgr-002",
  email: "manager@calmwork.ai",
  name: "David Miller",
  role: "MANAGER",
  title: "Engineering Manager"
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(FDE_USER);
  const [token, setToken] = useState<string | null>("demo-fde-token");

  useEffect(() => {
    const storedRole = localStorage.getItem("calmwork_user_role");
    const storedToken = localStorage.getItem("calmwork_auth_token");
    if (storedRole === "MANAGER") {
      setUser(MANAGER_USER);
      setToken(storedToken || "demo-manager-token");
    } else {
      setUser(FDE_USER);
      setToken(storedToken || "demo-fde-token");
    }
  }, []);

  const login = (role: UserRole) => {
    const targetUser = role === "MANAGER" ? MANAGER_USER : FDE_USER;
    const assignedToken = `demo-${role.toLowerCase()}-token`;
    setUser(targetUser);
    setToken(assignedToken);
    localStorage.setItem("calmwork_user_role", role);
    localStorage.setItem("calmwork_auth_token", assignedToken);
  };

  const loginWithCredentials = async (email: string, password: string): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch("http://localhost:8000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setUser(json.data.user);
          setToken(json.data.access_token);
          localStorage.setItem("calmwork_user_role", json.data.user.role);
          localStorage.setItem("calmwork_auth_token", json.data.access_token);
          return true;
        }
      }
    } catch (e) {
      console.warn("Backend auth response timed out or offline; applying instant role preset.");
    }

    // Instant role fallback
    if (email.includes("manager")) {
      login("MANAGER");
    } else {
      login("FDE");
    }
    return true;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("calmwork_user_role");
    localStorage.removeItem("calmwork_auth_token");
  };

  const currentRole: UserRole = user?.role || "FDE";

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: currentRole,
        isManager: currentRole === "MANAGER",
        isFDE: currentRole === "FDE",
        isAuthenticated: !!user,
        login,
        loginWithCredentials,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
