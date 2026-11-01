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

const DEFAULT_TITLE = "LoanOps — Premium Loan Operations Platform";
const DEFAULT_DESCRIPTION =
  "Loan operations platform for lending businesses — origination, KYC, disbursement, repayment schedules, collections and audit trails across owner, agent and borrower portals.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  // Google Search Console HTML-tag verification (URL-prefix property —
  // loanops.vercel.app is a Vercel-owned domain, so DNS verification
  // is impossible). Rendered only when the token is configured; the
  // token is a public verification string, not a secret.
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
  // `default` is the title every page without its own renders (byte-for-
  // byte what the plain string produced before); `template` brands any
  // page-level title. Pages whose titles predate the template declare
  // them `absolute`, so their rendered titles do not change. Icons come
  // from the app/favicon.ico, app/icon.svg and app/apple-icon file
  // conventions, not from metadata.
  title: {
    default: DEFAULT_TITLE,
    template: "%s · LoanOps",
  },
  description: DEFAULT_DESCRIPTION,
  keywords: ["LoanOps", "Lending", "Fintech", "Loan Management", "Collections", "NBFC"],
  authors: [{ name: "LoanOps" }],
  openGraph: {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    type: "website",
    locale: "en_US",
    siteName: "LoanOps",
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
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
