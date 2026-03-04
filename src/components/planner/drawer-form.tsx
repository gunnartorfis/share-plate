import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RecipePreviewCard } from './recipe-preview-card'
import { DAY_FULL } from './types'
import type { Dispatch, SetStateAction } from 'react'
import type { Constraint } from '@/lib/db/schema'
import type { RecipeData } from '@/hooks/use-recipe-form'
import { useRecipeForm } from '@/hooks/use-recipe-form'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { TagSelector } from '@/components/ui/tag-selector'
import {
  ArrowLeftIcon,
  CheckIcon,
  LinkIcon,
  PlusIcon,
  SearchIcon,
  SparkleIcon,
  XIcon,
} from '@/components/ui/icons'

const URL_PREFIX = 'http'

export type DrawerFormProps = {
  editingDay: number
  weekStart: string
  /** Meal name derived from recipe selection (visible but read-only in form) */
  meal: string
  /** Recipe URL derived from recipe selection (visible but read-only in form) */
  recipeUrl: string
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

export function DrawerForm({
  editingDay,
  weekStart,
  meal,
  recipeUrl,
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
  const { t, i18n } = useTranslation()
  const [formMode, setFormMode] = useState<'search' | 'create'>('search')
  const [searchQuery, setSearchQuery] = useState('')

  const fullDate = (() => {
    const d = new Date(weekStart + 'T12:00:00')
    d.setDate(d.getDate() + editingDay)
    return `${t(DAY_FULL[editingDay])}, ${d.toLocaleDateString(i18n.language === 'is' ? 'is-IS' : 'en-GB', { day: 'numeric', month: 'long' })}`
  })()

  const recipeForm = useRecipeForm({
    onSaved: (id) => {
      const title = recipeForm.title
      const url = recipeForm.url || null
      onRecipeCreated(id, title, url)
      setFormMode('search')
      recipeForm.reset()
    },
  })

  const filteredRecipes = recipes.filter((r) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      r.title.toLowerCase().includes(q) ||
      r.tags.some((tag) => tag.toLowerCase().includes(q))
    )
  })

  const constraintsBlock =
    constraints.length > 0 ? (
      <div className="space-y-2 rounded-2xl border border-border/70 bg-card/85 p-4 shadow-sm">
        <label className="mb-2 block text-sm font-medium">
          {t('settings.constraints')}
        </label>
        <Separator className="mb-3" />
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
                className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-sm font-medium transition-all"
                style={
                  active
                    ? {
                        backgroundColor: c.color + '22',
                        color: c.color,
                        borderColor: c.color,
                      }
                    : undefined
                }
              >
                {c.emoji && <span>{c.emoji}</span>}
                {c.name}
              </button>
            )
          })}
        </div>
      </div>
    ) : null

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-24 h-52 w-52 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute -left-16 top-44 h-44 w-44 rounded-full bg-accent/14 blur-3xl" />
      </div>

      <div className="relative shrink-0 border-b border-border/70 bg-background/85 px-5 py-4 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <Badge variant="outline" className="bg-background/70">
              {t('planner.dinner')}
            </Badge>
            <h2 className="text-xl font-display font-semibold leading-tight">
              {fullDate}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-border/70 bg-background/80 p-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 px-5 py-5">
        {formMode === 'search' && (
          <div className="flex h-full min-h-0 flex-col gap-4">
            <div className="flex min-h-[24rem] flex-1 flex-col gap-3 rounded-2xl border border-border/70 bg-card/85 p-4 shadow-sm md:min-h-[30rem]">
              <label className="mb-1.5 block text-sm font-medium">
                {t('planner.selectRecipe')}
              </label>

              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('planner.searchRecipes')}
                  className="h-10 rounded-xl border-border/80 bg-background/80 pl-9"
                  autoFocus
                />
              </div>

              {meal && !selectedRecipeId ? (
                <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-muted/45 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{meal}</p>
                    {recipeUrl && (
                      <p className="truncate text-xs text-muted-foreground">
                        {safeHostname(recipeUrl)}
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="flex-1 space-y-1 overflow-y-auto rounded-xl border border-border/65 bg-background/70 p-1.5">
                {recipesLoading && recipes.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <p className="text-sm">{t('common.loading')}</p>
                  </div>
                ) : filteredRecipes.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
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
                        onClick={() => {
                          setSelectedRecipeId(isSelected ? null : recipe.id)
                          if (!isSelected) {
                            setSearchQuery('')
                          }
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg border p-2.5 text-left transition-all',
                          isSelected
                            ? 'border-primary/45 bg-primary/8 shadow-sm'
                            : 'border-transparent hover:border-primary/25 hover:bg-accent/45',
                        )}
                      >
                        {imageUrl && (
                          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-muted">
                            <img
                              src={imageUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium leading-tight">
                            {recipe.title}
                          </p>
                          {recipe.tags.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {recipe.tags.slice(0, 2).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {isSelected && (
                          <CheckIcon className="h-4 w-4 shrink-0 text-primary" />
                        )}
                      </button>
                    )
                  })
                )}
              </div>

              <button
                onClick={() => {
                  const maybePrefill = searchQuery.trim()
                  recipeForm.reset()
                if (filteredRecipes.length === 0 && maybePrefill) {
                  recipeForm.setTitle(maybePrefill)
                  recipeForm.setTitleDirty(true)
                  void recipeForm.generateTagsForTitle(maybePrefill)
                }
                setFormMode('create')
              }}
                className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-background/60 p-3 text-muted-foreground transition-all hover:border-primary/45 hover:bg-accent/40 hover:text-foreground"
              >
                <PlusIcon className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {t('planner.createNewRecipe')}
                </span>
              </button>
            </div>
            {constraintsBlock}
          </div>
        )}

        {formMode === 'create' && (
          <div className="h-full min-h-0 overflow-y-auto space-y-4">
            <div className="space-y-4 rounded-2xl border border-border/70 bg-card/85 p-4 shadow-sm">
              <button
                onClick={() => setFormMode('search')}
                className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                {t('planner.backToSearch')}
              </button>

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
                    'h-10 rounded-xl border-border/80 bg-background/80 pr-10',
                    recipeForm.fetchingMetadata &&
                      'border-primary/55 ring-2 ring-primary/20',
                  )}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {recipeForm.fetchingMetadata ? (
                    <div className="relative h-5 w-5">
                      <div className="absolute inset-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                      <SparkleIcon className="absolute inset-0 h-5 w-5 animate-pulse text-primary" />
                    </div>
                  ) : recipeForm.url.startsWith(URL_PREFIX) &&
                    recipeForm.metadata ? (
                    <CheckIcon className="h-5 w-5 text-green-500" />
                  ) : (
                    <LinkIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {recipeForm.fetchingMetadata
                  ? t('recipes.scanning')
                  : recipeForm.url.startsWith(URL_PREFIX)
                    ? t('recipes.pasteHint')
                    : t('recipes.urlHint')}
              </p>
            </div>

            {(recipeForm.fetchingMetadata || recipeForm.generatingTags) && (
              <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/8 p-3">
                <div className="relative flex h-6 w-6 items-center justify-center">
                  <div className="absolute inset-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                  <SparkleIcon className="h-4 w-4 animate-pulse text-primary" />
                </div>
                <span className="text-sm text-primary">
                  {recipeForm.generatingTags
                    ? t('recipes.generatingTags')
                    : t('recipes.scanning')}
                </span>
              </div>
            )}

            {recipeForm.fetchError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {recipeForm.fetchError}
              </div>
            )}

            {recipeForm.metadata &&
              (recipeForm.metadata.recipe || recipeForm.metadata.image) && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <RecipePreviewCard
                    metadata={recipeForm.metadata}
                    onClear={() => recipeForm.setMetadata(null)}
                  />
                </div>
              )}

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
                className="flex w-full rounded-xl border border-input/80 bg-background/80 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <TagSelector
              selectedTags={recipeForm.selectedTags}
              onChange={recipeForm.setSelectedTags}
            />

            <Button
              className="h-11 w-full"
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
            {constraintsBlock}
          </div>
        )}
      </div>

      <div className="relative shrink-0 border-t border-border/70 bg-background/85 px-5 py-4 backdrop-blur-xl">
        <div className="flex gap-2">
          <Button variant="outline" className="h-11 flex-1" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button className="h-11 flex-1" onClick={onSave} disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  )
}
