import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { createGroup } from '@/lib/server/groups'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/groups/new')({ component: NewGroupPage })

function NewGroupPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [name, setName] = useState('')
  const [result, setResult] = useState<{
    id: string
    inviteCode: string
  } | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await createGroup({ data: { name } })
      setResult(res)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-6 py-8">
        <h1 className="text-3xl font-display font-bold tracking-tight mb-8">
          {t('groups.create')}
        </h1>

        {result ? (
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckIcon className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-lg font-display font-semibold mb-1">
              {t('groups.created')}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {t('groups.shareCode')}
            </p>
            <div className="bg-background border border-border rounded-lg px-6 py-4 mb-6">
              <p className="text-3xl font-mono font-bold tracking-[0.2em] text-primary">
                {result.inviteCode}
              </p>
            </div>
            <Button
              onClick={() =>
                router.navigate({
                  to: '/groups/$groupId',
                  params: { groupId: result.id },
                })
              }
            >
              {t('groups.goToGroup')}
            </Button>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">{t('groups.name')}</Label>
                <Input
                  id="name"
                  placeholder={t('groups.namePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t('common.saving') : t('groups.create')}
              </Button>
            </form>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
