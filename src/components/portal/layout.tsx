'use client'

import * as React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Bell, Menu, Search, Settings, LogOut, ChevronDown, Wallet, Moon, Sun
} from 'lucide-react'
import { useSession, type Role } from '@/lib/session'
import { useTheme } from 'next-themes'

export interface PortalNavItem {
  href: string
  label: string
  icon: React.ReactNode
  badge?: number
}

export interface PortalNavGroup {
  label: string
  items: PortalNavItem[]
}

export interface PortalLayoutProps {
  role: Role
  groups: PortalNavGroup[]
  brand: { name: string; subtitle: string; accentClass: string }
  children: React.ReactNode
  notifications?: { count: number }
  navMode: 'sidebar' | 'topbottom' // owner=sidebar; agent/candidate=top+bottom
}

export function PortalLayout({ role, groups, brand, children, notifications, navMode }: PortalLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useSession()
  const { theme, setTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const useSidebar = navMode === 'sidebar'
  const initials = user?.name?.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() || 'U'

  // Flatten nav items for bottom nav
  const flatItems = groups.flatMap(g => g.items)
  const bottomItems = flatItems.slice(0, 5)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between gap-2 h-16 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {useSidebar && (
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <SidebarContent
                    groups={groups}
                    pathname={pathname}
                    onNavigate={() => setMobileOpen(false)}
                    brand={brand}
                    user={user}
                    onLogout={logout}
                  />
                </SheetContent>
              </Sheet>
            )}
            <div className="flex items-center gap-2.5">
              <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shadow-glow', brand.accentClass)}>
                <Wallet className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="hidden sm:block">
                <p className="font-bold tracking-tight leading-none text-sm">{brand.name}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{brand.subtitle}</p>
              </div>
            </div>
          </div>

          {role !== 'CANDIDATE' && (
            <div className="flex-1 max-w-md hidden md:flex items-center">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search candidates, loans, applications..."
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-1.5 sm:gap-2">
            {mounted && (
              <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="hidden sm:inline-flex">
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            )}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              {notifications?.count ? (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
              ) : null}
            </Button>
            <UserMenu user={user} initials={initials} onLogout={logout} />
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1">
        {useSidebar && (
          <>
            <aside className="hidden lg:block w-64 xl:w-72 border-r border-border bg-sidebar/40 sticky top-16 self-start h-[calc(100vh-4rem)] overflow-y-auto">
              <SidebarContent
                groups={groups}
                pathname={pathname}
                onNavigate={() => {}}
                brand={brand}
                user={user}
                onLogout={logout}
              />
            </aside>
          </>
        )}

        <main className="flex-1 min-w-0 pb-24 sm:pb-6 lg:pb-6">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Bottom navigation (agent & candidate, and owner on mobile) */}
      {!useSidebar && (
        <BottomNav items={bottomItems} pathname={pathname} />
      )}
      {useSidebar && (
        <BottomNav items={bottomItems} pathname={pathname} className="lg:hidden" />
      )}
    </div>
  )
}

function SidebarContent({
  groups, pathname, onNavigate, brand, user, onLogout
}: {
  groups: PortalNavGroup[]
  pathname: string
  onNavigate: () => void
  brand: PortalLayoutProps['brand']
  user: any
  onLogout: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-sidebar-border/60">
        <div className="flex items-center gap-2.5">
          <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shadow-glow', brand.accentClass)}>
            <Wallet className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-bold tracking-tight leading-none text-sm">{brand.name}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{brand.subtitle}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6 no-scrollbar">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href + '/'))
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                      active
                        ? 'bg-primary text-primary-foreground shadow-glow'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <span className="flex-shrink-0 h-4 w-4 flex items-center justify-center">{item.icon}</span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge ? (
                      <Badge variant="secondary" className={cn('text-[10px] h-5 px-1.5', active && 'bg-primary-foreground/20 text-primary-foreground')}>
                        {item.badge}
                      </Badge>
                    ) : null}
                  </a>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-sidebar-border/60">
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-sidebar-accent/50">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {user?.name?.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onLogout} className="h-8 w-8">
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function BottomNav({ items, pathname, className }: { items: PortalNavItem[]; pathname: string; className?: string }) {
  return (
    <nav className={cn('sm:hidden fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur-xl border-t border-border pb-safe', className)}>
      <div className="grid grid-cols-5 gap-1 px-2 pt-2">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== '/admin' && item.href !== '/portal' && item.href !== '/agent' && pathname.startsWith(item.href))
          return (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl text-[10px] font-medium transition-colors min-h-[44px]',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <span className={cn('h-5 w-5 flex items-center justify-center', active && 'scale-110 transition-transform')}>
                {item.icon}
              </span>
              <span className="truncate max-w-[64px]">{item.label}</span>
              {item.badge ? (
                <span className="absolute top-1 right-1/4 h-1.5 w-1.5 rounded-full bg-destructive" />
              ) : null}
              {active && (
                <motion.span
                  layoutId="bottom-nav-indicator"
                  className="absolute -top-2 h-1 w-8 rounded-full bg-primary"
                />
              )}
            </a>
          )
        })}
      </div>
    </nav>
  )
}

function UserMenu({ user, initials, onLogout }: { user: any; initials: string; onLogout: () => void }) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 p-1 pr-2 rounded-xl hover:bg-muted transition-colors"
      >
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-border bg-popover shadow-glow overflow-hidden z-50"
          >
            <div className="p-3 border-b border-border">
              <p className="text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              <Badge variant="secondary" className="mt-2 text-[10px]">{user?.role}</Badge>
            </div>
            <div className="p-1">
              <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors">
                <Settings className="h-4 w-4" /> Settings
              </button>
              <button onClick={onLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted text-destructive transition-colors">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
