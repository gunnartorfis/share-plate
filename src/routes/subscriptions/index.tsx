import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppLayout } from '@/components/layout/app-layout'
import {
  getMySubscriptions,
  subscribeToFamily,
  subscribeToFamilyByCode,
  unsubscribeFromFamily,
} from '@/lib/server/subscriptions'
import { getDiscoverableFamilies, getMyFamilies } from '@/lib/server/families'
import { cn } from '@/lib/utils'
import { CheckIcon, HeartIcon, HomeIcon, PlusIcon } from '@/components/ui/icons'

interface Family {
  id: string
  name: string
  inviteCode?: string
}

export const Route = createFileRoute('/subscriptions/')({
  component: SubscriptionsPage,
  loader: async () => {
    const subscriptions = await getMySubscriptions()
    const discoverable = await getDiscoverableFamilies()
    const myFamilies = await getMyFamilies()
    return { subscriptions, discoverable, myFamilies }
  },
})

function SubscriptionsPage() {
  const { t } = useTranslation()
  const data = Route.useLoaderData()
  const [subscriptions, setSubscriptions] = useState<Array<Family>>(
    data.subscriptions,
  )
  const [discoverable, setDiscoverable] = useState<Array<Family>>(
    data.discoverable,
  )
  const [myFamilies] = useState<Array<Family>>(
    data.myFamilies.map((f: Family & { role: string }) => ({
      id: f.id,
      name: f.name,
      inviteCode: f.inviteCode,
    })),
  )
  const [subscribing, setSubscribing] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const handleSubscribe = async (familyId: string) => {
    setSubscribing(familyId)
    try {
      await subscribeToFamily({ data: { familyId } })
      const family = discoverable.find((f) => f.id === familyId)
      if (family) {
        setSubscriptions([...subscriptions, family])
        setDiscoverable(discoverable.filter((f) => f.id !== familyId))
      }
    } catch (err) {
      console.error('Failed to subscribe:', err)
    } finally {
      setSubscribing(null)
    }
  }

  const handleUnsubscribe = async (familyId: string) => {
    setSubscribing(familyId)
    try {
      await unsubscribeFromFamily({ data: { familyId } })
      const family = subscriptions.find((f) => f.id === familyId)
      if (family) {
        setSubscriptions(subscriptions.filter((f) => f.id !== familyId))
        setDiscoverable([...discoverable, family])
      }
    } catch (err) {
      console.error('Failed to unsubscribe:', err)
    } finally {
      setSubscribing(null)
    }
  }

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinCode.trim()) return

    setJoining(true)
    setJoinError(null)
    try {
      const result = await subscribeToFamilyByCode({
        data: { inviteCode: joinCode.trim() },
      })
      setSubscriptions([...subscriptions, result])
      setJoinCode('')
    } catch (err) {
      setJoinError(t('common.joinFailed'))
    } finally {
      setJoining(false)
    }
  }

  const copyToClipboard = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const myHome = myFamilies[0]

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto px-6 py-10">
        <header className="mb-10">
          <h1 className="text-4xl font-display font-bold tracking-tight text-foreground">
            {t('subscriptions.title')}
          </h1>
          <p className="mt-2 text-muted-foreground text-lg leading-relaxed">
            {subscriptions.length === 0
              ? t('subscriptions.noSubscriptions')
              : t('subscriptions.homesCount', { count: subscriptions.length })}
          </p>
        </header>

        {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
        {myHome ? (
          <section className="mb-12">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              {t('subscriptions.myHome')}
            </h2>
            <div className="relative bg-gradient-to-br from-primary/5 via-primary/10 to-accent/5 border border-primary/15 rounded-2xl p-6 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/8 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-accent/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

              <div className="relative flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shrink-0">
                  <HomeIcon className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-display font-semibold text-foreground truncate">
                    {myHome.name}
                  </h3>
                  {myHome.inviteCode && (
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-sm text-muted-foreground">
                        {t('subscriptions.code')}:
                      </span>
                      <code className="bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-lg text-sm font-mono font-medium border border-border/50">
                        {myHome.inviteCode}
                      </code>
                      <button
                        onClick={() =>
                          copyToClipboard(myHome.inviteCode!, myHome.id)
                        }
                        className={cn(
                          'text-xs font-medium px-2 py-1 rounded-md transition-all duration-200',
                          copied === myHome.id
                            ? 'bg-primary/15 text-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                        )}
                      >
                        {copied === myHome.id ? (
                          <span className="flex items-center gap-1">
                            <CheckIcon className="w-3 h-3" />
                            {t('home.copied')}
                          </span>
                        ) : (
                          t('common.share')
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="mb-12">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            {t('subscriptions.following')}
          </h2>

          {subscriptions.length === 0 ? (
            <div className="space-y-6">
              <div className="text-center py-8 px-6 rounded-2xl bg-muted/30 border border-dashed border-muted-foreground/20">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                  <HeartIcon className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-display font-semibold text-foreground mb-2">
                  {t('subscriptions.notFollowingTitle')}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
                  {t('subscriptions.notFollowingDesc')}
                </p>
              </div>

              <form onSubmit={handleJoinByCode} className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder={t('subscriptions.enterCode')}
                  className="flex-1 h-12 px-4 rounded-xl border bg-background/50 text-sm uppercase tracking-widest font-mono placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  maxLength={6}
                />
                <button
                  type="submit"
                  disabled={joining || joinCode.length < 6}
                  className="h-12 px-5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                >
                  {joining ? (
                    <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    <>
                      <PlusIcon className="w-4 h-4" />
                      {t('subscriptions.join')}
                    </>
                  )}
                </button>
              </form>
              {joinError && (
                <p className="text-sm text-destructive px-2">{joinError}</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {subscriptions.map((family) => (
                <div
                  key={family.id}
                  className="group flex items-center justify-between bg-card border rounded-xl p-4 hover:border-primary/30 hover:shadow-sm hover:shadow-primary/5 transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                      <HeartIcon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <span className="font-medium text-foreground">
                      {family.name}
                    </span>
                  </div>
                  <button
                    onClick={() => handleUnsubscribe(family.id)}
                    disabled={subscribing === family.id}
                    className="text-sm text-muted-foreground hover:text-destructive px-3 py-1.5 rounded-lg hover:bg-destructive/5 transition-colors disabled:opacity-50"
                  >
                    {subscribing === family.id
                      ? '...'
                      : t('subscriptions.unfollow')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {discoverable.length > 0 && subscriptions.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              {t('subscriptions.discover')}
            </h2>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">
                {t('subscriptions.nearby')}
              </p>
              {discoverable.map((family) => (
                <div
                  key={family.id}
                  className="flex items-center justify-between bg-card border rounded-xl p-4 hover:border-accent/30 hover:bg-accent/5 transition-all duration-200"
                >
                  <span className="font-medium text-foreground">
                    {family.name}
                  </span>
                  <button
                    onClick={() => handleSubscribe(family.id)}
                    disabled={subscribing === family.id}
                    className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {subscribing === family.id ? (
                      <span className="w-4 h-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
                    ) : (
                      <>
                        <PlusIcon className="w-4 h-4" />
                        {t('subscriptions.follow')}
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  )
}
