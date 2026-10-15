/**
 * CalmWork AI - Dynamic API Base URL Resolver
 * Resolves the backend API URL dynamically based on the current hostname.
 * Works seamlessly across localhost, LAN mobile testing (e.g. 192.168.x.x), and production deployments.
 */

export const getApiBase = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined" && window.location.hostname) {
    return `http://${window.location.hostname}:8000/api/v1`;
  }
  return "http://localhost:8000/api/v1";
};

export const API_BASE = typeof window !== "undefined" && window.location.hostname
  ? `http://${window.location.hostname}:8000/api/v1`
  : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1");
