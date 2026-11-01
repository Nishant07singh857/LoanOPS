import React from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as Sonner } from "@/components/ui/sonner";

import { SmoothScroll } from "@/components/ui/smooth-scroll";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/lib/query-client";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  // Google Search Console HTML-tag verification (URL-prefix property —
  // loanops.vercel.app is a Vercel-owned domain, so DNS verification
  // is impossible). Rendered only when the token is configured; the
  // token is a public verification string, not a secret.
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
  title: "LoanOps — Premium Loan Operations Platform",
  description: "Production-grade loan operations platform with Owner, Agent & Candidate portals. Origination, KYC, disbursement, repayments, collections, AI insights, and audit.",
  keywords: ["LoanOps", "Lending", "Fintech", "Loan Management", "Collections", "NBFC"],
  authors: [{ name: "LoanOps" }],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "LoanOps — Premium Loan Operations Platform",
    description: "Production-grade loan operations platform with Owner, Agent & Candidate portals. Origination, KYC, disbursement, repayments, collections, AI insights, and audit.",
    type: "website",
    locale: "en_US",
    siteName: "LoanOps",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen overflow-x-hidden selection:bg-primary/20`}
      >
        <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background z-[-1]" />
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <QueryProvider>
            <SmoothScroll>
              {children}
            </SmoothScroll>
            {/* Explicit standard duration: report-generation toasts were
                observed lingering past the timing used elsewhere. */}
            <Sonner position="top-right" richColors closeButton duration={4000} />
          </QueryProvider>
        </ThemeProvider>
        {/* Cookieless Vercel Web Analytics + Speed Insights. Both are
            inert off Vercel and until enabled in the project dashboard
            (see docs/LAUNCH.md); chosen over GA4 to keep the public
            site free of cookie/consent machinery under DPDP. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
