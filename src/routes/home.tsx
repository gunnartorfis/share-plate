import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { getMyHome, leaveHome, updateHomeName } from '@/lib/server/homes'
import { getHomeMealPlan, upsertHomeDayPlan } from '@/lib/server/homes'
import { currentWeekStart } from '@/lib/server/meal-plans'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/home')({
  component: HomePage,
})

const DAY_SHORT = [
  'days.mon',
  'days.tue',
  'days.wed',
  'days.thu',
  'days.fri',
  'days.sat',
  'days.sun',
]
const MEALS = ['meals.dinner']

function HomePage() {
  const { t } = useTranslation()
  const router = useRouter()
  const weekStart = currentWeekStart()

  const [home, setHome] = useState<{
    id: string
    name: string
    inviteCode: string
    role: string
    members: Array<{ id: string; name: string; email: string; role: string }>
  } | null>(null)

  type MealPlanDay = {
    id: string
    dayOfWeek: number
    mealName: string | null
    notes: string | null
    recipeUrl: string | null
    constraintIds: Array<string>
  }

  const [mealPlan, setMealPlan] = useState<{
    plan: { id: string; weekStart: string }
    days: Array<MealPlanDay>
    role: string
  } | null>(null)

  const [tab, setTab] = useState<'planner' | 'members'>('planner')
  const [leaving, setLeaving] = useState(false)
  const [editingDay, setEditingDay] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({
    mealName: '',
    notes: '',
    recipeUrl: '',
  })
  const [saving, setSaving] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState('')
  const [copied, setCopied] = useState(false)

  async function load() {
    try {
      const [h, mp] = await Promise.all([
        getMyHome(),
        getHomeMealPlan({ data: { weekStart } }),
      ])
      if (!h) {
        router.navigate({ to: '/planner' })
        return
      }
      setHome(h as typeof home)
      setMealPlan(mp as typeof mealPlan)
    } catch {
      router.navigate({ to: '/planner' })
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSaveDay(dayOfWeek: number) {
    if (!mealPlan) return
    setSaving(true)
    try {
      await upsertHomeDayPlan({
        data: {
          weekStart,
          dayOfWeek,
          mealName: editForm.mealName || undefined,
          notes: editForm.notes || undefined,
          recipeUrl: editForm.recipeUrl || undefined,
        },
      })
      setEditingDay(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  function startEdit(day: MealPlanDay) {
    setEditingDay(day.dayOfWeek)
    setEditForm({
      mealName: day.mealName || '',
      notes: day.notes || '',
      recipeUrl: day.recipeUrl || '',
    })
  }

  async function handleLeave() {
    if (!confirm(t('home.leaveConfirm'))) return
    setLeaving(true)
    await leaveHome()
    router.navigate({ to: '/planner' })
  }

  async function handleUpdateName() {
    if (!newName.trim() || !home) return
    await updateHomeName({ data: { name: newName.trim() } })
    setEditingName(false)
    setHome({ ...home, name: newName.trim() })
  }

  function copyInviteCode() {
    if (!home) return
    navigator.clipboard.writeText(home.inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!home || !mealPlan) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          {t('common.loading')}
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="text-3xl font-display font-bold h-auto py-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUpdateName()
                    if (e.key === 'Escape') setEditingName(false)
                  }}
                />
                <Button size="sm" onClick={handleUpdateName}>
                  {t('common.save')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingName(false)}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            ) : (
              <h1
                className="text-3xl font-display font-bold tracking-tight cursor-pointer hover:text-primary/80 transition-colors"
                onClick={() => {
                  setNewName(home.name)
                  setEditingName(true)
                }}
              >
                {home.name}
              </h1>
            )}
            <p className="text-sm text-muted-foreground mt-0.5">
              {t('home.inviteCode')}{' '}
              <button
                onClick={copyInviteCode}
                className="font-mono font-semibold text-foreground hover:text-primary transition-colors"
              >
                {home.inviteCode}
              </button>
              {copied && (
                <span className="ml-2 text-green-600 text-xs">
                  {t('home.copied')}
                </span>
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLeave}
            disabled={leaving}
          >
            {t('home.leave')}
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {(['planner', 'members'] as const).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={cn(
                'px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px',
                tab === tabKey
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t(`home.${tabKey}`)}
            </button>
          ))}
        </div>

        {/* Planner tab */}
        {tab === 'planner' && (
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <p className="text-sm text-muted-foreground">
                {t('home.weekOf')}{' '}
                {new Date(weekStart + 'T12:00:00').toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                })}
              </p>
            </div>

            {/* Mobile: stacked vertical */}
            <div className="md:hidden divide-y divide-border bg-card border border-border rounded-lg">
              {DAY_SHORT.map((dayName, dayIndex) => {
                const day = mealPlan.days.find((d) => d.dayOfWeek === dayIndex)
                const isEditing = editingDay === dayIndex

                return (
                  <div key={dayIndex} className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {t(dayName)}
                      </p>
                    </div>

                    {isEditing ? (
                      <div className="space-y-2">
                        <Input
                          placeholder={t('home.mealName')}
                          value={editForm.mealName}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              mealName: e.target.value,
                            })
                          }
                          className="h-9 text-sm"
                        />
                        <Input
                          placeholder={t('home.notes')}
                          value={editForm.notes}
                          onChange={(e) =>
                            setEditForm({ ...editForm, notes: e.target.value })
                          }
                          className="h-9 text-sm"
                        />
                        <Input
                          placeholder={t('home.recipeUrl')}
                          value={editForm.recipeUrl}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              recipeUrl: e.target.value,
                            })
                          }
                          className="h-9 text-sm"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveDay(dayIndex)}
                            disabled={saving}
                            className="flex-1"
                          >
                            {saving ? t('home.saving') : t('common.save')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingDay(null)}
                          >
                            {t('common.cancel')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => day && startEdit(day)}
                        className={cn(
                          'p-2 rounded-md cursor-pointer transition-colors',
                          day?.mealName
                            ? 'bg-primary/5 hover:bg-primary/10'
                            : 'bg-muted/30 hover:bg-muted/50 border border-dashed border-border',
                        )}
                      >
                        {day?.mealName ? (
                          <p className="text-sm font-medium">{day.mealName}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            {t('home.tapToAdd')}
                          </p>
                        )}
                        {day?.notes && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {day.notes}
                          </p>
                        )}
                        {day?.recipeUrl && (
                          <a
                            href={day.recipeUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary hover:underline mt-1 block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            ↗ {t('common.recipe')}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Desktop: horizontal grid */}
            <div className="hidden md:grid md:grid-cols-7 divide-x divide-border bg-card border border-border rounded-lg overflow-hidden">
              {DAY_SHORT.map((dayName, dayIndex) => {
                const day = mealPlan.days.find((d) => d.dayOfWeek === dayIndex)
                const isEditing = editingDay === dayIndex

                return (
                  <div key={dayIndex} className="min-h-[180px]">
                    <div className="px-3 py-2 bg-muted/30 border-b border-border">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
                        {t(dayName)}
                      </p>
                    </div>

                    <div className="p-2">
                      {isEditing ? (
                        <div className="space-y-2">
                          <Input
                            placeholder={t('home.mealName')}
                            value={editForm.mealName}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                mealName: e.target.value,
                              })
                            }
                            className="h-8 text-sm"
                          />
                          <Input
                            placeholder={t('home.notes')}
                            value={editForm.notes}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                notes: e.target.value,
                              })
                            }
                            className="h-8 text-sm"
                          />
                          <Input
                            placeholder={t('home.recipeUrl')}
                            value={editForm.recipeUrl}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                recipeUrl: e.target.value,
                              })
                            }
                            className="h-8 text-sm"
                          />
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              onClick={() => handleSaveDay(dayIndex)}
                              disabled={saving}
                              className="flex-1"
                            >
                              {saving ? t('home.saving') : t('common.save')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingDay(null)}
                            >
                              {t('common.cancel')}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {MEALS.map((mealType) => {
                            return (
                              <div
                                key={mealType}
                                onClick={() => day && startEdit(day)}
                                className={cn(
                                  'p-2 rounded-md cursor-pointer transition-colors',
                                  day?.mealName
                                    ? 'bg-primary/5 hover:bg-primary/10'
                                    : 'bg-muted/30 hover:bg-muted/50 border border-dashed border-border',
                                )}
                              >
                                <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">
                                  {t(mealType)}
                                </p>
                                {day?.mealName ? (
                                  <p className="text-sm font-medium leading-tight">
                                    {day.mealName}
                                  </p>
                                ) : (
                                  <p className="text-xs text-muted-foreground italic">
                                    {t('home.clickToAdd')}
                                  </p>
                                )}
                                {day?.notes && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {day.notes}
                                  </p>
                                )}
                                {day?.recipeUrl && (
                                  <a
                                    href={day.recipeUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[10px] text-primary hover:underline mt-1 block"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    ↗ {t('common.recipe')}
                                  </a>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Members indicator */}
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {t('home.membersLabel')}
              </span>
              {home.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-1.5 bg-secondary/50 px-2 py-1 rounded-full"
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ backgroundColor: stringToColor(member.id) }}
                  >
                    {member.name[0].toUpperCase()}
                  </div>
                  <span className="text-xs font-medium">{member.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Members tab */}
        {tab === 'members' && (
          <div className="space-y-2">
            {home.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ backgroundColor: stringToColor(member.id) }}
                >
                  {member.name[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-sm">{member.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {member.email}
                  </p>
                </div>
                <span className="ml-auto text-xs text-muted-foreground capitalize">
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  const colors = [
    '#4a7c59',
    '#c17d4a',
    '#7c4a6e',
    '#4a6e7c',
    '#7c7c4a',
    '#4a4a7c',
  ]
  return colors[Math.abs(hash) % colors.length]
}
