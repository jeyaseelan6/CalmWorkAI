import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { EngagementProvider } from "@/context/EngagementContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CalmWork AI — Outcome Intelligence SaaS",
  description: "Outcome-Driven Work-Intelligence SaaS Platform for Forward-Deployed Engineers & Managers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
        <AuthProvider>
          <EngagementProvider>{children}</EngagementProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

