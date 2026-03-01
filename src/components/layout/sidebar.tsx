import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import type { User } from '@/lib/db/schema'
import { cn } from '@/lib/utils'
import { logout } from '@/lib/server/auth'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowDown01Icon,
  LogoutIcon,
  SettingsIcon as SettingsIconOutline,
  LanguageCircleIcon,
} from '@hugeicons/core-free-icons'

const NAV = [
  { to: '/planner', labelKey: 'nav.planner', icon: CalendarIcon },
  { to: '/families', labelKey: 'nav.families', icon: FamilyIcon },
  { to: '/groups', labelKey: 'nav.groups', icon: UsersIcon },
  { to: '/recipes', labelKey: 'nav.recipes', icon: RecipeIcon },
  { to: '/constraints', labelKey: 'nav.constraints', icon: ConstraintsIcon },
]

export function Sidebar({ user }: { user: User }) {
  const { t, i18n } = useTranslation()
  const { location } = useRouterState()
  const router = useRouter()

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const handleLogout = async () => {
    await logout()
    router.navigate({ to: '/' })
  }

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng)
  }

  return (
    <aside className="hidden md:flex w-[220px] min-h-screen bg-sidebar text-sidebar-foreground flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 pt-7 pb-4">
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

      {/* Footer - User */}
      <div className="p-3 border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="flex items-center gap-3 px-3 py-2 rounded-md w-full text-left hover:bg-sidebar-accent/50 transition-colors">
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={user.avatarUrl ?? undefined}
                    alt={user.name}
                  />
                  <AvatarFallback className="text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.name}</p>
                  <p className="text-xs text-sidebar-foreground/50 truncate">
                    {user.email}
                  </p>
                </div>
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  className="w-4 h-4 text-sidebar-foreground/50"
                />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t('auth.account')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Link
                  to="/settings"
                  className="flex items-center cursor-pointer"
                >
                  <HugeiconsIcon
                    icon={SettingsIconOutline}
                    className="mr-2 w-4 h-4"
                  />
                  {t('nav.settings')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <HugeiconsIcon
                    icon={LanguageCircleIcon}
                    className="mr-2 w-4 h-4"
                  />
                  {t('common.language')}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onClick={() => changeLanguage('en')}
                    className={cn(
                      i18n.language === 'en' && 'bg-sidebar-accent',
                    )}
                  >
                    English
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => changeLanguage('is')}
                    className={cn(
                      i18n.language === 'is' && 'bg-sidebar-accent',
                    )}
                  >
                    Íslenska
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-red-500 cursor-pointer"
              >
                <HugeiconsIcon icon={LogoutIcon} className="mr-2 w-4 h-4" />
                {t('auth.logout')}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
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
function RecipeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
    >
      <path
        d="M12 2L2 7l10 5 10-5-10-5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M2 17l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ConstraintsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
    >
      <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"
        strokeLinecap="round"
      />
    </svg>
  )
}
