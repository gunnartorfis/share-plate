import type { User } from '@/lib/db/schema'
import { MobileNav, Sidebar } from './sidebar'
import { Route as RootRoute } from '@/routes/__root'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const context = RootRoute.useRouteContext()
  const user = context.user as User | null

  return (
    <div className="flex min-h-screen">
      {user && <Sidebar user={user} />}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
      <MobileNav />
    </div>
  )
}
