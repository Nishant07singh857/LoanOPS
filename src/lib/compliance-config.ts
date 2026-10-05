// TODO: LEGAL REVIEW REQUIRED — All legal text, disclosures, KFS templates, and privacy policies must be reviewed by a qualified Indian legal counsel before commercial launch. Operating as a digital lender in India requires RBI registration as an NBFC or a regulated RE-LSP partnership under RBI Digital Lending Guidelines. Do not invent registration/licence numbers.

export interface ConsentDefinition {
  id: 'DATA_PROCESSING' | 'KYC_AADHAAR' | 'CREDIT_CHECK' | 'COMMUNICATION' | 'KFS_DISCLOSURE' | 'TERMS_PRIVACY'
  title: string
  description: string
  required: boolean
  legalBasis: string
}

export const REQUIRED_CONSENTS: ConsentDefinition[] = [
  {
    id: 'DATA_PROCESSING',
    title: 'Personal Data Processing & Privacy Policy (DPDP Act, 2023)',
    description:
      'I explicitly consent to the collection, storage, and processing of my personal data (name, contact details, address, employment, and financial records) strictly for loan origination, servicing, accounting, and statutory compliance in accordance with the Privacy Policy (v2026.1) and the Digital Personal Data Protection Act, 2023.',
    required: true,
    legalBasis: 'Section 6, DPDP Act 2023 — Explicit Informed Consent',
  },
  {
    id: 'KYC_AADHAAR',
    title: 'KYC Identity, PAN & Masked Aadhaar (Last 4 Digits) Verification',
    description:
      'I voluntarily provide my PAN and masked Aadhaar (last 4 digits only) / identity documents for Know Your Customer (KYC) verification and anti-money laundering (PMLA) compliance. I understand my full Aadhaar number is never stored in plaintext.',
    required: true,
    legalBasis: 'RBI Master Direction — Know Your Customer (KYC) Direction & PMLA',
  },
  {
    id: 'CREDIT_CHECK',
    title: 'Credit, Income & Repayment Obligation Assessment',
    description:
      'I authorize the platform and its Regulated Entity partner to evaluate my declared income, bank account details, and repayment capacity, and to report loan repayment performance to Credit Information Companies (CICs) as applicable.',
    required: true,
    legalBasis: 'RBI Digital Lending Guidelines & CIC (Regulation) Act',
  },
  {
    id: 'KFS_DISCLOSURE',
    title: 'Key Facts Statement (KFS), APR & Cooling-Off Period Acceptance',
    description:
      'I have read and understood the Key Facts Statement (KFS), including the Annual Percentage Rate (APR), processing fees, net disbursed amount, installment schedule, offline cash collection receipt requirements, and my 3-day cooling-off / look-up right.',
    required: true,
    legalBasis: 'RBI Circular on Key Facts Statement (KFS) for Loans & Advances',
  },
  {
    id: 'COMMUNICATION',
    title: 'Promotional Offers & Optional WhatsApp Updates (Optional)',
    description:
      'I consent to receive optional product updates, financial literacy tips, and pre-approved credit offers via WhatsApp, SMS, or Email. (Note: Transactional payment reminders, digital receipts, and statutory notices will still be sent regardless of this preference.)',
    required: false,
    legalBasis: 'DPDP Act 2023 — Unbundled Optional Consent (Withdrawable Anytime)',
  },
]

const defaultAddress =
  process.env.NEXT_PUBLIC_COMPANY_ADDRESS ||
  'Level 8, Maker Maxity, Bandra Kurla Complex, Mumbai, Maharashtra 400051, India'

export const COMPLIANCE_CONFIG = {
  companyName:
    process.env.NEXT_PUBLIC_COMPANY_NAME ||
    'Sterling Lending Operations (Technology Platform)',
  cinNumber:
    process.env.NEXT_PUBLIC_COMPANY_CIN ||
    '[CIN PLACEHOLDER — SET NEXT_PUBLIC_COMPANY_CIN]',
  rbiRegistration:
    process.env.NEXT_PUBLIC_RBI_REG_NUMBER ||
    '[REGULATED ENTITY / NBFC LICENCE PLACEHOLDER — SET NEXT_PUBLIC_RBI_REG_NUMBER]',
  registeredAddress: defaultAddress,
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@loanops.in',
  supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || '+91-22-4000-0000',
  grievanceOfficer: {
    name:
      process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME ||
      '[Designated Grievance Officer — Configure in Env]',
    email:
      process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER_EMAIL || 'grievance@loanops.in',
    phone:
      process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER_PHONE || '+91-22-4000-0001',
    designation: 'Nodal Grievance Redressal & Data Protection Officer',
    address: defaultAddress,
    responseTimelineDays: 7,
    resolutionTimelineDays: 30,
  },
  policyVersion: '2026.1',
  lastUpdated: 'October 4, 2026',
  coolingOffDays: 3,
  collectionHours: '8:00 AM to 7:00 PM IST',
  jurisdiction: 'Mumbai, Maharashtra, India',
  rbiOmbudsmanPortalUrl: 'https://cms.rbi.org.in',
  sachetPortalUrl: 'https://sachet.rbi.org.in',
  REQUIRED_CONSENTS,
} as const
