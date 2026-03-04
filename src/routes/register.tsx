import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { markHomeSetupCompleted, register } from '@/lib/server/auth'
import { createHome, joinHome } from '@/lib/server/homes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/register')({ component: RegisterPage })

type Step = 'register' | 'setup-home'

function RegisterPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>('register')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [homeName, setHomeName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register({ data: { name, email, password } })
      await router.invalidate()
      setStep('setup-home')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateHome(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await createHome({ data: { name: homeName } })
      await markHomeSetupCompleted()
      await router.invalidate()
      router.navigate({ to: '/' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create home')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoinHome(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await joinHome({ data: { inviteCode } })
      await markHomeSetupCompleted()
      await router.invalidate()
      router.navigate({ to: '/' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join home')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'setup-home') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-display font-bold text-foreground tracking-tight mb-1">
              {t('home.title')}
            </h1>
            <p className="text-muted-foreground text-sm">Set up your home</p>
          </div>

          <div className="space-y-4">
            <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
              <h2 className="text-lg font-display font-semibold mb-2">
                Create your home
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Start a new home and invite others to join.
              </p>
              <form onSubmit={handleCreateHome} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="homeName">Home name</Label>
                  <Input
                    id="homeName"
                    type="text"
                    placeholder="e.g. The Smiths"
                    value={homeName}
                    onChange={(e) => setHomeName(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !homeName.trim()}
                >
                  {loading ? 'Creating…' : 'Create home'}
                </Button>
              </form>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  or
                </span>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
              <h2 className="text-lg font-display font-semibold mb-2">
                Join a home
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Enter an invite code to join an existing home.
              </p>
              <form onSubmit={handleJoinHome} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="inviteCode">Invite code</Label>
                  <Input
                    id="inviteCode"
                    type="text"
                    placeholder="ABC123"
                    value={inviteCode}
                    onChange={(e) =>
                      setInviteCode(e.target.value.toUpperCase())
                    }
                    className="font-mono uppercase"
                    maxLength={6}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || inviteCode.length < 6}
                >
                  {loading ? 'Joining…' : 'Join home'}
                </Button>
              </form>
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-display font-bold text-foreground tracking-tight mb-1">
            {t('home.title')}
          </h1>
          <p className="text-muted-foreground text-sm">{t('home.subtitle')}</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-8 shadow-sm">
          <h2 className="text-lg font-display font-semibold mb-6">
            {t('auth.register')}
          </h2>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">{t('common.name')}</Label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
              <p className="text-xs text-muted-foreground">
                {t('auth.minLength')}
              </p>
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? `${t('auth.register')}...` : t('auth.register')}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {t('auth.hasAccount')}{' '}
            <Link
              to="/login"
              className="text-primary font-medium hover:underline"
            >
              {t('auth.login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
