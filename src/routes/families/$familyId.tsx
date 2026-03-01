import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { getFamily, leaveFamily, getMyFamilies } from '@/lib/server/families'
import { currentWeekStart } from '@/lib/server/meal-plans'
import {
  getFamilyMealPlan,
  shareFamilyMealPlan,
  unshareFamilyMealPlan,
  getSharedFamilyMealPlans,
  upsertFamilyDayPlan,
} from '@/lib/server/family-meal-plans'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/families/$familyId')({
  component: FamilyPage,
})

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MEALS = ['Dinner']

function FamilyPage() {
  const { familyId } = Route.useParams()
  const router = useRouter()
  const weekStart = currentWeekStart()

  const [family, setFamily] = useState<{
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
    sharedWithFamilyIds: string[]
    role: string
  } | null>(null)
  const [sharedPlans, setSharedPlans] = useState<
    Array<{
      family: { id: string; name: string }
      days: Array<{
        dayOfWeek: number
        mealName: string | null
      }>
    }>
  >([])
  const [allFamilies, setAllFamilies] = useState<
    Array<{ id: string; name: string }>
  >([])
  const [tab, setTab] = useState<'planner' | 'members'>('planner')
  const [leaving, setLeaving] = useState(false)
  const [editingDay, setEditingDay] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({
    mealName: '',
    notes: '',
    recipeUrl: '',
  })
  const [saving, setSaving] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareCode, setShareCode] = useState('')

  async function load() {
    try {
      const [f, mp, sf, af] = await Promise.all([
        getFamily({ data: { familyId } }),
        getFamilyMealPlan({ data: { familyId, weekStart } }),
        getSharedFamilyMealPlans({ data: { familyId, weekStart } }),
        getMyFamilies(),
      ])
      setFamily(f as typeof family)
      setMealPlan(mp as typeof mealPlan)
      setSharedPlans(sf as typeof sharedPlans)
      setAllFamilies(af as Array<{ id: string; name: string }>)
    } catch {
      router.navigate({ to: '/families' })
    }
  }

  useEffect(() => {
    load()
  }, [familyId])

  async function handleSaveDay(dayOfWeek: number) {
    if (!mealPlan) return
    setSaving(true)
    try {
      await upsertFamilyDayPlan({
        data: {
          familyId,
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

  async function handleShare() {
    if (!shareCode) return
    setSharing(true)
    try {
      const targetFamily = allFamilies.find(
        (f) =>
          f.id !== familyId &&
          f.name.toUpperCase().includes(shareCode.toUpperCase()),
      )
      if (targetFamily) {
        await shareFamilyMealPlan({
          data: { familyId, weekStart, shareWithFamilyId: targetFamily.id },
        })
        setShareCode('')
        await load()
      }
    } finally {
      setSharing(false)
    }
  }

  async function handleUnshare(targetFamilyId: string) {
    await unshareFamilyMealPlan({
      data: { familyId, weekStart, shareWithFamilyId: targetFamilyId },
    })
    await load()
  }

  async function handleLeave() {
    if (!confirm('Leave this family?')) return
    setLeaving(true)
    await leaveFamily({ data: { familyId } })
    router.navigate({ to: '/families' })
  }

  if (!family || !mealPlan) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Loading…
        </div>
      </AppLayout>
    )
  }

  const availableFamilies = allFamilies.filter(
    (f) => f.id !== familyId && !mealPlan.sharedWithFamilyIds.includes(f.id),
  )

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">
              {family.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Invite code:{' '}
              <span className="font-mono font-semibold text-foreground">
                {family.inviteCode}
              </span>
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLeave}
            disabled={leaving}
          >
            Leave family
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {(['planner', 'members'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px',
                tab === t
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Planner tab */}
        {tab === 'planner' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                Week of{' '}
                {new Date(weekStart + 'T12:00:00').toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                })}
              </p>
              {family.role === 'admin' && availableFamilies.length > 0 && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Type family name to share..."
                    value={shareCode}
                    onChange={(e) => setShareCode(e.target.value)}
                    className="h-8 w-48 text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={handleShare}
                    disabled={sharing || !shareCode}
                  >
                    Share
                  </Button>
                </div>
              )}
            </div>

            {/* Shared plans */}
            {sharedPlans.length > 0 && (
              <div className="mb-6 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Shared with you
                </p>
                {sharedPlans.map(({ family: sf }) => (
                  <div
                    key={sf.id}
                    className="bg-card border border-border rounded-lg overflow-hidden"
                  >
                    <div className="px-4 py-2 bg-muted/30 border-b border-border flex items-center justify-between">
                      <span className="font-medium text-sm">{sf.name}</span>
                      {family.role === 'admin' && (
                        <button
                          onClick={() => handleUnshare(sf.id)}
                          className="text-xs text-muted-foreground hover:text-destructive"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Family meal plan grid */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="grid grid-cols-7 divide-x divide-border">
                {DAY_SHORT.map((dayName, dayIndex) => {
                  const day = mealPlan.days.find(
                    (d) => d.dayOfWeek === dayIndex,
                  )
                  const isEditing = editingDay === dayIndex

                  return (
                    <div key={dayIndex} className="min-h-[180px]">
                      <div className="px-3 py-2 bg-muted/30 border-b border-border">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
                          {dayName}
                        </p>
                      </div>

                      <div className="p-2">
                        {isEditing ? (
                          <div className="space-y-2">
                            <Input
                              placeholder="Meal name"
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
                              placeholder="Notes"
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
                              placeholder="Recipe URL"
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
                                {saving ? 'Saving...' : 'Save'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingDay(null)}
                              >
                                Cancel
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
                                    {mealType}
                                  </p>
                                  {day?.mealName ? (
                                    <p className="text-sm font-medium leading-tight">
                                      {day.mealName}
                                    </p>
                                  ) : (
                                    <p className="text-xs text-muted-foreground italic">
                                      Click to add
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
                                      ↗ recipe
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
            </div>

            {/* Members indicator */}
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Members:</span>
              {family.members.map((member) => (
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
            {family.members.map((member) => (
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
