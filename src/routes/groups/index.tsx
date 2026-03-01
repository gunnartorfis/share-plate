import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { getMyGroups, joinGroup } from '@/lib/server/groups'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/groups/')({ component: GroupsPage })

type Group = { id: string; name: string; inviteCode: string; role: string }

function GroupsPage() {
  const { t } = useTranslation()
  const [groups, setGroups] = useState<Array<Group>>([])
  const [inviteCode, setInviteCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const gs = await getMyGroups()
    setGroups(gs as Array<Group>)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setJoining(true)
    try {
      await joinGroup({ data: { inviteCode } })
      setInviteCode('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join group')
    } finally {
      setJoining(false)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-display font-bold tracking-tight">
            {t('groups.title')}
          </h1>
          <Link
            to="/groups/new"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {t('groups.create')}
          </Link>
        </div>

        {/* Join group */}
        <div className="bg-card border border-border rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold mb-3">
            {t('groups.joinTitle')}
          </h2>
          <form onSubmit={handleJoin} className="flex gap-2">
            <Input
              placeholder={t('groups.enterCode')}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="font-mono uppercase"
              maxLength={6}
            />
            <Button type="submit" disabled={joining || inviteCode.length < 4}>
              {joining ? t('groups.joining') : t('groups.join')}
            </Button>
          </form>
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </div>

        {/* Groups list */}
        {groups.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg font-display font-medium mb-1">
              {t('groups.noGroups')}
            </p>
            <p className="text-sm">{t('groups.noGroupsDesc')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <Link
                key={g.id}
                to="/groups/$groupId"
                params={{ groupId: g.id }}
                className="block bg-card border border-border rounded-lg p-5 hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-150"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display font-semibold">{g.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {g.role === 'admin'
                        ? t('groups.admin')
                        : t('groups.member')}{' '}
                      · {t('groups.code')}{' '}
                      <span className="font-mono font-medium">
                        {g.inviteCode}
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
