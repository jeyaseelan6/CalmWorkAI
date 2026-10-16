/**
 * CalmWork AI - Unified API Resolver
 * In the browser (both laptop and mobile over Wi-Fi), uses relative '/api/v1'
 * which Next.js rewrites to the local FastAPI backend at http://127.0.0.1:8000/api/v1.
 * This completely bypasses mobile LAN port restrictions and Windows Firewall issues.
 */

export const API_BASE = typeof window !== "undefined"
  ? "/api/v1"
  : (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/v1` : (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1"));

export const getApiBase = (): string => API_BASE;
