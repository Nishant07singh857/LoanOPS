import {
  Home, Wallet, CreditCard, CalendarClock, FileText,
  Bell, LifeBuoy, UserCircle,
} from 'lucide-react'
import type { PortalNavGroup } from './layout'

export const CANDIDATE_BRAND = {
  name: 'Sterling Lending',
  subtitle: 'My Loan',
  accentClass: 'bg-gradient-to-br from-purple-950 via-purple-800 to-amber-600 shadow-glow',
} as const

export const CANDIDATE_NAV: PortalNavGroup[] = [
  {
    label: 'Main',
    items: [
      { href: '/portal', label: 'Home', icon: <Home className="h-4 w-4" /> },
      { href: '/portal/loan', label: 'Loan', icon: <Wallet className="h-4 w-4" /> },
      { href: '/portal/payments', label: 'Payments', icon: <CreditCard className="h-4 w-4" /> },
      { href: '/portal/schedule', label: 'Schedule', icon: <CalendarClock className="h-4 w-4" /> },
    ],
  },
  {
    label: 'More',
    items: [
      { href: '/portal/receipts', label: 'Receipts', icon: <FileText className="h-4 w-4" /> },
      { href: '/portal/notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" />, badge: 1 },
      { href: '/portal/support', label: 'Support', icon: <LifeBuoy className="h-4 w-4" /> },
      { href: '/portal/profile', label: 'Profile', icon: <UserCircle className="h-4 w-4" /> },
    ],
  },
]
