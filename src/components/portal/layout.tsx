'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Bell, Menu, Search, Settings, LogOut, ChevronDown, Wallet, Moon, Sun
} from 'lucide-react'
import { useSession, type Role } from '@/lib/session'
import { useTheme } from 'next-themes'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Toggle } from '@/components/ui/toggle'

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
  navMode: 'sidebar' | 'topbottom'
}

export function PortalLayout({ role, groups, brand, children, notifications, navMode }: PortalLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useSession()
  const { theme, setTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setMounted(true), [])

  const useSidebar = navMode === 'sidebar'
  const initials = user?.name?.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() || 'U'

  const flatItems = groups.flatMap(g => g.items)
  const bottomItems = flatItems.slice(0, 5)

  const notificationsHref = role === 'CANDIDATE'
    ? '/portal/notifications'
    : role === 'AGENT'
      ? '/agent/tasks'
      : '/admin/applications'

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    const base = role === 'AGENT' ? '/agent/candidates' : '/admin/candidates'
    router.push(q ? `${base}?q=${encodeURIComponent(q)}` : base)
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background flex flex-col w-full overflow-x-hidden transition-colors duration-300">
        {/* Top bar with subtle luxury gold highlight */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border shadow-sm transition-all duration-300">
          <div className="flex items-center justify-between gap-2 h-16 px-4 sm:px-6 max-w-full">
            <div className="flex items-center gap-3">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(useSidebar ? 'lg:hidden' : 'md:hidden', 'min-h-[44px] min-w-[44px] interactive-scale hover:bg-muted/50 rounded-xl')}
                    aria-label="Open menu"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0 flex flex-col glass">
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <SidebarContent
                    className="pt-10 sm:pt-4"
                    groups={groups}
                    pathname={pathname}
                    onNavigate={() => setMobileOpen(false)}
                    brand={brand}
                    user={user}
                    onLogout={logout}
                  />
                </SheetContent>
              </Sheet>
              <div className="flex items-center gap-2.5 group cursor-pointer" onClick={() => router.push('/')}>
                <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shadow-glow border border-amber-300/20 transition-transform duration-300 group-hover:scale-105 group-active:scale-95', brand.accentClass)}>
                  <Wallet className="h-5 w-5 text-primary-foreground drop-shadow-md" />
                </div>
                <div className="flex flex-col">
                  <p className="font-bold tracking-tight leading-none text-xs sm:text-sm max-w-[140px] sm:max-w-none truncate group-hover:text-primary transition-colors">{brand.name}</p>
                  <p className="text-[9px] sm:text-[10px] text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wider mt-0.5 max-w-[140px] sm:max-w-none truncate">{brand.subtitle}</p>
                </div>
              </div>
            </div>

            {/* Desktop Navigation for non-sidebar */}
            {!useSidebar && (
              <nav aria-label="Main navigation" className="hidden md:flex items-center gap-2 mx-2 lg:mx-4 overflow-x-auto no-scrollbar">
                {groups.map((group) => {
                  if (group.label === 'Main') {
                    return group.items.map((item) => {
                      const active = pathname === item.href || (item.href !== '/portal' && item.href !== '/agent' && pathname.startsWith(item.href + '/'))
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 whitespace-nowrap interactive-scale',
                            active
                              ? 'bg-primary text-primary-foreground shadow-glow font-semibold'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          )}
                        >
                          <span className={cn("h-3.5 w-3.5 flex items-center justify-center transition-transform", active && "scale-110")}>{item.icon}</span>
                          <span>{item.label}</span>
                          {item.badge ? (
                            <Badge variant="secondary" className={cn('text-[10px] h-4 px-1 ml-1', active && 'bg-primary-foreground/20 text-primary-foreground')}>
                              {item.badge}
                            </Badge>
                          ) : null}
                        </Link>
                      )
                    })
                  }
                  return <NavDropdown key={group.label} group={group} pathname={pathname} onNavigate={() => {}} />
                })}
              </nav>
            )}

            {/* Owner portal desktop search bar */}
            {useSidebar && role !== 'CANDIDATE' && (
              <div className="flex-1 hidden md:flex items-center justify-end gap-4 ml-4 mr-2">
                <div className="text-sm font-medium whitespace-nowrap hidden lg:block text-muted-foreground transition-colors">
                  Welcome, <span className="text-foreground font-semibold">{user?.name?.split(' ')[0] || 'User'}</span>
                </div>
                <form onSubmit={handleSearchSubmit} className="relative w-full max-w-md group" role="search">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none group-focus-within:text-primary transition-colors" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search candidates, loans..."
                    aria-label="Search candidates and loans"
                    className="w-full h-9 pl-9 pr-3 rounded-full bg-muted/50 border border-transparent hover:border-border text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-background transition-all duration-200 shadow-sm"
                  />
                </form>
              </div>
            )}

            <div className="flex items-center gap-1.5 sm:gap-2">
              {mounted && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Toggle
                      size="sm"
                      pressed={theme === 'dark'}
                      onPressedChange={(pressed) => setTheme(pressed ? 'dark' : 'light')}
                      className="inline-flex rounded-xl data-[state=on]:bg-primary/10 data-[state=on]:text-primary border border-transparent hover:border-border hover:bg-muted transition-all duration-200 interactive-scale"
                      aria-label="Toggle theme"
                    >
                      {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400 drop-shadow-sm" /> : <Moon className="h-4 w-4 text-primary" />}
                    </Toggle>
                  </TooltipTrigger>
                  <TooltipContent className="glass font-medium rounded-lg text-xs">
                    <p>Switch to {theme === 'dark' ? 'light' : 'dark'} mode</p>
                  </TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push(notificationsHref)}
                    className="relative min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9 rounded-xl hover:bg-muted transition-all interactive-scale"
                    aria-label="Notifications"
                  >
                    <Bell className="h-4 w-4" />
                    {notifications?.count ? (
                      <span className="absolute top-1.5 right-1.5 sm:top-1 sm:right-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-background animate-pulse" />
                    ) : null}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="glass font-medium rounded-lg text-xs">
                  <p>{notifications?.count ? `${notifications.count} new notifications` : 'No new notifications'}</p>
                </TooltipContent>
              </Tooltip>
              <UserMenu user={user} initials={initials} onLogout={logout} />
            </div>
          </div>
        </header>

      {/* Body */}
      <div className="flex flex-1">
        {useSidebar && (
          <aside className="hidden lg:flex flex-col w-64 xl:w-72 border-r border-border bg-sidebar/30 backdrop-blur-xl sticky top-16 self-start h-[calc(100vh-4rem)] overflow-hidden transition-all duration-300">
            <SidebarContent
              groups={groups}
              pathname={pathname}
              onNavigate={() => {}}
              brand={brand}
              user={user}
              onLogout={logout}
            />
          </aside>
        )}

        <main className={cn(
          "flex-1 min-w-0 w-full overflow-x-hidden transition-all duration-300",
          useSidebar ? "pb-24 lg:pb-6" : "pb-24 md:pb-6"
        )}>
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 w-full animate-in fade-in duration-500">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom navigation */}
      {!useSidebar && (
        <BottomNav items={bottomItems} pathname={pathname} className="md:hidden" />
      )}
      {useSidebar && (
        <BottomNav items={bottomItems} pathname={pathname} className="lg:hidden" />
      )}
      </div>
    </TooltipProvider>
  )
}


function SidebarContent({
  groups, pathname, onNavigate, brand, user, onLogout, className
}: {
  groups: PortalNavGroup[]
  pathname: string
  onNavigate: () => void
  brand: PortalLayoutProps['brand']
  user: any
  onLogout: () => void
  className?: string
}) {
  return (
    <div className={cn("flex flex-col h-full min-h-0", className)}>
      <nav aria-label="Sidebar navigation" className="flex-1 min-h-0 overflow-y-auto no-scrollbar py-2 px-2 space-y-2">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || (item.href !== '/admin' && item.href !== '/agent' && item.href !== '/portal' && pathname.startsWith(item.href + '/'))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 px-3 py-1.5 rounded-xl text-sm font-medium transition-all min-h-[40px]',
                      active
                        ? 'bg-gradient-to-r from-primary via-primary/95 to-primary/90 text-primary-foreground shadow-glow border-l-2 border-amber-400 font-semibold'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <span className="flex-shrink-0 h-4 w-4 flex items-center justify-center">{item.icon}</span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge ? (
                      <Badge variant="secondary" className={cn('ml-auto text-[10px] h-4 px-1 flex-shrink-0', active && 'bg-primary-foreground/20 text-primary-foreground')}>
                        {item.badge}
                      </Badge>
                    ) : null}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-2 border-t border-sidebar-border/60 shrink-0">
        <div className="flex items-center gap-2 p-2 rounded-xl bg-sidebar-accent/50 border border-border/40">
          <Avatar className="h-8 w-8 border border-amber-300/30">
            <AvatarFallback className="bg-gradient-fintech text-primary-foreground text-[10px] font-semibold">
              {user?.name?.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate">{user?.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onLogout} className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" aria-label="Sign out">
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function BottomNav({ items, pathname, className }: { items: PortalNavItem[]; pathname: string; className?: string }) {
  return (
    <nav aria-label="Bottom navigation" className={cn('fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur-xl border-t border-border/80 shadow-[0_-1px_0_0_rgba(212,175,55,0.12)] pb-safe', className)}>
      <div className="grid gap-1 px-2 pt-2" style={{ gridTemplateColumns: `repeat(${items.length || 5}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== '/admin' && item.href !== '/portal' && item.href !== '/agent' && pathname.startsWith(item.href + '/'))
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl text-[10px] font-medium transition-colors min-h-[44px]',
                active ? 'text-primary dark:text-purple-300 font-semibold' : 'text-muted-foreground'
              )}
            >
              <span className={cn('h-5 w-5 flex items-center justify-center', active && 'scale-110 text-amber-500 dark:text-amber-400 transition-transform')}>
                {item.icon}
              </span>
              <span className="truncate max-w-full px-0.5">{item.label}</span>
              {item.badge ? (
                <span className="absolute top-1 right-1/4 h-1.5 w-1.5 rounded-full bg-destructive" />
              ) : null}
              {active && (
                <span
                  className="absolute -top-2 h-1 w-8 rounded-full bg-gradient-gold shadow-gold"
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function UserMenu({ user, initials, onLogout }: { user: any; initials: string; onLogout: () => void }) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const onSettings = () => {
    setOpen(false)
    if (user?.role === 'CANDIDATE') router.push('/portal/profile')
    else if (user?.role === 'AGENT') router.push('/agent/performance')
    else router.push('/admin')
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-label="User menu"
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 p-1 pr-2 min-h-[44px] sm:min-h-0 rounded-xl hover:bg-muted transition-colors"
      >
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
      </button>
      {open && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-border bg-popover shadow-glow overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
          >
            <div className="p-3 border-b border-border">
              <p className="text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              <Badge variant="secondary" className="mt-2 text-[10px]">{user?.role}</Badge>
            </div>
            <div className="p-1">
              <button role="menuitem" onClick={onSettings} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors">
                <Settings className="h-4 w-4" /> Settings
              </button>
              <button
                role="menuitem"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors"
              >
                <span className="flex items-center gap-2">
                  {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-primary" />}
                  Theme
                </span>
                <span className="text-xs text-muted-foreground capitalize">{theme}</span>
              </button>
              <Separator className="my-1" />
              <button role="menuitem" onClick={onLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted text-destructive transition-colors">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </div>
        )}
    </div>
  )
}

function NavDropdown({ group, pathname, onNavigate }: { group: PortalNavGroup; pathname: string; onNavigate: () => void }) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  
  const isActive = group.items.some(item => pathname === item.href || (item.href !== '/portal' && item.href !== '/agent' && pathname.startsWith(item.href + '/')))

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap',
          isActive
            ? 'bg-primary/10 text-primary font-semibold border-b-2 border-amber-400'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
        )}
      >
        {group.label}
        <ChevronDown className="h-3.5 w-3.5 opacity-50" />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full mt-2 w-48 rounded-xl border border-border bg-popover shadow-glow overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150 p-1">
          {group.items.map(item => {
            const itemActive = pathname === item.href || (item.href !== '/portal' && item.href !== '/agent' && pathname.startsWith(item.href + '/'))
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                aria-current={itemActive ? 'page' : undefined}
                onClick={() => { setOpen(false); onNavigate(); }}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                  itemActive ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted text-muted-foreground'
                )}
              >
                <span className="h-4 w-4">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.badge && <Badge variant="secondary" className="text-[10px] h-4 px-1">{item.badge}</Badge>}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
