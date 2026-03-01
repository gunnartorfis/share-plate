import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppLayout } from '@/components/layout/app-layout'
import {
  deleteConstraint,
  getDayTemplates,
  getMyConstraints,
  saveConstraint,
  saveDayTemplate,
} from '@/lib/server/constraints'
import { changePassword, logout, updateProfile } from '@/lib/server/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/settings')({ component: SettingsPage })

const DAY_KEYS = [
  'days.monday',
  'days.tuesday',
  'days.wednesday',
  'days.thursday',
  'days.friday',
  'days.saturday',
  'days.sunday',
]

const PRESET_COLORS = [
  '#e74c3c',
  '#e67e22',
  '#f1c40f',
  '#2ecc71',
  '#1abc9c',
  '#3498db',
  '#9b59b6',
  '#e91e63',
  '#607d8b',
  '#795548',
]

type Constraint = {
  id: string
  name: string
  color: string
  emoji: string | null
}

function SettingsPage() {
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const [tab, setTab] = useState<
    'constraints' | 'profile' | 'password' | 'language'
  >('language')
  const [constraints, setConstraints] = useState<Array<Constraint>>([])
  const [templates, setTemplates] = useState<
    Array<{ dayOfWeek: number; constraintIds: Array<string> }>
  >([])

  // Constraint form
  const [editingConstraint, setEditingConstraint] = useState<Constraint | null>(
    null,
  )
  const [cName, setCName] = useState('')
  const [cColor, setCColor] = useState(PRESET_COLORS[0])
  const [cEmoji, setCEmoji] = useState('')
  const [cSaving, setCsaving] = useState(false)

  // Profile
  const [pName, setPName] = useState('')
  const [pEmail, setPEmail] = useState('')
  const [pSaving, setPsaving] = useState(false)
  const [pError, setPError] = useState('')

  // Password
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  async function loadConstraints() {
    const [cs, ts] = await Promise.all([getMyConstraints(), getDayTemplates()])
    setConstraints(cs)
    setTemplates(
      ts.map((t) => ({
        dayOfWeek: t.dayOfWeek,
        constraintIds: JSON.parse(t.constraintIds) as Array<string>,
      })),
    )
  }

  useEffect(() => {
    loadConstraints()
  }, [])

  function openNewConstraint() {
    setEditingConstraint(null)
    setCName('')
    setCColor(PRESET_COLORS[0])
    setCEmoji('')
  }

  function openEditConstraint(c: Constraint) {
    setEditingConstraint(c)
    setCName(c.name)
    setCColor(c.color)
    setCEmoji(c.emoji ?? '')
  }

  async function handleSaveConstraint(e: React.FormEvent) {
    e.preventDefault()
    setCsaving(true)
    try {
      await saveConstraint({
        data: {
          id: editingConstraint?.id,
          name: cName,
          color: cColor,
          emoji: cEmoji || undefined,
        },
      })
      setEditingConstraint(null)
      setCName('')
      setCEmoji('')
      await loadConstraints()
    } finally {
      setCsaving(false)
    }
  }

  async function handleDeleteConstraint(id: string) {
    if (!confirm(t('common.deleteConfirm'))) return
    await deleteConstraint({ data: { id } })
    await loadConstraints()
  }

  async function toggleDayConstraint(dayOfWeek: number, constraintId: string) {
    const template = templates.find((t) => t.dayOfWeek === dayOfWeek)
    const current = template?.constraintIds ?? []
    const next = current.includes(constraintId)
      ? current.filter((id) => id !== constraintId)
      : [...current, constraintId]
    await saveDayTemplate({ data: { dayOfWeek, constraintIds: next } })
    await loadConstraints()
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault()
    setPError('')
    setPsaving(true)
    try {
      await updateProfile({ data: { name: pName, email: pEmail } })
      await router.invalidate()
    } catch (err) {
      setPError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setPsaving(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)
    setPwSaving(true)
    try {
      await changePassword({
        data: { currentPassword: pwCurrent, newPassword: pwNew },
      })
      setPwCurrent('')
      setPwNew('')
      setPwSuccess(true)
    } catch (err) {
      setPwError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setPwSaving(false)
    }
  }

  async function handleLogout() {
    await logout()
    await router.invalidate()
    router.navigate({ to: '/login' })
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-display font-bold tracking-tight mb-8">
          {t('settings.title')}
        </h1>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {(['constraints', 'profile', 'password', 'language'] as const).map(
            (key) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px',
                  tab === key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {t(`settings.${key}`)}
              </button>
            ),
          )}
        </div>

        {/* Constraints tab */}
        {tab === 'constraints' && (
          <div className="space-y-8">
            {/* Constraint builder */}
            <div>
              <h2 className="text-base font-display font-semibold mb-4">
                {t('settings.myConstraints')}
              </h2>

              {/* Existing constraints */}
              {constraints.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {constraints.map((c) => (
                    <div
                      key={c.id}
                      className="group flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium cursor-pointer"
                      style={{
                        backgroundColor: c.color + '18',
                        color: c.color,
                        borderColor: c.color + '55',
                      }}
                      onClick={() => openEditConstraint(c)}
                    >
                      {c.emoji && <span>{c.emoji}</span>}
                      {c.name}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteConstraint(c.id)
                        }}
                        className="ml-1 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* New/edit constraint form */}
              <div className="bg-card border border-border rounded-lg p-5">
                <h3 className="text-sm font-semibold mb-4">
                  {editingConstraint
                    ? `${t('settings.editConstraint')} "${editingConstraint.name}"`
                    : t('settings.newConstraint')}
                </h3>
                <form onSubmit={handleSaveConstraint} className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor="cname">
                        {t('settings.constraintName')}
                      </Label>
                      <Input
                        id="cname"
                        value={cName}
                        onChange={(e) => setCName(e.target.value)}
                        placeholder="e.g. simple, fish, vegan"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cemoji">
                        {t('settings.constraintEmoji')}
                      </Label>
                      <Input
                        id="cemoji"
                        value={cEmoji}
                        onChange={(e) => setCEmoji(e.target.value)}
                        placeholder="🐟"
                        className="w-20"
                        maxLength={2}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      {t('settings.constraintColor')}
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setCColor(color)}
                          className={cn(
                            'w-7 h-7 rounded-full border-2 transition-transform',
                            cColor === color
                              ? 'border-foreground scale-110'
                              : 'border-transparent',
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Preview */}
                  {cName && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        {t('settings.preview')}
                      </label>
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-sm font-medium border"
                        style={{
                          backgroundColor: cColor + '22',
                          color: cColor,
                          borderColor: cColor + '55',
                        }}
                      >
                        {cEmoji && <span>{cEmoji}</span>}
                        {cName}
                      </span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {editingConstraint && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={openNewConstraint}
                      >
                        {t('common.create')}
                      </Button>
                    )}
                    <Button type="submit" disabled={cSaving}>
                      {cSaving
                        ? t('common.saving')
                        : editingConstraint
                          ? t('common.update')
                          : t('common.add')}
                    </Button>
                  </div>
                </form>
              </div>
            </div>

            {/* Day templates */}
            {constraints.length > 0 && (
              <div>
                <h2 className="text-base font-display font-semibold mb-1">
                  {t('settings.dayDefaults')}
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('settings.dayDefaultsDesc')}
                </p>
                <div className="space-y-3">
                  {DAY_KEYS.map((dayKey, i) => {
                    const template = templates.find(
                      (templateItem) => templateItem.dayOfWeek === i,
                    )
                    const activeIds = template?.constraintIds ?? []
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-4 bg-card border border-border rounded-lg px-4 py-3"
                      >
                        <span className="text-sm font-medium w-24 shrink-0">
                          {t(dayKey)}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {constraints.map((c) => {
                            const active = activeIds.includes(c.id)
                            return (
                              <button
                                key={c.id}
                                onClick={() => toggleDayConstraint(i, c.id)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border transition-all"
                                style={
                                  active
                                    ? {
                                        backgroundColor: c.color + '22',
                                        color: c.color,
                                        borderColor: c.color + '55',
                                      }
                                    : {}
                                }
                              >
                                {c.emoji && <span>{c.emoji}</span>}
                                {c.name}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Profile tab */}
        {tab === 'profile' && (
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pname">{t('common.name')}</Label>
                <Input
                  id="pname"
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pemail">{t('common.email')}</Label>
                <Input
                  id="pemail"
                  type="email"
                  value={pEmail}
                  onChange={(e) => setPEmail(e.target.value)}
                  required
                />
              </div>
              {pError && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  {pError}
                </p>
              )}
              <Button type="submit" disabled={pSaving}>
                {pSaving ? t('common.saving') : t('settings.updateProfile')}
              </Button>
            </form>

            <div className="pt-4 border-t border-border">
              <Button
                variant="outline"
                onClick={handleLogout}
                className="text-destructive hover:text-destructive"
              >
                {t('auth.signOut')}
              </Button>
            </div>
          </div>
        )}

        {/* Password tab */}
        {tab === 'password' && (
          <div className="bg-card border border-border rounded-lg p-6">
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pwcurrent">{t('auth.currentPassword')}</Label>
                <Input
                  id="pwcurrent"
                  type="password"
                  value={pwCurrent}
                  onChange={(e) => setPwCurrent(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pwnew">{t('auth.newPassword')}</Label>
                <Input
                  id="pwnew"
                  type="password"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              {pwError && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  {pwError}
                </p>
              )}
              {pwSuccess && (
                <p className="text-sm text-primary bg-primary/10 px-3 py-2 rounded-md">
                  {t('settings.passwordChanged')}
                </p>
              )}
              <Button type="submit" disabled={pwSaving}>
                {pwSaving ? t('common.changing') : t('settings.changePassword')}
              </Button>
            </form>
          </div>
        )}

        {/* Language tab */}
        {tab === 'language' && (
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-base font-display font-semibold mb-4">
              {t('settings.title')}
            </h2>
            <div className="space-y-3">
              <Label htmlFor="language">{t('settings.selectLanguage')}</Label>
              <Select
                value={i18n.language ?? 'is'}
                onValueChange={(value) => value && i18n.changeLanguage(value)}
              >
                <SelectTrigger id="language" className="w-48">
                  <SelectValue placeholder={t('settings.selectLanguage')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="is">Íslenska</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
