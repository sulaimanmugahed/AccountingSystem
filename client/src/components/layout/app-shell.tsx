import * as React from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Check,
  ChevronsLeft,
  ChevronsRight,
  Command,
  Languages,
  LogOut,
  Menu,
  Moon,
  Sun,
  UserCircle2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { companyApi } from '@/lib/api/endpoints'
import { queryKeys } from '@/lib/api/keys'
import { initials } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { navGroups } from '@/app/nav'
import { LANGUAGES } from '@/lib/i18n'

function useCompany() {
  return useQuery({
    queryKey: queryKeys.company,
    queryFn: companyApi.current,
    staleTime: 10 * 60_000,
    retry: false,
  })
}

function SidebarContent({ onNavigate, collapsed }: { onNavigate?: () => void; collapsed?: boolean }) {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const { data: company } = useCompany()

  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-16 items-center gap-3 border-b border-sidebar-border px-4', collapsed && 'justify-center px-2')}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
          <Command className="h-5 w-5" />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{t('app.name')}</p>
            <p className="truncate text-xs text-sidebar-foreground/60">{company?.name ?? t('app.product')}</p>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 scrollbar-thin">
        {navGroups.map((group) => {
          const items = group.items.filter((item) => hasRole(...(item.roles ?? [])))
          if (!items.length) return null
          return (
            <div key={group.titleKey} className="space-y-1">
              {!collapsed ? (
                <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  {t(group.titleKey)}
                </p>
              ) : null}
              {items.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.href === '/'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-white',
                      isActive && 'bg-sidebar-accent text-white',
                      collapsed && 'justify-center px-2',
                    )
                  }
                  title={collapsed ? t(item.titleKey) : undefined}
                >
                  {item.icon ? <item.icon className="h-4 w-4 shrink-0" /> : null}
                  {!collapsed ? <span className="truncate">{t(item.titleKey)}</span> : null}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>

      <div className={cn('border-t border-sidebar-border p-3', collapsed && 'px-2')}>
        <div className={cn('rounded-lg bg-white/5 p-3 text-xs text-sidebar-foreground/70', collapsed && 'hidden')}>
          <p className="font-medium text-sidebar-foreground">{t('shell.doubleEntryTitle')}</p>
          <p className="mt-1 leading-relaxed">{t('shell.doubleEntryBody')}</p>
        </div>
      </div>
    </div>
  )
}

function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const active = (i18n.resolvedLanguage ?? i18n.language ?? 'en').split('-')[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" title={t('language.switchTo')}>
          <Languages className="h-4.5 w-4.5" />
          <span className="sr-only">{t('language.switchTo')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="font-normal">{t('language.label')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LANGUAGES.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => void i18n.changeLanguage(language.code)}
            className="justify-between"
          >
            <span>{language.label}</span>
            {active === language.code ? <Check className="h-4 w-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppShell() {
  const { t } = useTranslation()
  const { session, logout } = useAuth()
  const { resolvedTheme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [collapsed, setCollapsed] = React.useState(() => localStorage.getItem('ledgerly.sidebar') === 'collapsed')
  const { data: company } = useCompany()

  React.useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  React.useEffect(() => {
    localStorage.setItem('ledgerly.sidebar', collapsed ? 'collapsed' : 'expanded')
  }, [collapsed])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-30 hidden shrink-0 border-e border-sidebar-border bg-sidebar transition-[width] duration-200 lg:block',
          collapsed ? 'w-[68px]' : 'w-64',
        )}
      >
        <SidebarContent collapsed={collapsed} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-72 bg-sidebar shadow-xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute end-3 top-4 rounded-md p-1 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col transition-[padding] duration-200',
          collapsed ? 'lg:ps-[68px]' : 'lg:ps-64',
        )}
      >
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
            <span className="sr-only">{t('shell.openNavigation')}</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
            <span className="sr-only">{t('shell.toggleSidebar')}</span>
          </Button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{company?.name ?? t('app.product')}</p>
            <p className="truncate text-xs text-muted-foreground">
              {t('app.baseCurrency', { code: company?.baseCurrencyCode ?? 'USD' })}
              {company?.fiscalYearStartMonth
                ? ` · ${t('app.fiscalYearStart', { month: company.fiscalYearStartMonth })}`
                : ''}
            </p>
          </div>

          <LanguageSwitcher />

          <Button variant="ghost" size="icon" onClick={toggleTheme} title={t('shell.toggleTheme')}>
            {resolvedTheme === 'dark' ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
            <span className="sr-only">{t('shell.toggleTheme')}</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {initials(session?.fullName ?? session?.email)}
                </span>
                <span className="hidden text-start sm:block">
                  <span className="block max-w-[160px] truncate text-sm font-medium">{session?.fullName}</span>
                  <span className="block text-xs text-muted-foreground">{session?.roles.join(', ')}</span>
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{session?.fullName}</p>
                  <p className="text-xs text-muted-foreground">{session?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings/company">
                  <UserCircle2 /> {t('shell.companyProfile')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut /> {t('shell.signOut')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 space-y-6 p-4 sm:p-6">
          <Outlet />
        </main>

        <footer className="border-t px-6 py-4 text-xs text-muted-foreground">{t('app.footer')}</footer>
      </div>
    </div>
  )
}
