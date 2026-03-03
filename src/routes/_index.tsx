import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Constraint } from '@/lib/db/schema'
import type { Dispatch, SetStateAction } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import {
  getHomeMealPlanWithSharing,
  getHomeMealPlansForMonth,
  getMyHome,
  updateHomeName,
  upsertHomeDayPlan,
} from '@/lib/server/homes'
import { getMyRecipes } from '@/lib/server/recipes'
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
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { TagSelector } from '@/components/ui/tag-selector'
import { useRecipeForm } from '@/hooks/use-recipe-form'
import type { RecipeData } from '@/hooks/use-recipe-form'
import type { RecipeMetadata } from '@/hooks/use-recipe-form'

export const Route = createFileRoute('/_index')({
  validateSearch: (search: Record<string, unknown>) => {
    const weekParam = search.week as string | undefined
    return {
      week: weekParam ? weekStartFromParam(weekParam) : currentWeekStart(),
    }
  },
  component: HomePage,
})

const DAY_NAMES = [
  'days.mon',
  'days.tue',
  'days.wed',
  'days.thu',
  'days.fri',
  'days.sat',
  'days.sun',
]
const DAY_FULL = [
  'days.monday',
  'days.tuesday',
  'days.wednesday',
  'days.thursday',
  'days.friday',
  'days.saturday',
  'days.sunday',
]

type MealPlanDay = {
  id: string
  dayOfWeek: number
  mealName: string | null
  notes: string | null
  recipeUrl: string | null
  constraintIds: Array<string>
}

type DrawerFormProps = {
  editingDay: number
  editNotes: string
  setEditNotes: (v: string) => void
  editConstraintIds: Array<string>
  setEditConstraintIds: Dispatch<SetStateAction<Array<string>>>
  constraints: Array<Constraint>
  saving: boolean
  onSave: () => void
  onClose: () => void
  recipes: Array<RecipeData>
  recipesLoading: boolean
  selectedRecipeId: string | null
  setSelectedRecipeId: (id: string | null) => void
  onRecipeCreated: (id: string, title: string, url: string | null) => void
}

const HTTP_PROTOCOL = 'http'

function DrawerForm({
  editingDay,
  editNotes,
  setEditNotes,
  editConstraintIds,
  setEditConstraintIds,
  constraints,
  saving,
  onSave,
  onClose,
  recipes,
  recipesLoading,
  selectedRecipeId,
  setSelectedRecipeId,
  onRecipeCreated,
}: DrawerFormProps) {
  const { t } = useTranslation()
  const [formMode, setFormMode] = useState<'search' | 'create'>('search')
  const [searchQuery, setSearchQuery] = useState('')

  const recipeForm = useRecipeForm({
    onSaved: (id) => {
      const title = recipeForm.title
      const url = recipeForm.url || null
      onRecipeCreated(id, title, url)
      setFormMode('search')
      recipeForm.reset()
    },
  })

  const selectedRecipe = selectedRecipeId
    ? recipes.find((r) => r.id === selectedRecipeId) ?? null
    : null

  const filteredRecipes = recipes.filter((r) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      r.title.toLowerCase().includes(q) ||
      r.tags.some((tag) => tag.toLowerCase().includes(q))
    )
  })

  return (
    <>
      <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
        <h2 className="text-lg font-display font-semibold">
          {t(DAY_FULL[editingDay])} {t('planner.dinner')}
        </h2>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1"
        >
          <XIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-5">
        {formMode === 'search' && (
          <div className="space-y-3">
            <label className="text-sm font-medium mb-1.5 block">
              {t('planner.selectRecipe')}
            </label>

            {/* Search input */}
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('planner.searchRecipes')}
                className="pl-9"
                autoFocus
              />
            </div>

            {/* Selected recipe card */}
            {selectedRecipe && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                {getRecipeImage(selectedRecipe) && (
                  <div className="w-10 h-10 rounded-md overflow-hidden shrink-0 bg-muted">
                    <img
                      src={getRecipeImage(selectedRecipe)!}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {selectedRecipe.title}
                  </p>
                  {selectedRecipe.url && (
                    <p className="text-xs text-muted-foreground truncate">
                      {safeHostname(selectedRecipe.url)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedRecipeId(null)}
                  className="text-xs text-amber-700 hover:text-amber-900 font-medium shrink-0"
                >
                  {t('planner.clearSelection')}
                </button>
              </div>
            )}

            {/* Recipe list */}
            <div className="space-y-1 max-h-[280px] overflow-y-auto">
              {recipesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-14 rounded-lg bg-muted animate-pulse"
                    />
                  ))}
                </div>
              ) : filteredRecipes.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <p className="text-sm">
                    {recipes.length === 0
                      ? t('planner.noRecipesSaved')
                      : t('planner.noRecipesFound')}
                  </p>
                </div>
              ) : (
                filteredRecipes.map((recipe) => {
                  const imageUrl = getRecipeImage(recipe)
                  const isSelected = recipe.id === selectedRecipeId
                  return (
                    <button
                      key={recipe.id}
                      onClick={() =>
                        setSelectedRecipeId(isSelected ? null : recipe.id)
                      }
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all',
                        isSelected
                          ? 'bg-amber-50 border border-amber-200'
                          : 'hover:bg-accent border border-transparent',
                      )}
                    >
                      {imageUrl && (
                        <div className="w-10 h-10 rounded-md overflow-hidden shrink-0 bg-muted">
                          <img
                            src={imageUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {recipe.title}
                        </p>
                        {recipe.url && (
                          <p className="text-xs text-muted-foreground truncate">
                            {safeHostname(recipe.url)}
                          </p>
                        )}
                        {recipe.tags.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {recipe.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded text-[10px]"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <CheckIcon className="w-4 h-4 text-amber-500 shrink-0" />
                      )}
                    </button>
                  )
                })
              )}
            </div>

            {/* Create new recipe button */}
            <button
              onClick={() => {
                recipeForm.reset()
                setFormMode('create')
              }}
              className="w-full flex items-center gap-2 p-3 rounded-lg border border-dashed border-border hover:border-primary/40 hover:bg-accent text-muted-foreground hover:text-foreground transition-all"
            >
              <PlusIcon className="w-4 h-4" />
              <span className="text-sm font-medium">
                {t('planner.createNewRecipe')}
              </span>
            </button>
          </div>
        )}

        {formMode === 'create' && (
          <div className="space-y-4">
            <button
              onClick={() => setFormMode('search')}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              {t('planner.backToSearch')}
            </button>

            {/* URL input */}
            <div className="space-y-2">
              <Label htmlFor="drawer-url">{t('recipes.urlLabel')}</Label>
              <div className="relative">
                <Input
                  id="drawer-url"
                  type="url"
                  value={recipeForm.url}
                  onChange={(e) => recipeForm.handleUrlChange(e.target.value)}
                  placeholder="https://..."
                  className={cn(
                    'pr-10',
                    recipeForm.fetchingMetadata &&
                      'border-amber-400 ring-2 ring-amber-100',
                  )}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {recipeForm.fetchingMetadata ? (
                    <div className="relative w-5 h-5">
                      <div className="absolute inset-0 rounded-full border-2 border-amber-200 border-t-amber-500 animate-spin" />
                      <SparkleIcon className="absolute inset-0 w-5 h-5 text-amber-500 animate-pulse" />
                    </div>
                  ) : recipeForm.url.startsWith(HTTP_PROTOCOL) &&
                    recipeForm.metadata ? (
                    <CheckIcon className="w-5 h-5 text-green-500" />
                  ) : (
                    <LinkIcon className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {recipeForm.fetchingMetadata
                  ? t('recipes.scanning')
                  : recipeForm.url.startsWith(HTTP_PROTOCOL)
                    ? t('recipes.pasteHint')
                    : t('recipes.urlHint')}
              </p>
            </div>

            {/* Loading indicator */}
            {(recipeForm.fetchingMetadata || recipeForm.generatingTags) && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <div className="relative w-6 h-6 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-2 border-amber-200 border-t-amber-500 animate-spin" />
                  <SparkleIcon className="w-4 h-4 text-amber-500 animate-pulse" />
                </div>
                <span className="text-sm text-amber-800">
                  {recipeForm.generatingTags
                    ? t('recipes.generatingTags')
                    : t('recipes.scanning')}
                </span>
              </div>
            )}

            {/* Fetch error */}
            {recipeForm.fetchError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {recipeForm.fetchError}
              </div>
            )}

            {/* Metadata preview */}
            {recipeForm.metadata &&
              (recipeForm.metadata.recipe || recipeForm.metadata.image) && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <RecipePreviewCard
                    metadata={recipeForm.metadata}
                    onClear={() => recipeForm.setMetadata(null)}
                  />
                </div>
              )}

            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="drawer-title">{t('recipes.titleLabel')}</Label>
              <Input
                id="drawer-title"
                value={recipeForm.title}
                onChange={(e) => {
                  recipeForm.setTitle(e.target.value)
                  recipeForm.setTitleDirty(true)
                }}
                onBlur={recipeForm.handleTitleBlur}
                required
                placeholder={t('recipes.titlePlaceholder')}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="drawer-description">
                {t('recipes.descriptionLabel')}
              </Label>
              <textarea
                id="drawer-description"
                value={recipeForm.description}
                onChange={(e) => recipeForm.setDescription(e.target.value)}
                placeholder={t('recipes.descriptionPlaceholder')}
                rows={2}
                className="flex w-full rounded-xl border border-input bg-input/30 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {/* Tags */}
            <TagSelector
              selectedTags={recipeForm.selectedTags}
              onChange={recipeForm.setSelectedTags}
            />

            {/* Save recipe & assign */}
            <Button
              className="w-full"
              onClick={() => recipeForm.handleSave()}
              disabled={
                recipeForm.saving ||
                recipeForm.fetchingMetadata ||
                recipeForm.generatingTags ||
                !recipeForm.title.trim()
              }
            >
              {recipeForm.saving
                ? t('common.saving')
                : t('planner.saveAndAssign')}
            </Button>
          </div>
        )}

        {/* Notes — always visible */}
        <div>
          <label className="text-sm font-medium mb-1.5 block">
            {t('planner.notes')}
          </label>
          <textarea
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            rows={2}
            placeholder={t('planner.anyNotes')}
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
          />
        </div>

        {/* Constraints — always visible */}
        {constraints.length > 0 && (
          <div>
            <label className="text-sm font-medium mb-2 block">
              {t('settings.constraints')}
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
        <Button variant="outline" className="flex-1" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button className="flex-1" onClick={onSave} disabled={saving}>
          {saving ? t('common.saving') : t('common.save')}
        </Button>
      </div>
    </>
  )
}

function getRecipeImage(recipe: RecipeData): string | null {
  const img = recipe.metadata?.image || recipe.metadata?.recipe?.image
  if (!img) return null
  return Array.isArray(img) ? img[0] : img
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function RecipePreviewCard({
  metadata,
  onClear,
}: {
  metadata: RecipeMetadata
  onClear: () => void
}) {
  const { t } = useTranslation()
  const recipe = metadata.recipe
  const imageUrl = metadata.image || recipe?.image

  return (
    <div className="relative rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 overflow-hidden">
      <button
        onClick={onClear}
        className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/80 hover:bg-white shadow-sm transition-colors"
        title="Clear fetched data"
      >
        <XIcon className="w-3.5 h-3.5" />
      </button>

      {imageUrl && (
        <div className="h-28 overflow-hidden">
          <img
            src={Array.isArray(imageUrl) ? imageUrl[0] : imageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <SparkleIcon className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[10px] font-medium text-amber-700 uppercase tracking-wide">
            {t('recipes.aiScanned')}
          </span>
        </div>

        {recipe?.name && (
          <h4 className="font-semibold text-sm text-foreground mb-0.5">
            {recipe.name}
          </h4>
        )}
        {recipe?.description && (
          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
            {recipe.description}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {recipe?.totalTime && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white text-[10px] font-medium">
              {recipe.totalTime}
            </span>
          )}
          {recipe?.recipeYield && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white text-[10px] text-muted-foreground">
              {recipe.recipeYield}
            </span>
          )}
        </div>

        {recipe?.recipeIngredient && recipe.recipeIngredient.length > 0 && (
          <div className="mt-2 pt-2 border-t border-amber-200">
            <p className="text-[10px] font-medium text-amber-800 mb-1">
              {t('recipes.ingredients')} ({recipe.recipeIngredient.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {recipe.recipeIngredient.slice(0, 4).map((ing, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 rounded-full bg-white text-[10px] text-muted-foreground"
                >
                  {typeof ing === 'string' ? ing.slice(0, 18) : '...'}
                </span>
              ))}
              {recipe.recipeIngredient.length > 4 && (
                <span className="px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  +{recipe.recipeIngredient.length - 4} {t('recipes.more')}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function HomePage() {
  const { t } = useTranslation()
  const MONTH_KEYS = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ] as const
  const router = useRouter()
  const { week: weekStart } = Route.useSearch()

  const [view, setViewState] = useState<'week' | 'month'>('month')
  const [month, setMonthState] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  )

  const [home, setHome] = useState<{
    id: string
    name: string
    inviteCode: string
    role: string
    members: Array<{ id: string; name: string; email: string; role: string }>
  } | null>(null)

  const [mealPlan, setMealPlan] = useState<{
    plan: { id: string; weekStart: string }
    days: Array<MealPlanDay>
    role: string
    sharedFamilyIds: Array<string>
  } | null>(null)

  const [monthMealPlans, setMonthMealPlans] = useState<
    Record<string, Array<MealPlanDay>>
  >({})

  const [constraints, setConstraints] = useState<Array<Constraint>>([])
  const [dayTemplates, setDayTemplates] = useState<
    Array<{ dayOfWeek: number; constraintIds: Array<string> }>
  >([])
  const [subscriptions, setSubscriptions] = useState<
    Array<{ id: string; name: string }>
  >([])
  const [drawerRecipes, setDrawerRecipes] = useState<Array<RecipeData>>([])
  const [drawerRecipesLoading, setDrawerRecipesLoading] = useState(false)
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)

  const [tab, setTab] = useState<'planner' | 'members'>('planner')
  const [editingDay, setEditingDay] = useState<number | null>(null)
  const [pendingEditDay, setPendingEditDay] = useState<number | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [aiStartDate, setAiStartDate] = useState('')
  const [aiEndDate, setAiEndDate] = useState('')
  const [aiBudget, setAiBudget] = useState(2)
  const [aiHealthMode, setAiHealthMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')
  const [renameOpen, setRenameOpen] = useState(false)
  const renameInitialized = useRef(false)

  useEffect(() => {
    if (renameInitialized.current) return
    renameInitialized.current = true

    async function checkSetup() {
      const completed = await getHomeSetupCompleted()
      if (!completed) {
        setRenameOpen(true)
        markHomeSetupCompleted()
      }
    }
    checkSetup()
  }, [])
  const [copied, setCopied] = useState(false)

  const [editMeal, setEditMeal] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editRecipeUrl, setEditRecipeUrl] = useState('')
  const [editConstraintIds, setEditConstraintIds] = useState<Array<string>>([])

  async function load(retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const [h, mp, cs, templates, gs] =
          await Promise.all([
            getMyHome(),
            getHomeMealPlanWithSharing({ data: { weekStart } }),
            getMyConstraints(),
            getDayTemplates(),
            getMySubscriptions(),
          ])
        if (!h) {
          router.navigate({ to: '/register' })
          return
        }
        setHome(h as typeof home)
        setMealPlan(mp as typeof mealPlan)
        setConstraints(cs)
        setDayTemplates(
          templates.map((t) => ({
            dayOfWeek: t.dayOfWeek,
            constraintIds: JSON.parse(t.constraintIds) as Array<string>,
          })),
        )
        setSubscriptions(gs)

        if (view === 'month') {
          const mmp = await getHomeMealPlansForMonth({
            data: { year: month.getFullYear(), month: month.getMonth() + 1 },
          })
          setMonthMealPlans(mmp as typeof monthMealPlans)
        }
        return
      } catch (err) {
        console.error(`Load attempt ${attempt + 1} failed:`, err)
        if (attempt === retries) {
          console.error('Failed to load home data after retries:', err)
          if (!home) {
            router.navigate({ to: '/register' })
          }
        } else {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
        }
      }
    }
  }

  useEffect(() => {
    load()
  }, [weekStart, view, month])

  useEffect(() => {
    if (pendingEditDay !== null && mealPlan) {
      openEdit(pendingEditDay)
      setPendingEditDay(null)
    }
  }, [mealPlan, pendingEditDay])

  async function handleSaveDay() {
    if (!mealPlan || editingDay === null) return
    setSaving(true)
    try {
      await upsertHomeDayPlan({
        data: {
          weekStart,
          dayOfWeek: editingDay,
          mealName: editMeal || undefined,
          notes: editNotes || undefined,
          recipeUrl: editRecipeUrl || undefined,
          constraintIds: editConstraintIds,
        },
      })
      setEditingDay(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  function openEdit(dayOfWeek: number) {
    const day = mealPlan?.days.find((d) => d.dayOfWeek === dayOfWeek)
    const template = dayTemplates.find((t) => t.dayOfWeek === dayOfWeek)
    setEditMeal(day?.mealName ?? '')
    setEditNotes(day?.notes ?? '')
    setEditRecipeUrl(day?.recipeUrl ?? '')
    setEditConstraintIds(day?.constraintIds ?? template?.constraintIds ?? [])
    setEditingDay(dayOfWeek)

    // Load recipes and try to auto-match existing day plan
    setDrawerRecipesLoading(true)
    setSelectedRecipeId(null)
    getMyRecipes()
      .then((rs) => {
        const typedRecipes = rs as Array<RecipeData>
        setDrawerRecipes(typedRecipes)
        if (day?.recipeUrl) {
          const match = typedRecipes.find((r) => r.url === day.recipeUrl)
          setSelectedRecipeId(match?.id ?? null)
        } else if (day?.mealName) {
          const match = typedRecipes.find((r) => r.title === day.mealName)
          setSelectedRecipeId(match?.id ?? null)
        }
      })
      .finally(() => setDrawerRecipesLoading(false))
  }

  function handleSelectRecipe(id: string | null) {
    setSelectedRecipeId(id)
    if (id) {
      const recipe = drawerRecipes.find((r) => r.id === id)
      if (recipe) {
        setEditMeal(recipe.title)
        setEditRecipeUrl(recipe.url ?? '')
      }
    } else {
      setEditMeal('')
      setEditRecipeUrl('')
    }
  }

  function handleRecipeCreated(id: string, title: string, url: string | null) {
    setEditMeal(title)
    setEditRecipeUrl(url ?? '')
    setSelectedRecipeId(id)
    // Refresh recipes list so the new one appears
    getMyRecipes().then((rs) => setDrawerRecipes(rs as Array<RecipeData>))
  }

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
    const d = new Date(month)
    d.setMonth(d.getMonth() - 1)
    setMonthState(d)
  }
  const nextMonth = () => {
    const d = new Date(month)
    d.setMonth(d.getMonth() + 1)
    setMonthState(d)
  }
  const todayMonth = () => {
    setMonthState(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  }

  const setView = (newView: 'week' | 'month') => {
    setViewState(newView)
    if (newView === 'month') {
      const d = new Date(weekStart)
      setMonthState(new Date(d.getFullYear(), d.getMonth(), 1))
    }
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

  function isDateBeingGenerated(date: Date) {
    if (!aiLoading || !aiStartDate || !aiEndDate) return false
    const genStart = new Date(aiStartDate + 'T00:00:00')
    const genEnd = new Date(aiEndDate + 'T23:59:59')
    return date >= genStart && date <= genEnd
  }

  const isPastWeek = weekStart < currentWeekStart()

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

                  {dayTemplates.some((t) => t.constraintIds.length > 0) && (
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
                        alert(
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
                // Compute default date range
                const today = new Date()
                let startDate: Date | null = null

                // Scan forward from today to find first date without dinner
                for (let i = 0; i < 56; i++) {
                  const d = new Date(today)
                  d.setDate(d.getDate() + i)
                  const ws = new Date(d)
                  ws.setDate(ws.getDate() - ((ws.getDay() + 6) % 7))
                  const wsStr = ws.toISOString().slice(0, 10)
                  const dow = (d.getDay() + 6) % 7

                  let hasMeal = false
                  // Check current week's mealPlan
                  if (wsStr === weekStart && mealPlan) {
                    const day = mealPlan.days.find((dd) => dd.dayOfWeek === dow)
                    hasMeal = !!day?.mealName
                  }
                  // Check monthMealPlans
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

        {/* Planner tab */}
        {tab === 'planner' && view === 'month' && (
          <div className="mb-6">
            <p className="text-sm text-muted-foreground mb-4">
              {t(`months.${MONTH_KEYS[month.getMonth()]}`)}{' '}
              {month.getFullYear()}
            </p>
            <div className="grid grid-cols-7 gap-1 md:gap-2">
              {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map(
                (day) => (
                  <div
                    key={day}
                    className="text-center text-xs font-medium text-muted-foreground py-2"
                  >
                    {t(`days.${day}`)}
                  </div>
                ),
              )}
              {Array.from({ length: 42 }, (_, i) => {
                const firstOfMonth = new Date(
                  month.getFullYear(),
                  month.getMonth(),
                  1,
                )
                const startOffset = (firstOfMonth.getDay() + 6) % 7
                const dayNum = i - startOffset + 1
                const currentDate = new Date(
                  month.getFullYear(),
                  month.getMonth(),
                  dayNum,
                )
                const isCurrentMonth =
                  currentDate.getMonth() === month.getMonth()
                const today = new Date()
                const isToday =
                  currentDate.getDate() === today.getDate() &&
                  currentDate.getMonth() === today.getMonth() &&
                  currentDate.getFullYear() === today.getFullYear()

                const weekStart = new Date(currentDate)
                weekStart.setDate(
                  weekStart.getDate() - ((currentDate.getDay() + 6) % 7),
                )
                const weekStartStr = weekStart.toISOString().slice(0, 10)
                const dayOfWeek = (currentDate.getDay() + 6) % 7
                const weekDays = monthMealPlans[weekStartStr]
                const dayData = weekDays?.find((d) => d.dayOfWeek === dayOfWeek)
                const isGenerating = isDateBeingGenerated(currentDate)

                return (
                  <button
                    key={i}
                    onClick={() => {
                      const appDay = (currentDate.getDay() + 6) % 7
                      setPendingEditDay(appDay)
                      router.navigate({
                        to: '/',
                        search: { week: weekStartStr },
                      })
                    }}
                    className={cn(
                      'min-h-[60px] md:min-h-[80px] p-1.5 md:p-2 rounded-md border text-left transition-all',
                      isCurrentMonth ? 'bg-card' : 'bg-muted/30',
                      isToday
                        ? 'border-primary/60 ring-1 ring-primary/20'
                        : 'border-border hover:border-border/80',
                      isGenerating && 'animate-pulse',
                    )}
                  >
                    <span
                      className={cn(
                        'text-xs md:text-sm font-medium',
                        isCurrentMonth
                          ? 'text-foreground'
                          : 'text-muted-foreground/50',
                        isToday && 'text-primary',
                      )}
                    >
                      {dayNum > 0 &&
                      dayNum <=
                        new Date(
                          month.getFullYear(),
                          month.getMonth() + 1,
                          0,
                        ).getDate()
                        ? dayNum
                        : ''}
                    </span>
                    {isGenerating ? (
                      <div className="mt-1 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      </div>
                    ) : (
                      <>
                        {dayData?.mealName && isCurrentMonth && (
                          <p className="text-[10px] md:text-xs font-medium text-foreground mt-0.5 line-clamp-2">
                            {dayData.mealName}
                          </p>
                        )}
                        {dayData?.recipeUrl && isCurrentMonth && (
                          <ExternalLinkIcon className="w-2.5 h-2.5 text-muted-foreground mt-0.5" />
                        )}
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {tab === 'planner' && view === 'week' && (
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              {t('home.weekOf')} {weekDates[0].getDate()}.{' '}
              {t(`months.${MONTH_KEYS[weekDates[0].getMonth()]}`)}{' '}
              {weekDates[0].getFullYear()}
            </p>

            {/* Mobile: vertical day list */}
            <div className="md:hidden space-y-2 mb-6">
              {DAY_NAMES.map((dayName, i) => {
                const day = mealPlan.days.find((d) => d.dayOfWeek === i)
                const template = dayTemplates.find((t) => t.dayOfWeek === i)
                const effectiveConstraints = day?.constraintIds.length
                  ? day.constraintIds
                  : (template?.constraintIds ?? [])
                const date = weekDates[i]
                const isTodayExact = isToday(date)
                const isGenerating = isDateBeingGenerated(date)

                return (
                  <button
                    key={i}
                    onClick={() => openEdit(i)}
                    className={cn(
                      'w-full flex items-center gap-3 bg-card border rounded-lg px-3 py-3 text-left transition-colors active:bg-muted',
                      isTodayExact
                        ? 'border-primary/60 ring-1 ring-primary/20'
                        : 'border-border',
                      isGenerating && 'animate-pulse',
                    )}
                  >
                    <div className="w-11 shrink-0 text-center">
                      <p
                        className={cn(
                          'text-[10px] font-medium uppercase tracking-widest',
                          isTodayExact
                            ? 'text-primary'
                            : 'text-muted-foreground',
                        )}
                      >
                        {t(dayName)}
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

                    <div className="flex-1 min-w-0">
                      {isGenerating ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                          <span className="text-sm text-muted-foreground">
                            {t('planner.generating')}
                          </span>
                        </div>
                      ) : day?.mealName ? (
                        <p className="text-sm font-medium text-foreground truncate">
                          {day.mealName}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground/60 italic">
                          {t('planner.addDinner')}
                        </p>
                      )}
                      {effectiveConstraints.length > 0 && !isGenerating && (
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

                    {!isGenerating && (
                      <ChevronRightIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Desktop: 7-col grid */}
            <div className="hidden md:grid grid-cols-7 gap-3 mb-8">
              {DAY_NAMES.map((dayName, i) => {
                const day = mealPlan.days.find((d) => d.dayOfWeek === i)
                const template = dayTemplates.find((t) => t.dayOfWeek === i)
                const effectiveConstraints = day?.constraintIds.length
                  ? day.constraintIds
                  : (template?.constraintIds ?? [])
                const date = weekDates[i]
                const isTodayExact = isToday(date)
                const isGenerating = isDateBeingGenerated(date)

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
                      isGenerating && 'animate-pulse',
                    )}
                  >
                    <div className="mb-3">
                      <p
                        className={cn(
                          'text-xs font-medium uppercase tracking-widest',
                          isTodayExact
                            ? 'text-primary'
                            : 'text-muted-foreground',
                        )}
                      >
                        {t(dayName)}
                      </p>
                      <p className="text-lg font-display font-semibold leading-tight">
                        {date.getDate()}
                      </p>
                    </div>

                    <div className="min-h-[48px]">
                      {isGenerating ? (
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        </div>
                      ) : day?.mealName ? (
                        <p className="text-sm font-medium text-foreground leading-snug">
                          {day.mealName}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground/60 italic">
                          {t('planner.addDinner')}
                        </p>
                      )}
                    </div>

                    {!isGenerating && day?.recipeUrl && (
                      <a
                        href={day.recipeUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLinkIcon className="w-3 h-3" />
                        <span className="truncate">{day.recipeUrl}</span>
                      </a>
                    )}

                    {effectiveConstraints.length > 0 && !isGenerating && (
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

            {/* Members indicator */}
            <div className="mt-4 flex items-center gap-2 mb-6">
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

            {/* Subscribers - show who subscribes to this home */}
            {subscriptions.length > 0 && (
              <div className="border border-border rounded-lg p-4 md:p-5">
                <h2 className="text-sm font-semibold mb-3 text-foreground">
                  {t('planner.subscribers')}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {subscriptions.map((s) => (
                    <span
                      key={s.id}
                      className="px-3 py-1.5 rounded-md text-sm font-medium border bg-card text-foreground border-border"
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

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
            <DrawerForm
              editingDay={editingDay}
              editNotes={editNotes}
              setEditNotes={setEditNotes}
              editConstraintIds={editConstraintIds}
              setEditConstraintIds={setEditConstraintIds}
              constraints={constraints}
              saving={saving}
              onSave={handleSaveDay}
              onClose={() => setEditingDay(null)}
              recipes={drawerRecipes}
              recipesLoading={drawerRecipesLoading}
              selectedRecipeId={selectedRecipeId}
              setSelectedRecipeId={handleSelectRecipe}
              onRecipeCreated={handleRecipeCreated}
            />
          </div>

          {/* Desktop: right panel */}
          <div className="hidden md:flex fixed right-0 top-0 bottom-0 w-full max-w-md bg-card border-l border-border flex-col shadow-2xl z-[70]">
            <DrawerForm
              editingDay={editingDay}
              editNotes={editNotes}
              setEditNotes={setEditNotes}
              editConstraintIds={editConstraintIds}
              setEditConstraintIds={setEditConstraintIds}
              constraints={constraints}
              saving={saving}
              onSave={handleSaveDay}
              onClose={() => setEditingDay(null)}
              recipes={drawerRecipes}
              recipesLoading={drawerRecipesLoading}
              selectedRecipeId={selectedRecipeId}
              setSelectedRecipeId={handleSelectRecipe}
              onRecipeCreated={handleRecipeCreated}
            />
          </div>
        </>
      )}
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
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" strokeLinecap="round" />
    </svg>
  )
}
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  )
}
function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        d="M19 12H5M12 19l-7-7 7-7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
      <path
        d="M20 6 9 17l-5-5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function LinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
        strokeLinecap="round"
      />
      <path
        d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
        strokeLinecap="round"
      />
    </svg>
  )
}
