import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { Constraint } from '@/lib/db/schema'
import { AppLayout } from '@/components/layout/app-layout'
import {
  currentWeekStart,
  getMealPlan,
  getPastMealNames,
  isoWeek,
  sharePlan,
  unsharePlan,
  upsertDayPlan,
  weekStartFromParam,
} from '@/lib/server/meal-plans'
import { getDayTemplates, getMyConstraints } from '@/lib/server/constraints'
import { getMyGroups } from '@/lib/server/groups'
import { getMyLinks } from '@/lib/server/links'
import { generateMealPlan } from '@/lib/server/ai'
import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/planner/$week')({
  component: PlannerPage,
})

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_FULL = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

type DayPlanData = {
  id: string
  dayOfWeek: number
  mealName: string | null
  notes: string | null
  recipeLinkId: string | null
  constraintIds: Array<string>
  recipeLink: {
    id: string
    title: string
    url: string
    tags: Array<string>
  } | null
}

type PlannerState = {
  plan: { id: string; weekStart: string } | null
  days: Array<DayPlanData>
  sharedGroupIds: Array<string>
}

function PlannerPage() {
  const { week } = Route.useParams()
  const router = useRouter()
  const weekStart = weekStartFromParam(week)

  const [state, setState] = useState<PlannerState>({
    plan: null,
    days: [],
    sharedGroupIds: [],
  })
  const [constraints, setConstraints] = useState<Array<Constraint>>([])
  const [dayTemplates, setDayTemplates] = useState<
    Array<{ dayOfWeek: number; constraintIds: Array<string> }>
  >([])
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([])
  const [myLinks, setMyLinks] = useState<
    Array<{ id: string; title: string; url: string; tags: Array<string> }>
  >([])
  const [pastMealNames, setPastMealNames] = useState<Array<string>>([])
  const [editingDay, setEditingDay] = useState<number | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [editMeal, setEditMeal] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editLinkId, setEditLinkId] = useState<string | null>(null)
  const [editConstraintIds, setEditConstraintIds] = useState<Array<string>>([])

  async function load() {
    const [planData, cs, templates, gs, links, pastNames] = await Promise.all([
      getMealPlan({ data: { weekStart } }),
      getMyConstraints(),
      getDayTemplates(),
      getMyGroups(),
      getMyLinks(),
      getPastMealNames(),
    ])
    setState(planData as PlannerState)
    setConstraints(cs)
    setDayTemplates(
      templates.map((t) => ({
        dayOfWeek: t.dayOfWeek,
        constraintIds: JSON.parse(t.constraintIds) as Array<string>,
      })),
    )
    setGroups(gs)
    setMyLinks(links)
    setPastMealNames(pastNames)
  }

  useEffect(() => {
    load()
  }, [weekStart])

  function openEdit(dayOfWeek: number) {
    const day = state.days.find((d) => d.dayOfWeek === dayOfWeek)
    const template = dayTemplates.find((t) => t.dayOfWeek === dayOfWeek)
    setEditMeal(day?.mealName ?? '')
    setEditNotes(day?.notes ?? '')
    setEditLinkId(day?.recipeLinkId ?? null)
    setEditConstraintIds(day?.constraintIds ?? template?.constraintIds ?? [])
    setEditingDay(dayOfWeek)
  }

  async function saveDay() {
    if (editingDay === null) return
    setSaving(true)
    try {
      await upsertDayPlan({
        data: {
          weekStart,
          dayOfWeek: editingDay,
          mealName: editMeal || undefined,
          notes: editNotes || undefined,
          recipeLinkId: editLinkId,
          constraintIds: editConstraintIds,
        },
      })
      await load()
      setEditingDay(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleAiGenerate() {
    setAiLoading(true)
    try {
      await generateMealPlan({ data: { weekStart } })
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'AI generation failed')
    } finally {
      setAiLoading(false)
    }
  }

  async function toggleShare(groupId: string) {
    const isShared = state.sharedGroupIds.includes(groupId)
    if (isShared) {
      await unsharePlan({ data: { weekStart, groupId } })
    } else {
      await sharePlan({ data: { weekStart, groupId } })
    }
    await load()
  }

  const prevWeek = () => {
    const d = new Date(weekStart + 'T12:00:00')
    d.setDate(d.getDate() - 7)
    router.navigate({
      to: '/planner/$week',
      params: { week: isoWeek(d.toISOString().slice(0, 10)) },
    })
  }
  const nextWeek = () => {
    const d = new Date(weekStart + 'T12:00:00')
    d.setDate(d.getDate() + 7)
    router.navigate({
      to: '/planner/$week',
      params: { week: isoWeek(d.toISOString().slice(0, 10)) },
    })
  }
  const todayWeek = () => {
    router.navigate({
      to: '/planner/$week',
      params: { week: isoWeek(currentWeekStart()) },
    })
  }

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + 'T12:00:00')
    d.setDate(d.getDate() + i)
    return d
  })

  const constraintMap = new Map(constraints.map((c) => [c.id, c]))

  const today = new Date()
  function isToday(date: Date) {
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  // Shared drawer form content — rendered in both mobile bottom sheet and desktop side panel
  function DrawerForm() {
    if (editingDay === null) return null
    return (
      <>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
          <h2 className="text-lg font-display font-semibold">
            {DAY_FULL[editingDay]} dinner
          </h2>
          <button
            onClick={() => setEditingDay(null)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-5">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Dinner</label>
            <Combobox
              value={editMeal}
              onValueChange={(v) => setEditMeal(v ?? '')}
            >
              <ComboboxInput
                className="w-full rounded-md"
                placeholder="What's for dinner?"
                autoFocus
                showTrigger={false}
                onChange={(e) => setEditMeal(e.target.value)}
              />
              <ComboboxContent>
                <ComboboxList>
                  {pastMealNames.map((name) => (
                    <ComboboxItem key={name} value={name}>
                      {name}
                    </ComboboxItem>
                  ))}
                </ComboboxList>
                <ComboboxEmpty>No previous dinners</ComboboxEmpty>
              </ComboboxContent>
            </Combobox>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Notes</label>
            <textarea
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              rows={2}
              placeholder="Any notes…"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Recipe link
            </label>
            <select
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={editLinkId ?? ''}
              onChange={(e) => setEditLinkId(e.target.value || null)}
            >
              <option value="">None</option>
              {myLinks.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </div>

          {constraints.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                Constraints
              </label>
              <div className="flex flex-wrap gap-2">
                {constraints.map((c) => {
                  const active = editConstraintIds.includes(c.id)
                  return (
                    <button
                      key={c.id}
                      onClick={() =>
                        setEditConstraintIds((prev) =>
                          active
                            ? prev.filter((id) => id !== c.id)
                            : [...prev, c.id],
                        )
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-sm font-medium border transition-all"
                      style={
                        active
                          ? {
                              backgroundColor: c.color + '22',
                              color: c.color,
                              borderColor: c.color,
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
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex gap-2 shrink-0">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setEditingDay(null)}
          >
            Cancel
          </Button>
          <Button className="flex-1" onClick={saveDay} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6 md:mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">
              Dinner Planner
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Week of{' '}
              {weekDates[0].toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="default"
              onClick={handleAiGenerate}
              disabled={aiLoading}
              className={cn(
                'gap-2 flex-1 md:flex-none',
                aiLoading && 'ai-loading',
              )}
            >
              <SparkleIcon className="w-4 h-4" />
              {aiLoading ? 'Generating…' : 'Generate with AI'}
            </Button>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={prevWeek}>
                <ChevronLeftIcon className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={todayWeek}>
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={nextWeek}>
                <ChevronRightIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile: vertical day list */}
        <div className="md:hidden space-y-2 mb-6">
          {DAY_NAMES.map((dayName, i) => {
            const day = state.days.find((d) => d.dayOfWeek === i)
            const template = dayTemplates.find((t) => t.dayOfWeek === i)
            const effectiveConstraints = day?.constraintIds.length
              ? day.constraintIds
              : (template?.constraintIds ?? [])
            const date = weekDates[i]
            const isTodayExact = isToday(date)

            return (
              <button
                key={i}
                onClick={() => openEdit(i)}
                className={cn(
                  'w-full flex items-center gap-3 bg-card border rounded-lg px-3 py-3 text-left transition-colors active:bg-muted',
                  isTodayExact
                    ? 'border-primary/60 ring-1 ring-primary/20'
                    : 'border-border',
                )}
              >
                {/* Day + date */}
                <div className="w-11 shrink-0 text-center">
                  <p
                    className={cn(
                      'text-[10px] font-medium uppercase tracking-widest',
                      isTodayExact ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {dayName}
                  </p>
                  <p
                    className={cn(
                      'text-xl font-display font-semibold leading-tight',
                      isTodayExact ? 'text-primary' : '',
                    )}
                  >
                    {date.getDate()}
                  </p>
                </div>

                <div className="w-px h-9 bg-border shrink-0" />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {day?.mealName ? (
                    <p className="text-sm font-medium text-foreground truncate">
                      {day.mealName}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground/60 italic">
                      Add dinner…
                    </p>
                  )}
                  {effectiveConstraints.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {effectiveConstraints.slice(0, 3).map((cid) => {
                        const c = constraintMap.get(cid)
                        if (!c) return null
                        return (
                          <span
                            key={cid}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
                            style={{
                              backgroundColor: c.color + '22',
                              color: c.color,
                              border: `1px solid ${c.color}44`,
                            }}
                          >
                            {c.emoji && <span>{c.emoji}</span>}
                            {c.name}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>

                <ChevronRightIcon className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            )
          })}
        </div>

        {/* Desktop: 7-col grid */}
        <div className="hidden md:grid grid-cols-7 gap-3 mb-8">
          {DAY_NAMES.map((dayName, i) => {
            const day = state.days.find((d) => d.dayOfWeek === i)
            const template = dayTemplates.find((t) => t.dayOfWeek === i)
            const effectiveConstraints = day?.constraintIds.length
              ? day.constraintIds
              : (template?.constraintIds ?? [])
            const date = weekDates[i]
            const isTodayExact = isToday(date)

            return (
              <button
                key={i}
                onClick={() => openEdit(i)}
                className={cn(
                  'group relative bg-card border rounded-lg p-4 text-left transition-all duration-150',
                  'hover:-translate-y-0.5 hover:shadow-md',
                  isTodayExact
                    ? 'border-primary/60 ring-1 ring-primary/20'
                    : 'border-border hover:border-border/80',
                )}
              >
                <div className="mb-3">
                  <p
                    className={cn(
                      'text-xs font-medium uppercase tracking-widest',
                      isTodayExact ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {dayName}
                  </p>
                  <p className="text-lg font-display font-semibold leading-tight">
                    {date.getDate()}
                  </p>
                </div>

                <div className="min-h-[48px]">
                  {day?.mealName ? (
                    <p className="text-sm font-medium text-foreground leading-snug">
                      {day.mealName}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground/60 italic">
                      Add dinner…
                    </p>
                  )}
                </div>

                {day?.recipeLink && (
                  <a
                    href={day.recipeLink.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLinkIcon className="w-3 h-3" />
                    <span className="truncate">{day.recipeLink.title}</span>
                  </a>
                )}

                {effectiveConstraints.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {effectiveConstraints.map((cid) => {
                      const c = constraintMap.get(cid)
                      if (!c) return null
                      return (
                        <span
                          key={cid}
                          className="badge-animate inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{
                            backgroundColor: c.color + '22',
                            color: c.color,
                            border: `1px solid ${c.color}44`,
                          }}
                        >
                          {c.emoji && <span>{c.emoji}</span>}
                          {c.name}
                        </span>
                      )
                    })}
                  </div>
                )}

                <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <EditIcon className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </button>
            )
          })}
        </div>

        {/* Share with groups */}
        {groups.length > 0 && (
          <div className="border border-border rounded-lg p-4 md:p-5">
            <h2 className="text-sm font-semibold mb-3 text-foreground">
              Share this week with groups
            </h2>
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => {
                const shared = state.sharedGroupIds.includes(g.id)
                return (
                  <button
                    key={g.id}
                    onClick={() => toggleShare(g.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-sm font-medium border transition-colors',
                      shared
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-foreground border-border hover:border-primary/50',
                    )}
                  >
                    {shared ? '✓ ' : ''}
                    {g.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Day editor */}
      {editingDay !== null && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm"
            onClick={() => setEditingDay(null)}
          />

          {/* Mobile: bottom sheet */}
          <div className="md:hidden fixed inset-x-0 bottom-0 z-[60] max-h-[88vh] overflow-hidden bg-card rounded-t-2xl border-t border-border flex flex-col shadow-2xl safe-area-bottom">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <DrawerForm />
          </div>

          {/* Desktop: right panel */}
          <div className="hidden md:flex fixed right-0 top-0 bottom-0 w-full max-w-md bg-card border-l border-border flex-col shadow-2xl z-50">
            <DrawerForm />
          </div>
        </>
      )}
    </AppLayout>
  )
}

// Icons
function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
    >
      <path
        d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function EditIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
        strokeLinecap="round"
      />
      <path
        d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  )
}
