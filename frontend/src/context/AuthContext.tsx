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
  isAuthenticated: boolean;
  login: (role: UserRole) => void;
  loginWithCredentials: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
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
    if (storedRole === "MANAGER") {
      setUser(MANAGER_USER);
    } else {
      setUser(FDE_USER);
    }
  }, []);

  const login = (role: UserRole) => {
    const targetUser = role === "MANAGER" ? MANAGER_USER : FDE_USER;
    setUser(targetUser);
    setToken(`demo-${role.toLowerCase()}-token`);
    localStorage.setItem("calmwork_user_role", role);
  };

  const loginWithCredentials = async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setUser(json.data.user);
          setToken(json.data.access_token);
          localStorage.setItem("calmwork_user_role", json.data.user.role);
          return true;
        }
      }
    } catch (e) {
      console.warn("Backend auth unavailable, falling back to role preset.");
    }

    // Direct role fallback if offline
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
  };

  const switchRole = (role: UserRole) => {
    login(role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: user?.role || "FDE",
        isAuthenticated: !!user,
        login,
        loginWithCredentials,
        logout,
        switchRole
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
