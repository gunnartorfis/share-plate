import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import {
  getMealPlan,
  upsertDayPlan,
  sharePlan,
  unsharePlan,
  currentWeekStart,
  weekStartFromParam,
  isoWeek,
} from "@/lib/server/meal-plans"
import { getMyConstraints, getDayTemplates } from "@/lib/server/constraints"
import { getMyGroups } from "@/lib/server/groups"
import { getMyLinks } from "@/lib/server/links"
import { generateMealPlan } from "@/lib/server/ai"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Constraint } from "@/lib/db/schema"

export const Route = createFileRoute("/planner/$week")({
  component: PlannerPage,
})

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

type DayPlanData = {
  id: string
  dayOfWeek: number
  mealName: string | null
  notes: string | null
  recipeLinkId: string | null
  constraintIds: string[]
  recipeLink: { id: string; title: string; url: string; tags: string[] } | null
}

type PlannerState = {
  plan: { id: string; weekStart: string } | null
  days: DayPlanData[]
  sharedGroupIds: string[]
}

function PlannerPage() {
  const { week } = Route.useParams()
  const router = useRouter()
  const weekStart = weekStartFromParam(week)

  const [state, setState] = useState<PlannerState>({ plan: null, days: [], sharedGroupIds: [] })
  const [constraints, setConstraints] = useState<Constraint[]>([])
  const [dayTemplates, setDayTemplates] = useState<{ dayOfWeek: number; constraintIds: string[] }[]>([])
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [myLinks, setMyLinks] = useState<{ id: string; title: string; url: string; tags: string[] }[]>([])
  const [editingDay, setEditingDay] = useState<number | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit state
  const [editMeal, setEditMeal] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [editLinkId, setEditLinkId] = useState<string | null>(null)
  const [editConstraintIds, setEditConstraintIds] = useState<string[]>([])

  async function load() {
    const [planData, cs, templates, gs, links] = await Promise.all([
      getMealPlan({ data: { weekStart } }),
      getMyConstraints(),
      getDayTemplates(),
      getMyGroups(),
      getMyLinks(),
    ])
    setState(planData as PlannerState)
    setConstraints(cs)
    setDayTemplates(
      templates.map((t) => ({
        dayOfWeek: t.dayOfWeek,
        constraintIds: JSON.parse(t.constraintIds) as string[],
      })),
    )
    setGroups(gs)
    setMyLinks(links)
  }

  useEffect(() => {
    load()
  }, [weekStart])

  function openEdit(dayOfWeek: number) {
    const day = state.days.find((d) => d.dayOfWeek === dayOfWeek)
    const template = dayTemplates.find((t) => t.dayOfWeek === dayOfWeek)
    setEditMeal(day?.mealName ?? "")
    setEditNotes(day?.notes ?? "")
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
      alert(err instanceof Error ? err.message : "AI generation failed")
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

  // Week navigation
  const prevWeek = () => {
    const d = new Date(weekStart + "T12:00:00")
    d.setDate(d.getDate() - 7)
    const ws = d.toISOString().slice(0, 10)
    router.navigate({ to: "/planner/$week", params: { week: isoWeek(ws) } })
  }
  const nextWeek = () => {
    const d = new Date(weekStart + "T12:00:00")
    d.setDate(d.getDate() + 7)
    const ws = d.toISOString().slice(0, 10)
    router.navigate({ to: "/planner/$week", params: { week: isoWeek(ws) } })
  }
  const todayWeek = () => {
    const ws = currentWeekStart()
    router.navigate({ to: "/planner/$week", params: { week: isoWeek(ws) } })
  }

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + "T12:00:00")
    d.setDate(d.getDate() + i)
    return d
  })

  const constraintMap = new Map(constraints.map((c) => [c.id, c]))

  return (
    <AppLayout>
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">
              Dinner Planner
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Week of{" "}
              {weekDates[0]!.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* AI Generate */}
            <Button
              variant="default"
              onClick={handleAiGenerate}
              disabled={aiLoading}
              className={cn(
                "gap-2",
                aiLoading && "ai-loading",
              )}
            >
              <SparkleIcon className="w-4 h-4" />
              {aiLoading ? "Generating…" : "Generate with AI"}
            </Button>

            {/* Week nav */}
            <div className="flex items-center gap-1 ml-2">
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

        {/* Week grid */}
        <div className="grid grid-cols-7 gap-3 mb-8">
          {DAY_NAMES.map((dayName, i) => {
            const day = state.days.find((d) => d.dayOfWeek === i)
            const template = dayTemplates.find((t) => t.dayOfWeek === i)
            const templateConstraints = template?.constraintIds ?? []
            const effectiveConstraints = day?.constraintIds.length
              ? day.constraintIds
              : templateConstraints
            const date = weekDates[i]!
            const today = new Date()
            const isTodayExact = date.getDate() === today.getDate() &&
              date.getMonth() === today.getMonth() &&
              date.getFullYear() === today.getFullYear()

            return (
              <button
                key={i}
                onClick={() => openEdit(i)}
                className={cn(
                  "group relative bg-card border rounded-lg p-4 text-left transition-all duration-150",
                  "hover:-translate-y-0.5 hover:shadow-md",
                  isTodayExact
                    ? "border-primary/60 ring-1 ring-primary/20"
                    : "border-border hover:border-border/80",
                )}
              >
                {/* Day header */}
                <div className="mb-3">
                  <p
                    className={cn(
                      "text-xs font-medium uppercase tracking-widest",
                      isTodayExact ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {dayName}
                  </p>
                  <p className="text-lg font-display font-semibold leading-tight">
                    {date.getDate()}
                  </p>
                </div>

                {/* Meal name */}
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

                {/* Recipe link */}
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

                {/* Constraint badges */}
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
                            backgroundColor: c.color + "22",
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

                {/* Edit hint */}
                <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <EditIcon className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </button>
            )
          })}
        </div>

        {/* Share with groups */}
        {groups.length > 0 && (
          <div className="border border-border rounded-lg p-5">
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
                      "px-3 py-1.5 rounded-md text-sm font-medium border transition-colors",
                      shared
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border hover:border-primary/50",
                    )}
                  >
                    {shared ? "✓ " : ""}
                    {g.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Day editor drawer */}
      {editingDay !== null && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/20 backdrop-blur-sm"
            onClick={() => setEditingDay(null)}
          />
          <div className="w-full max-w-md bg-card border-l border-border h-full flex flex-col shadow-2xl">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-display font-semibold">
                {DAY_FULL[editingDay]} dinner
              </h2>
              <button
                onClick={() => setEditingDay(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Meal name */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Dinner</label>
                <input
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="What's for dinner?"
                  value={editMeal}
                  onChange={(e) => setEditMeal(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Notes */}
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

              {/* Recipe link */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Recipe link</label>
                <select
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={editLinkId ?? ""}
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

              {/* Constraints */}
              {constraints.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Constraints</label>
                  <div className="flex flex-wrap gap-2">
                    {constraints.map((c) => {
                      const active = editConstraintIds.includes(c.id)
                      return (
                        <button
                          key={c.id}
                          onClick={() =>
                            setEditConstraintIds((prev) =>
                              active ? prev.filter((id) => id !== c.id) : [...prev, c.id],
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-sm font-medium border transition-all"
                          style={
                            active
                              ? {
                                  backgroundColor: c.color + "22",
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

            <div className="px-6 py-4 border-t border-border flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setEditingDay(null)}
              >
                Cancel
              </Button>
              <Button className="flex-1" onClick={saveDay} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

// Icons
function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
      <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function EditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  )
}
