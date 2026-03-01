import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { getMyFamilies, joinFamily } from '@/lib/server/families'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export const Route = createFileRoute('/families/')({ component: FamiliesPage })

type Family = { id: string; name: string; inviteCode: string; role: string }

function FamiliesPage() {
  const [families, setFamilies] = useState<Array<Family>>([])
  const [inviteCode, setInviteCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const fs = await getMyFamilies()
    setFamilies(fs as Array<Family>)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setJoining(true)
    try {
      await joinFamily({ data: { inviteCode } })
      setInviteCode('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join family')
    } finally {
      setJoining(false)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-display font-bold tracking-tight">
            Families
          </h1>
          <Link
            to="/families/new"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Create family
          </Link>
        </div>

        {/* Join family */}
        <div className="bg-card border border-border rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold mb-3">Join a family</h2>
          <form onSubmit={handleJoin} className="flex gap-2">
            <Input
              placeholder="Enter invite code…"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="font-mono uppercase"
              maxLength={6}
            />
            <Button type="submit" disabled={joining || inviteCode.length < 4}>
              {joining ? 'Joining…' : 'Join'}
            </Button>
          </form>
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </div>

        {/* Families list */}
        {families.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg font-display font-medium mb-1">
              No families yet
            </p>
            <p className="text-sm">
              Create a family or join one with an invite code.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {families.map((f) => (
              <Link
                key={f.id}
                to="/families/$familyId"
                params={{ familyId: f.id }}
                className="block bg-card border border-border rounded-lg p-5 hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-150"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display font-semibold">{f.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {f.role === 'admin' ? 'Admin' : 'Member'} · Code:{' '}
                      <span className="font-mono font-medium">
                        {f.inviteCode}
                      </span>
                    </p>
                  </div>
                  <ChevronRightIcon className="w-4 h-4 text-muted-foreground mt-1" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
