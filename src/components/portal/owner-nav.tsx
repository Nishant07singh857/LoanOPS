import {
  LayoutDashboard, Landmark, FileText, Wallet, Users,
  Banknote, Receipt, BookOpen, Scale, Undo2, FilePen,
  BarChart3, LineChart, UserCog, ScrollText, FileSignature,
  QrCode, LifeBuoy, UserPlus,
} from 'lucide-react'
import type { PortalNavGroup } from './layout'

export const OWNER_BRAND = {
  name: 'Sterling Lending',
  subtitle: 'Owner Portal',
  accentClass: 'bg-gradient-fintech',
} as const

export const OWNER_NAV: PortalNavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
      { href: '/admin/create-loan', label: 'Create Loan', icon: <UserPlus className="h-4 w-4" /> },
      { href: '/admin/loans', label: 'Loans', icon: <Landmark className="h-4 w-4" /> },
      { href: '/admin/applications', label: 'Applications', icon: <FileText className="h-4 w-4" /> },
      { href: '/admin/collections', label: 'Collections', icon: <Wallet className="h-4 w-4" /> },
      { href: '/admin/disbursements', label: 'Disbursements', icon: <Banknote className="h-4 w-4" /> },
      { href: '/admin/qr-links', label: 'QR Links', icon: <QrCode className="h-4 w-4" /> },
      { href: '/admin/candidates', label: 'Candidates', icon: <Users className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/admin/payments', label: 'Payments', icon: <Receipt className="h-4 w-4" /> },
      { href: '/admin/ledger', label: 'Ledger', icon: <BookOpen className="h-4 w-4" /> },
      { href: '/admin/reconciliation', label: 'Reconciliation', icon: <Scale className="h-4 w-4" /> },
      { href: '/admin/refunds', label: 'Refunds', icon: <Undo2 className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/admin/reports', label: 'Reports', icon: <BarChart3 className="h-4 w-4" /> },
      { href: '/admin/agents', label: 'Agents', icon: <UserCog className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Settings',
    items: [
      { href: '/admin/agreements', label: 'Agreements', icon: <FileSignature className="h-4 w-4" /> },
      { href: '/admin/support', label: 'Support', icon: <LifeBuoy className="h-4 w-4" /> },
    ],
  },
]
