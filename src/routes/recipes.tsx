import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RecipeData, RecipeMetadata } from '@/hooks/use-recipe-form'
import { AppLayout } from '@/components/layout/app-layout'
import {
  deleteRecipe,
  getCuratedQuickAdds,
  getMyRecipes,
  quickAddCuratedRecipe,
} from '@/lib/server/recipes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TagSelector } from '@/components/ui/tag-selector'
import { cn } from '@/lib/utils'
import { useRecipeForm } from '@/hooks/use-recipe-form'
import {
  CheckIcon,
  ClockIcon,
  CookbookIcon,
  EditIcon,
  FlameIcon,
  LinkIcon,
  PlusIcon,
  SparkleFilledIcon as SparkleIcon,
  TrashIcon,
  UsersIcon,
  XIcon,
} from '@/components/ui/icons'

export const Route = createFileRoute('/recipes')({ component: RecipesPage })

const URL_PREFIX = 'http'

type CuratedQuickAdd = {
  id: string
  title: string
  description: string | null
  tags: Array<string>
  stars: number
}

function RecipesPage() {
  const { t } = useTranslation()
  const [recipes, setRecipes] = useState<Array<RecipeData>>([])
  const [curatedQuickAdds, setCuratedQuickAdds] = useState<
    Array<CuratedQuickAdd>
  >([])
  const [loading, setLoading] = useState(true)
  const [addingQuickAddId, setAddingQuickAddId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<RecipeData | null>(null)

  const form = useRecipeForm({
    onSaved: async () => {
      await load()
      setShowForm(false)
    },
  })

  async function load() {
    setLoading(true)
    try {
      const [myRecipes, quickAdds] = await Promise.all([
        getMyRecipes(),
        getCuratedQuickAdds(),
      ])
      setRecipes(myRecipes as Array<RecipeData>)
      setCuratedQuickAdds(quickAdds as Array<CuratedQuickAdd>)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function openNew() {
    setEditing(null)
    form.reset()
    setShowForm(true)
  }

  function openEdit(recipe: RecipeData) {
    setEditing(recipe)
    form.loadFromExisting(recipe)
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    await form.handleSave()
  }

  async function handleDelete(id: string) {
    if (!confirm(t('recipes.deleteConfirm'))) return
    await deleteRecipe({ data: { id } })
    await load()
  }

  async function handleQuickAdd(curatedRecipeId: string) {
    setAddingQuickAddId(curatedRecipeId)
    try {
      await quickAddCuratedRecipe({ data: { curatedRecipeId } })
      await load()
    } finally {
      setAddingQuickAddId(null)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">
              {t('recipes.title')}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t('recipes.subtitle')}
            </p>
          </div>
          <Button onClick={openNew}>{t('recipes.addRecipe')}</Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : recipes.length === 0 && !showForm ? (
          <div className="space-y-6 py-6">
            <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-orange-50 to-background p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <CookbookIcon className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-lg font-display font-semibold text-foreground">
                    {t('recipes.noRecipes')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('recipes.noRecipesDesc')}
                  </p>
                </div>
              </div>
              <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                <p>{t('recipes.emptyReasonCurated')}</p>
                <p>{t('recipes.emptyReasonGenerated')}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={openNew}>{t('recipes.addFirst')}</Button>
                <Button variant="outline" onClick={openNew}>
                  {t('recipes.addRecipe')}
                </Button>
              </div>
            </div>

            <QuickAddPanel
              recipes={curatedQuickAdds}
              addingQuickAddId={addingQuickAddId}
              onQuickAdd={handleQuickAdd}
              mode="full"
            />
          </div>
        ) : (
          <div className="space-y-6">
            <QuickAddPanel
              recipes={curatedQuickAdds}
              addingQuickAddId={addingQuickAddId}
              onQuickAdd={handleQuickAdd}
              mode="compact"
            />
            <RecipeSection
              recipes={recipes}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 z-[60] flex">
            <div
              className="flex-1 bg-black/20 backdrop-blur-sm"
              onClick={() => setShowForm(false)}
            />
            <div className="w-full max-w-lg bg-card border-l border-border h-full flex flex-col shadow-2xl">
              <div className="px-6 py-5 border-b border-border flex items-center justify-between">
                <h2 className="text-lg font-display font-semibold">
                  {editing
                    ? t('recipes.editRecipe')
                    : t('recipes.addRecipeTitle')}
                </h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <form
                id="recipe-form"
                onSubmit={handleSave}
                className="flex-1 min-h-0 overflow-y-auto"
              >
                <div className="p-6 space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="url" className="text-base font-medium">
                      {t('recipes.urlLabel')}
                    </Label>
                    <div className="relative">
                      <Input
                        id="url"
                        type="url"
                        value={form.url}
                        onChange={(e) => form.handleUrlChange(e.target.value)}
                        placeholder="https://..."
                        className={cn(
                          'pr-10 h-12 text-base transition-all',
                          form.fetchingMetadata &&
                            'border-amber-400 ring-2 ring-amber-100',
                        )}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {form.fetchingMetadata ? (
                          <div className="relative w-5 h-5">
                            <div className="absolute inset-0 rounded-full border-2 border-amber-200 border-t-amber-500 animate-spin" />
                            <SparkleIcon className="absolute inset-0 w-5 h-5 text-amber-500 animate-pulse" />
                          </div>
                        ) : form.url.startsWith(URL_PREFIX) && form.metadata ? (
                          <CheckIcon className="w-5 h-5 text-green-500" />
                        ) : (
                          <LinkIcon className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {form.fetchingMetadata
                        ? t('recipes.scanning')
                        : form.url.startsWith(URL_PREFIX)
                          ? t('recipes.pasteHint')
                          : t('recipes.urlHint')}
                    </p>
                  </div>

                  {(form.fetchingMetadata || form.generatingTags) && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <div className="relative w-6 h-6 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-2 border-amber-200 border-t-amber-500 animate-spin" />
                        <SparkleIcon className="w-4 h-4 text-amber-500 animate-pulse" />
                      </div>
                      <span className="text-sm text-amber-800">
                        {form.generatingTags
                          ? t('recipes.generatingTags')
                          : t('recipes.scanning')}
                      </span>
                    </div>
                  )}

                  {form.fetchError && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                      {form.fetchError}
                    </div>
                  )}

                  {form.metadata &&
                    (form.metadata.recipe || form.metadata.image) && (
                      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <RecipePreviewCard
                          metadata={form.metadata}
                          onClear={() => form.setMetadata(null)}
                        />
                      </div>
                    )}

                  <div className="space-y-1.5">
                    <Label htmlFor="title">{t('recipes.titleLabel')}</Label>
                    <Input
                      id="title"
                      value={form.title}
                      onChange={(e) => {
                        form.setTitle(e.target.value)
                        form.setTitleDirty(true)
                      }}
                      onBlur={form.handleTitleBlur}
                      required
                      placeholder={t('recipes.titlePlaceholder')}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="description">
                      {t('recipes.descriptionLabel')}
                    </Label>
                    <textarea
                      id="description"
                      value={form.description}
                      onChange={(e) => form.setDescription(e.target.value)}
                      placeholder={t('recipes.descriptionPlaceholder')}
                      rows={3}
                      className="flex w-full rounded-xl border border-input bg-input/30 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>

                  <TagSelector
                    selectedTags={form.selectedTags}
                    onChange={form.setSelectedTags}
                  />
                </div>
              </form>
              <div className="shrink-0 px-6 py-4 border-t border-border flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowForm(false)}
                  disabled={form.saving}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  form="recipe-form"
                  className="flex-1"
                  disabled={
                    form.saving || form.fetchingMetadata || form.generatingTags
                  }
                >
                  {form.saving ? t('common.saving') : t('common.save')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function QuickAddPanel({
  recipes,
  addingQuickAddId,
  onQuickAdd,
  mode,
}: {
  recipes: Array<CuratedQuickAdd>
  addingQuickAddId: string | null
  onQuickAdd: (id: string) => void
  mode: 'full' | 'compact'
}) {
  const { t } = useTranslation()
  if (recipes.length === 0) return null

  if (mode === 'compact') {
    return (
      <div className="rounded-xl border border-border/70 bg-card/70 px-3 py-2.5">
        <div className="flex items-center gap-2 mb-2">
          <SparkleIcon className="w-3.5 h-3.5 text-amber-500" />
          <p className="text-xs font-medium text-muted-foreground">
            {t('recipes.quickAddCompactTitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {recipes.slice(0, 12).map((recipe) => (
            <QuickAddChip
              key={recipe.id}
              recipe={recipe}
              adding={addingQuickAddId === recipe.id}
              onQuickAdd={onQuickAdd}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-base font-display font-semibold">
            {t('recipes.quickAddTitle')}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('recipes.quickAddDesc')}
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {recipes.slice(0, 6).map((recipe) => (
          <QuickAddRecipeRow
            key={recipe.id}
            recipe={recipe}
            adding={addingQuickAddId === recipe.id}
            onQuickAdd={onQuickAdd}
          />
        ))}
      </div>
    </div>
  )
}

function QuickAddChip({
  recipe,
  adding,
  onQuickAdd,
}: {
  recipe: CuratedQuickAdd
  adding: boolean
  onQuickAdd: (id: string) => void
}) {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      disabled={adding}
      onClick={() => onQuickAdd(recipe.id)}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors',
        'border-border bg-background text-foreground hover:border-amber-300 hover:bg-amber-50',
      )}
    >
      <PlusIcon className="w-3 h-3" />
      <span>{recipe.title}</span>
      {adding && <span className="text-muted-foreground">{t('common.saving')}</span>}
    </button>
  )
}

function QuickAddRecipeRow({
  recipe,
  adding,
  onQuickAdd,
}: {
  recipe: CuratedQuickAdd
  adding: boolean
  onQuickAdd: (id: string) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="rounded-xl border border-border bg-background p-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{recipe.title}</p>
        {recipe.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {recipe.description}
          </p>
        )}
        <div className="flex flex-wrap gap-1 mt-2">
          {recipe.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground text-[10px]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
      <Button
        size="sm"
        variant="default"
        disabled={adding}
        onClick={() => onQuickAdd(recipe.id)}
        className="shrink-0"
      >
        <PlusIcon className="w-3.5 h-3.5 mr-1" />
        {adding ? t('common.saving') : t('recipes.quickAddAction')}
      </Button>
    </div>
  )
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
        <div className="h-32 overflow-hidden">
          <img
            src={Array.isArray(imageUrl) ? imageUrl[0] : imageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <SparkleIcon className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-medium text-amber-700 uppercase tracking-wide">
            {t('recipes.aiScanned')}
          </span>
        </div>

        {recipe?.name && (
          <h4 className="font-semibold text-foreground mb-1">{recipe.name}</h4>
        )}
        {recipe?.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
            {recipe.description}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {recipe?.totalTime && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white text-xs font-medium">
              <ClockIcon className="w-3 h-3" />
              {recipe.totalTime}
            </span>
          )}
          {recipe?.prepTime && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white text-xs text-muted-foreground">
              <ClockIcon className="w-3 h-3" />
              {t('recipes.prep')}: {recipe.prepTime}
            </span>
          )}
          {recipe?.cookTime && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white text-xs text-muted-foreground">
              <FlameIcon className="w-3 h-3" />
              {t('recipes.cook')}: {recipe.cookTime}
            </span>
          )}
          {recipe?.recipeYield && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white text-xs text-muted-foreground">
              <UsersIcon className="w-3 h-3" />
              {recipe.recipeYield}
            </span>
          )}
        </div>

        {recipe?.recipeIngredient && recipe.recipeIngredient.length > 0 && (
          <div className="mt-3 pt-3 border-t border-amber-200">
            <p className="text-xs font-medium text-amber-800 mb-1.5">
              {t('recipes.ingredients')} ({recipe.recipeIngredient.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {recipe.recipeIngredient.slice(0, 6).map((ing, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-full bg-white text-[10px] text-muted-foreground"
                >
                  {typeof ing === 'string' ? ing.slice(0, 20) : '...'}
                </span>
              ))}
              {recipe.recipeIngredient.length > 6 && (
                <span className="px-2 py-0.5 text-[10px] text-muted-foreground">
                  +{recipe.recipeIngredient.length - 6} {t('recipes.more')}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RecipeSection({
  recipes,
  onEdit,
  onDelete,
}: {
  recipes: Array<RecipeData>
  onEdit: (r: RecipeData) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="space-y-2">
      {recipes.map((recipe) => (
        <div
          key={recipe.id}
          className="flex items-start gap-3 bg-card border border-border rounded-lg p-4 group hover:border-amber-200 hover:shadow-sm transition-all cursor-pointer"
          onClick={() => onEdit(recipe)}
        >
          {recipe.metadata?.image && (
            <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-muted">
              <img
                src={
                  Array.isArray(recipe.metadata.image)
                    ? recipe.metadata.image[0]
                    : recipe.metadata.image
                }
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {recipe.url ? (
                <a
                  href={recipe.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-sm hover:text-primary transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  {recipe.title}
                </a>
              ) : (
                <span className="font-medium text-sm">{recipe.title}</span>
              )}
              {recipe.metadata?.recipe && (
                <span className="inline-flex items-center">
                  <SparkleIcon className="w-3 h-3 text-amber-500" />
                </span>
              )}
            </div>
            {recipe.url && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {recipe.url}
              </p>
            )}
            {recipe.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {recipe.description}
              </p>
            )}
            {recipe.metadata?.recipe && (
              <div className="flex items-center gap-2 mt-1.5">
                {recipe.metadata.recipe.totalTime && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <ClockIcon className="w-3 h-3" />
                    {recipe.metadata.recipe.totalTime}
                  </span>
                )}
                {recipe.metadata.recipe.recipeYield && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <UsersIcon className="w-3 h-3" />
                    {recipe.metadata.recipe.recipeYield}
                  </span>
                )}
              </div>
            )}
            {recipe.tags.length > 0 && (
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {recipe.tags.map((tag) => (
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
          <div
            className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => onEdit(recipe)}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded"
            >
              <EditIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(recipe.id)}
              className="p-1.5 text-muted-foreground hover:text-destructive rounded"
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
