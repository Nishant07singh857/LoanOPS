import React from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as Sonner } from "@/components/ui/sonner";

import { SmoothScroll } from "@/components/ui/smooth-scroll";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/lib/query-client";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
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
            <Sonner position="top-right" richColors closeButton />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
