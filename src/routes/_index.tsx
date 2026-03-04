import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { Constraint } from '@/lib/db/schema'
import type {
  DayTemplate,
  HomeData,
  MealPlanData,
  MonthMealPlans,
} from '@/components/planner/types'
import { AppLayout } from '@/components/layout/app-layout'
import {
  getHomeMealPlanWithSharing,
  getHomeMealPlansForMonth,
  getMyHome,
  updateHomeName,
} from '@/lib/server/homes'
import { generateMealPlan } from '@/lib/server/ai'
import {
  getHomeSetupCompleted,
  markHomeSetupCompleted,
} from '@/lib/server/auth'
import { getDayTemplates, getMyConstraints } from '@/lib/server/constraints'
import { getMySubscriptions } from '@/lib/server/subscriptions'
import {
  currentWeekStart,
  isoWeek,
  weekStartFromParam,
} from '@/lib/server/meal-plans'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SparkleIcon,
} from '@/components/ui/icons'
import { DrawerForm } from '@/components/planner/drawer-form'
import { MonthGrid } from '@/components/planner/month-grid'
import { WeekView } from '@/components/planner/week-view'
import { DAY_NAMES } from '@/components/planner/types'
import { useDrawerState } from '@/hooks/use-drawer-state'

export const Route = createFileRoute('/_index')({
  validateSearch: (search: Record<string, unknown>) => {
    const weekParam = search.week as string | undefined
    return {
      week: weekParam ? weekStartFromParam(weekParam) : currentWeekStart(),
    }
  },
  component: HomePage,
})

// ---------- Component ----------

function HomePage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { week: weekStart } = Route.useSearch()

  // -- View state --
  const [view, setViewState] = useState<'week' | 'month'>('month')
  // Store month as primitives to avoid Date ref equality issues in deps
  const [monthYear, setMonthYear] = useState(() => new Date().getFullYear())
  const [monthIdx, setMonthIdx] = useState(() => new Date().getMonth())
  const month = new Date(monthYear, monthIdx, 1)

  // -- Data state --
  const [home, setHome] = useState<HomeData | null>(null)
  const [mealPlan, setMealPlan] = useState<MealPlanData | null>(null)
  const [monthMealPlans, setMonthMealPlans] = useState<MonthMealPlans>({})
  const [constraints, setConstraints] = useState<Array<Constraint>>([])
  const [dayTemplates, setDayTemplates] = useState<Array<DayTemplate>>([])
  const [subscriptions, setSubscriptions] = useState<
    Array<{ id: string; name: string }>
  >([])
  const [monthLoadError, setMonthLoadError] = useState<string | null>(null)

  // -- Drawer state (consolidated in useDrawerState) --
  const drawer = useDrawerState({
    weekStart,
    mealPlan,
    dayTemplates,
    view,
    monthYear,
    monthIdx,
    onMealPlanUpdated: (mp) => setMealPlan(mp),
    onMonthMealPlansUpdated: (mmp) => setMonthMealPlans(mmp),
  })

  // -- AI state --
  const [aiLoading, setAiLoading] = useState(false)
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [aiStartDate, setAiStartDate] = useState('')
  const [aiEndDate, setAiEndDate] = useState('')
  const [aiBudget, setAiBudget] = useState(2)
  const [aiHealthMode, setAiHealthMode] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // -- UI state --
  const [tab, setTab] = useState<'planner' | 'members'>('planner')
  const [copied, setCopied] = useState(false)
  const [newName, setNewName] = useState('')
  const [renameOpen, setRenameOpen] = useState(false)

  // -- Refs --
  const loadingRef = useRef(false)

  // ---------- Setup check (run once) ----------
  useEffect(() => {
    let cancelled = false
    async function checkSetup() {
      const completed = await getHomeSetupCompleted()
      if (!cancelled && !completed) {
        setRenameOpen(true)
        markHomeSetupCompleted()
      }
    }
    checkSetup()
    return () => {
      cancelled = true
    }
  }, [])

  // ---------- Data loading ----------
  const load = useCallback(
    async (retries = 2) => {
      if (loadingRef.current) return
      loadingRef.current = true

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          // All independent fetches in parallel — no waterfall
          const promises: [
            ReturnType<typeof getMyHome>,
            ReturnType<typeof getHomeMealPlanWithSharing>,
            ReturnType<typeof getMyConstraints>,
            ReturnType<typeof getDayTemplates>,
            ReturnType<typeof getMySubscriptions>,
            ReturnType<typeof getHomeMealPlansForMonth> | Promise<null>,
          ] = [
            getMyHome(),
            getHomeMealPlanWithSharing({ data: { weekStart } }),
            getMyConstraints(),
            getDayTemplates(),
            getMySubscriptions(),
            view === 'month'
              ? getHomeMealPlansForMonth({
                  data: { year: monthYear, month: monthIdx + 1 },
                })
              : Promise.resolve(null),
          ]

          const [h, mp, cs, templates, gs, mmp] = await Promise.all(promises)

          if (!h) {
            router.navigate({ to: '/register' })
            loadingRef.current = false
            return
          }
          setHome(h as HomeData)
          setMealPlan(mp as MealPlanData)
          setConstraints(cs)
          setDayTemplates(
            templates.map((tpl) => ({
              dayOfWeek: tpl.dayOfWeek,
              constraintIds: JSON.parse(tpl.constraintIds) as Array<string>,
            })),
          )
          setSubscriptions(gs)
          setMonthLoadError(null)

          if (mmp !== null) {
            setMonthMealPlans(mmp as MonthMealPlans)
          }

          loadingRef.current = false
          return
        } catch (err) {
          console.error(`Load attempt ${attempt + 1} failed:`, err)
          if (attempt === retries) {
            console.error('Failed to load home data after retries:', err)
            setMonthLoadError(t('common.error'))
            if (!home) {
              router.navigate({ to: '/register' })
            }
          } else {
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
          }
        }
      }
      loadingRef.current = false
    },
    [weekStart, view, monthYear, monthIdx, router, t, home],
  )

  useEffect(() => {
    load()
  }, [load])

  // ---------- Handlers ----------

  async function handleUpdateName() {
    if (!newName.trim() || !home) return
    await updateHomeName({ data: { name: newName.trim() } })
    setHome({ ...home, name: newName.trim() })
  }

  function copyInviteCode() {
    if (!home) return
    navigator.clipboard.writeText(home.inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // -- Navigation --
  const prevWeek = () => {
    const d = new Date(weekStart + 'T12:00:00')
    d.setDate(d.getDate() - 7)
    router.navigate({
      to: '/',
      search: { week: isoWeek(d.toISOString().slice(0, 10)) },
    })
  }
  const nextWeek = () => {
    const d = new Date(weekStart + 'T12:00:00')
    d.setDate(d.getDate() + 7)
    router.navigate({
      to: '/',
      search: { week: isoWeek(d.toISOString().slice(0, 10)) },
    })
  }
  const todayWeek = () => {
    router.navigate({
      to: '/',
      search: { week: isoWeek(currentWeekStart()) },
    })
  }
  const prevMonth = () => {
    if (monthIdx === 0) {
      setMonthYear((y) => y - 1)
      setMonthIdx(11)
    } else {
      setMonthIdx((m) => m - 1)
    }
  }
  const nextMonth = () => {
    if (monthIdx === 11) {
      setMonthYear((y) => y + 1)
      setMonthIdx(0)
    } else {
      setMonthIdx((m) => m + 1)
    }
  }
  const todayMonth = () => {
    const now = new Date()
    setMonthYear(now.getFullYear())
    setMonthIdx(now.getMonth())
  }

  const setView = (newView: 'week' | 'month') => {
    setViewState(newView)
    if (newView === 'month') {
      const d = new Date(weekStart)
      setMonthYear(d.getFullYear())
      setMonthIdx(d.getMonth())
    }
  }

  const handleMonthDayClick = useCallback(
    (cellWeekStart: string, dayOfWeek: number) => {
      drawer.setPendingEditDay(dayOfWeek, cellWeekStart)
      router.navigate({
        to: '/',
        search: { week: cellWeekStart },
      })
    },
    [router, drawer.setPendingEditDay],
  )

  const isPastWeek = weekStart < currentWeekStart()

  // ---------- Loading state ----------
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
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6 md:mb-8">
          <div>
            <Dialog
              open={renameOpen}
              onOpenChange={(open) => {
                if (open) setNewName(home.name)
                setRenameOpen(open)
              }}
            >
              <h1
                className="text-3xl font-display font-bold tracking-tight cursor-pointer hover:text-primary/80 transition-colors"
                onClick={() => setRenameOpen(true)}
              >
                {home.name}
              </h1>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('home.renameTitle')}</DialogTitle>
                  <DialogDescription>
                    {t('home.renameDescription')}
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t('home.namePlaceholder')}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleUpdateName()
                        setRenameOpen(false)
                      }
                    }}
                  />
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setRenameOpen(false)}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    onClick={() => {
                      handleUpdateName()
                      setRenameOpen(false)
                    }}
                  >
                    {t('common.save')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* AI generation modal */}
            <Dialog open={aiModalOpen} onOpenChange={setAiModalOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{t('planner.generateWithAi')}</DialogTitle>
                  <DialogDescription>
                    {t('planner.aiModalDescription') ||
                      'Configure options for AI meal plan generation'}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date Range</label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={aiStartDate}
                        onChange={(e) => setAiStartDate(e.target.value)}
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground">to</span>
                      <Input
                        type="date"
                        value={aiEndDate}
                        onChange={(e) => setAiEndDate(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Budget</label>
                    <div className="flex rounded-lg border overflow-hidden">
                      {[
                        { value: 1, label: 'Budget' },
                        { value: 2, label: 'Balanced' },
                        { value: 3, label: 'Generous' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setAiBudget(option.value)}
                          className={cn(
                            'flex-1 px-3 py-1.5 text-sm font-medium transition-colors',
                            aiBudget === option.value
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-background hover:bg-muted',
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">
                        Health / Átak Mode
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Focused cooking sprint
                      </p>
                    </div>
                    <button
                      onClick={() => setAiHealthMode(!aiHealthMode)}
                      className={cn(
                        'relative w-11 h-6 rounded-full transition-colors',
                        aiHealthMode ? 'bg-green-500' : 'bg-muted',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform',
                          aiHealthMode && 'translate-x-5',
                        )}
                      />
                    </button>
                  </div>

                  {constraints.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Constraints & Limitations
                      </label>
                      <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                        {constraints.map((c) => (
                          <div key={c.id} className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: c.color }}
                            />
                            <span>
                              {c.name}
                              {c.frequency && ` (max ${c.frequency}x/week)`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {dayTemplates.some((tpl) => tpl.constraintIds.length > 0) && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Day Constraints
                      </label>
                      <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                        {dayTemplates
                          .filter((dt) => dt.constraintIds.length > 0)
                          .map((dt) => {
                            const constraintDetails = dt.constraintIds
                              .map((id) => {
                                const c = constraints.find((c2) => c2.id === id)
                                return c?.name || id
                              })
                              .join(', ')
                            return (
                              <div key={dt.dayOfWeek}>
                                <span className="font-medium">
                                  {t(DAY_NAMES[dt.dayOfWeek])}
                                </span>
                                : {constraintDetails}
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setAiModalOpen(false)}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    onClick={async () => {
                      setAiModalOpen(false)
                      setAiLoading(true)
                      setAiError(null)
                      try {
                        await generateMealPlan({
                          data: {
                            startDate: aiStartDate,
                            endDate: aiEndDate,
                            budget: aiBudget,
                            healthMode: aiHealthMode,
                          },
                        })
                        await load()
                      } catch (err) {
                        setAiError(
                          err instanceof Error
                            ? err.message
                            : t('planner.aiGenerationFailed'),
                        )
                      } finally {
                        setAiLoading(false)
                      }
                    }}
                    disabled={aiLoading}
                  >
                    {aiLoading
                      ? t('planner.generating')
                      : t('planner.generate')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* AI error dialog (replaces alert()) */}
            <Dialog
              open={aiError !== null}
              onOpenChange={(open) => {
                if (!open) setAiError(null)
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('planner.aiGenerationFailed')}</DialogTitle>
                  <DialogDescription>{aiError}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button onClick={() => setAiError(null)}>
                    {t('common.cancel')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

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

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="default"
              onClick={() => {
                const today = new Date()
                let startDate: Date | null = null

                for (let i = 0; i < 56; i++) {
                  const d = new Date(today)
                  d.setDate(d.getDate() + i)
                  const ws = new Date(d)
                  ws.setDate(ws.getDate() - ((ws.getDay() + 6) % 7))
                  const wsStr = ws.toISOString().slice(0, 10)
                  const dow = (d.getDay() + 6) % 7

                  let hasMeal = false
                  if (wsStr === weekStart && mealPlan) {
                    const day = mealPlan.days.find((dd) => dd.dayOfWeek === dow)
                    hasMeal = !!day?.mealName
                  }
                  const weekDays = monthMealPlans[wsStr]
                  if (weekDays) {
                    const day = weekDays.find((dd) => dd.dayOfWeek === dow)
                    if (day) hasMeal = !!day.mealName
                  }

                  if (!hasMeal) {
                    startDate = d
                    break
                  }
                }

                if (!startDate) {
                  startDate = new Date(today)
                  startDate.setDate(startDate.getDate() + 1)
                }

                const endDate = new Date(startDate)
                endDate.setDate(endDate.getDate() + 13)

                setAiStartDate(startDate.toISOString().slice(0, 10))
                setAiEndDate(endDate.toISOString().slice(0, 10))
                setAiModalOpen(true)
              }}
              disabled={aiLoading || isPastWeek}
              className={cn(
                'gap-2 flex-1 md:flex-none',
                aiLoading && 'ai-loading',
              )}
            >
              <SparkleIcon className="w-4 h-4" />
              {aiLoading
                ? t('planner.generating')
                : t('planner.generateWithAi')}
            </Button>
            <div className="flex items-center gap-1 shrink-0">
              {view === 'month' ? (
                <>
                  <Button variant="outline" size="icon" onClick={prevMonth}>
                    <ChevronLeftIcon className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={todayMonth}>
                    {t('planner.today')}
                  </Button>
                  <Button variant="outline" size="icon" onClick={nextMonth}>
                    <ChevronRightIcon className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="icon" onClick={prevWeek}>
                    <ChevronLeftIcon className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={todayWeek}>
                    {t('planner.today')}
                  </Button>
                  <Button variant="outline" size="icon" onClick={nextWeek}>
                    <ChevronRightIcon className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
            <div className="flex items-center border border-border rounded-md overflow-hidden shrink-0">
              <button
                onClick={() => setView('week')}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium transition-colors',
                  view === 'week'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t('planner.week')}
              </button>
              <button
                onClick={() => setView('month')}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium transition-colors',
                  view === 'month'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t('planner.month')}
              </button>
            </div>
          </div>
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

        {/* Month view */}
        {tab === 'planner' && view === 'month' && (
          <MonthGrid
            month={month}
            monthMealPlans={monthMealPlans}
            aiLoading={aiLoading}
            aiStartDate={aiStartDate}
            aiEndDate={aiEndDate}
            monthLoadError={monthLoadError}
            onDayClick={handleMonthDayClick}
          />
        )}

        {/* Week view */}
        {tab === 'planner' && view === 'week' && (
          <WeekView
            weekStart={weekStart}
            mealPlanDays={mealPlan.days}
            dayTemplates={dayTemplates}
            constraints={constraints}
            home={home}
            subscriptions={subscriptions}
            aiLoading={aiLoading}
            aiStartDate={aiStartDate}
            aiEndDate={aiEndDate}
            onDayClick={drawer.openEdit}
          />
        )}

        {/* Members tab */}
        {tab === 'members' && <MembersTab members={home.members} />}
      </div>

      {/* Day editor — rendered in body portal to avoid mobile fixed-position bugs */}
      {drawer.editingDay !== null &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[60] bg-gradient-to-b from-black/45 via-black/30 to-black/50 backdrop-blur-[2px]"
              onClick={drawer.close}
            />
            <div
              className={cn(
                'fixed z-[70] flex flex-col border border-border/70 bg-card/95 shadow-[0_22px_70px_rgba(0,0,0,0.2)] backdrop-blur-xl',
                // Mobile: bottom sheet
                'inset-x-0 bottom-0 max-h-[90dvh] overflow-hidden rounded-t-3xl border-t safe-area-bottom',
                // Desktop: right panel
                'md:inset-x-auto md:right-4 md:top-4 md:bottom-4 md:w-full md:max-w-[32rem] md:max-h-none md:rounded-3xl md:border-t md:border-l',
              )}
            >
              {/* Mobile drag handle */}
              <div className="flex justify-center pt-3 pb-1 shrink-0 md:hidden">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>
              <DrawerForm
                editingDay={drawer.editingDay}
                weekStart={weekStart}
                meal={drawer.meal}
                recipeUrl={drawer.recipeUrl}
                editConstraintIds={drawer.constraintIds}
                setEditConstraintIds={drawer.setConstraintIds}
                constraints={constraints}
                saving={drawer.saving}
                onSave={drawer.handleSave}
                onClose={drawer.close}
                recipes={drawer.recipes}
                recipesLoading={drawer.recipesLoading}
                selectedRecipeId={drawer.selectedRecipeId}
                setSelectedRecipeId={drawer.selectRecipe}
                onRecipeCreated={drawer.handleRecipeCreated}
              />
            </div>
          </>,
          document.body,
        )}
    </AppLayout>
  )
}

// ---------- Members tab (extracted to reduce HomePage render cost) ----------

function MembersTab({ members }: { members: HomeData['members'] }) {
  return (
    <div className="space-y-2">
      {members.map((member) => (
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
            <p className="text-xs text-muted-foreground">{member.email}</p>
          </div>
          <span className="ml-auto text-xs text-muted-foreground capitalize">
            {member.role}
          </span>
        </div>
      ))}
    </div>
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
