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

export interface LoginResult {
  success: boolean;
  error?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  role: UserRole;
  isManager: boolean;
  isFDE: boolean;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  login: (role: UserRole) => Promise<boolean>;
  loginWithCredentials: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  switchRole: (role: UserRole) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

import { API_BASE } from "@/utils/api";

const DEMO_CREDENTIALS: Record<UserRole, { email: string; password: string }> = {
  FDE: { email: "fde@calmwork.ai", password: "password123" },
  MANAGER: { email: "manager@calmwork.ai", password: "password123" }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);

  // Initialize and verify JWT session on mount
  useEffect(() => {
    const initAuthSession = async () => {
      if (typeof window === "undefined") {
        setIsLoadingAuth(false);
        return;
      }

      const storedToken = localStorage.getItem("calmwork_auth_token");
      if (!storedToken) {
        setUser(null);
        setToken(null);
        setIsLoadingAuth(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${storedToken}`
          }
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setUser(json.data);
            setToken(storedToken);
            localStorage.setItem("calmwork_user_role", json.data.role);
            localStorage.setItem("calmwork_user_data", JSON.stringify(json.data));
            setIsLoadingAuth(false);
            return;
          }
        }

        // If backend explicitly rejected the token (401 / 403)
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem("calmwork_auth_token");
          localStorage.removeItem("calmwork_user_role");
          localStorage.removeItem("calmwork_user_data");
          setUser(null);
          setToken(null);
        } else {
          // If server returned another status, check if we have cached session
          const cachedUser = localStorage.getItem("calmwork_user_data");
          if (cachedUser) {
            setUser(JSON.parse(cachedUser));
            setToken(storedToken);
          }
        }
      } catch (err) {
        // Backend temporarily offline: recover cached session if available
        const cachedUser = localStorage.getItem("calmwork_user_data");
        if (cachedUser) {
          setUser(JSON.parse(cachedUser));
          setToken(storedToken);
        }
      } finally {
        setIsLoadingAuth(false);
      }
    };

    initAuthSession();
  }, []);

  const loginWithCredentials = async (email: string, password: string): Promise<LoginResult> => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password })
      });

      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success && json.data) {
        const { access_token, user: userData } = json.data;
        setUser(userData);
        setToken(access_token);
        if (typeof window !== "undefined") {
          localStorage.setItem("calmwork_auth_token", access_token);
          localStorage.setItem("calmwork_user_role", userData.role);
          localStorage.setItem("calmwork_user_data", JSON.stringify(userData));
        }
        return { success: true };
      } else {
        return {
          success: false,
          error: json.detail || json.message || "Invalid email or password."
        };
      }
    } catch (err: any) {
      return {
        success: false,
        error: "Unable to connect to authentication server. Please check backend connection."
      };
    }
  };

  const login = async (role: UserRole): Promise<boolean> => {
    const creds = DEMO_CREDENTIALS[role];
    const result = await loginWithCredentials(creds.email, creds.password);
    return result.success;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("calmwork_auth_token");
      localStorage.removeItem("calmwork_user_role");
      localStorage.removeItem("calmwork_user_data");
      // Immediately navigate to the login screen
      window.location.href = "/login";
    }
  };

  const switchRole = async (targetRole: UserRole): Promise<boolean> => {
    return await login(targetRole);
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
        isAuthenticated: !!user && !!token,
        isLoadingAuth,
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
