'use client'

import * as React from 'react'
import Link from 'next/link'
import { ShieldCheck, Scale, Lock, Phone, Mail, ExternalLink } from 'lucide-react'
import { COMPLIANCE_CONFIG } from '@/lib/compliance-config'
import { cn } from '@/lib/utils'

export interface LegalFooterProps {
  compact?: boolean
  className?: string
}

const LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy Policy (DPDP)' },
  { href: '/terms', label: 'Terms & Conditions' },
  { href: '/kfs', label: 'Key Facts Statement (KFS)' },
  { href: '/grievance', label: 'Grievance Redressal' },
  { href: '/fair-practices', label: 'Fair Practices Code' },
]

export function LegalFooter({ compact = false, className }: LegalFooterProps) {
  if (compact) {
    return (
      <footer
        className={cn(
          'w-full border-t border-border/50 pt-4 pb-2 text-center text-xs text-muted-foreground',
          className
        )}
      >
        <nav
          aria-label="Legal and compliance links"
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5"
        >
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-foreground underline-offset-4 hover:underline transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="mt-2 text-[11px] text-muted-foreground/80">
          {COMPLIANCE_CONFIG.companyName} · Policy v{COMPLIANCE_CONFIG.policyVersion} · Grievance:{' '}
          <a
            href={`mailto:${COMPLIANCE_CONFIG.grievanceOfficer.email}`}
            className="hover:text-foreground underline underline-offset-2"
          >
            {COMPLIANCE_CONFIG.grievanceOfficer.email}
          </a>
        </p>
      </footer>
    )
  }

  return (
    <footer
      className={cn(
        'mt-auto border-t border-border/60 bg-card/60 backdrop-blur-sm text-muted-foreground',
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1: Entity & Regulatory Disclosures */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
              <span>{COMPLIANCE_CONFIG.companyName}</span>
            </div>
            <p className="text-xs leading-relaxed">
              Registered Office: {COMPLIANCE_CONFIG.registeredAddress}
            </p>
            <div className="text-[11px] space-y-1 pt-1 font-mono text-muted-foreground/90">
              <p>CIN: {COMPLIANCE_CONFIG.cinNumber}</p>
              <p>Regulated Entity / NBFC: {COMPLIANCE_CONFIG.rbiRegistration}</p>
            </div>
          </div>

          {/* Column 2: Statutory & Compliance Links */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
              <Scale className="h-4 w-4 text-primary shrink-0" />
              <span>Regulatory &amp; Legal Disclosures</span>
            </div>
            <nav aria-label="Legal navigation" className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
              {LEGAL_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="hover:text-foreground hover:underline underline-offset-4 transition-colors py-0.5"
                >
                  {link.label}
                </Link>
              ))}
              <a
                href={COMPLIANCE_CONFIG.rbiOmbudsmanPortalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground hover:underline underline-offset-4 transition-colors py-0.5"
              >
                RBI CMS Portal <ExternalLink className="h-3 w-3" />
              </a>
            </nav>
          </div>

          {/* Column 3: Nodal Grievance & Data Protection Officer */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
              <Lock className="h-4 w-4 text-primary shrink-0" />
              <span>Nodal Grievance &amp; Data Protection Officer</span>
            </div>
            <div className="text-xs space-y-1">
              <p className="font-medium text-foreground/90">
                {COMPLIANCE_CONFIG.grievanceOfficer.name}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {COMPLIANCE_CONFIG.grievanceOfficer.designation}
              </p>
              <p className="flex items-center gap-1.5 pt-0.5">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <a
                  href={`mailto:${COMPLIANCE_CONFIG.grievanceOfficer.email}`}
                  className="hover:text-foreground underline underline-offset-2"
                >
                  {COMPLIANCE_CONFIG.grievanceOfficer.email}
                </a>
              </p>
              <p className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span>{COMPLIANCE_CONFIG.grievanceOfficer.phone} (Mon–Sat, 9:30 AM – 6:30 PM IST)</span>
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-border/50 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-muted-foreground/80">
          <p>
            All financial calculations use integer paise on the server · AES-256-GCM KYC encryption · Append-only audit trail · Policy v{COMPLIANCE_CONFIG.policyVersion} ({COMPLIANCE_CONFIG.lastUpdated})
          </p>
          <p className="shrink-0">
            Field Collection Hours: {COMPLIANCE_CONFIG.collectionHours}
          </p>
        </div>
      </div>
    </footer>
  )
}
