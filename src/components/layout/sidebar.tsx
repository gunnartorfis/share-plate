import { Link, useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/planner', labelKey: 'nav.planner', icon: CalendarIcon },
  { to: '/families', labelKey: 'nav.families', icon: FamilyIcon },
  { to: '/groups', labelKey: 'nav.groups', icon: UsersIcon },
  { to: '/links', labelKey: 'nav.links', icon: LinkIcon },
  { to: '/settings', labelKey: 'nav.settings', icon: SettingsIcon },
]

export function Sidebar() {
  const { t } = useTranslation()
  const { location } = useRouterState()

  return (
    <aside className="hidden md:flex w-[220px] min-h-screen bg-sidebar text-sidebar-foreground flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 pt-7 pb-6">
        <span
          className="text-2xl font-display font-bold tracking-tight"
          style={{ fontVariationSettings: '"opsz" 144' }}
        >
          {t('home.title')}
        </span>
        <p className="text-sidebar-foreground/50 text-xs mt-0.5">
          {t('home.subtitle')}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        {NAV.map(({ to, labelKey, icon: Icon }) => {
          const active = location.pathname.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50',
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {t(labelKey)}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <p className="text-xs text-sidebar-foreground/40 px-3">
          © {t('home.title')}
        </p>
      </div>
    </aside>
  )
}

export function MobileNav() {
  const { t } = useTranslation()
  const { location } = useRouterState()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-sidebar border-t border-sidebar-border safe-area-bottom">
      <div className="flex items-stretch h-16">
        {NAV.map(({ to, labelKey, icon: Icon }) => {
          const active = location.pathname.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 transition-colors',
                active
                  ? 'text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/50 hover:text-sidebar-foreground/80',
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{t(labelKey)}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

// Minimal inline SVG icons
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
    </svg>
  )
}
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
    >
      <circle cx="9" cy="7" r="4" />
      <path
        d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"
        strokeLinecap="round"
      />
      <path
        d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.87"
        strokeLinecap="round"
      />
    </svg>
  )
}
function FamilyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
    >
      <path
        d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
        strokeLinecap="round"
      />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeLinecap="round" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
    </svg>
  )
}
function LinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
    >
      <path
        d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
        strokeLinecap="round"
      />
      <path
        d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
        strokeLinecap="round"
      />
    </svg>
  )
}
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
