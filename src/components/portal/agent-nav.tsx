import {
  Home, ListTodo, Users, PhoneCall, Handshake, Banknote,
  AlertTriangle, StickyNote, MessageCircle, Trophy, LifeBuoy,
} from 'lucide-react'
import type { PortalNavGroup } from './layout'

export const AGENT_BRAND = {
  name: 'Sterling Lending',
  subtitle: 'Agent Portal',
  accentClass: 'bg-gradient-to-br from-purple-900 via-indigo-900 to-purple-800 shadow-glow',
} as const

export const AGENT_NAV: PortalNavGroup[] = [
  {
    label: 'Main',
    items: [
      { href: '/agent', label: 'Home', icon: <Home className="h-4 w-4" /> },
      { href: '/agent/tasks', label: 'Tasks', icon: <ListTodo className="h-4 w-4" />, badge: 12 },
      { href: '/agent/candidates', label: 'Candidates', icon: <Users className="h-4 w-4" /> },
      { href: '/agent/followups', label: 'Follow-ups', icon: <PhoneCall className="h-4 w-4" />, badge: 5 },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/agent/create-loan', label: 'Originate Loan', icon: <Banknote className="h-4 w-4" /> },
      { href: '/agent/ptp', label: 'PTP', icon: <Handshake className="h-4 w-4" />, badge: 3 },
      { href: '/agent/cash', label: 'Cash', icon: <Banknote className="h-4 w-4" />, badge: 2 },
      { href: '/agent/escalations', label: 'Escalations', icon: <AlertTriangle className="h-4 w-4" /> },
      { href: '/agent/notes', label: 'Notes', icon: <StickyNote className="h-4 w-4" /> },
    ],
  },
  {
    label: 'More',
    items: [
      { href: '/agent/whatsapp', label: 'WhatsApp', icon: <MessageCircle className="h-4 w-4" /> },
      { href: '/agent/performance', label: 'Performance', icon: <Trophy className="h-4 w-4" /> },
      { href: '/agent/support', label: 'Support', icon: <LifeBuoy className="h-4 w-4" /> },
    ],
  },
]
