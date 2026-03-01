import { MobileNav, Sidebar } from './sidebar'

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
      <MobileNav />
    </div>
  )
}
