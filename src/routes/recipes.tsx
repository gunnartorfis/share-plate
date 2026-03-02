import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppLayout } from '@/components/layout/app-layout'
import {
  deleteRecipe,
  fetchRecipeMetadata,
  generateRecipeTags,
  getMyRecipes,
  saveRecipe,
} from '@/lib/server/recipes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TagSelector } from '@/components/ui/tag-selector'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/recipes')({ component: RecipesPage })

const HTTP_PROTOCOL = 'http'
const ERROR_KEY = 'error'

type RecipeData = {
  id: string
  title: string
  url: string | null
  description: string | null
  tags: Array<string>
  metadata: RecipeMetadata | null
}

type RecipeMetadata = {
  title?: string
  description?: string
  image?: string
  keywords?: string | Array<string>
  recipe?: {
    name?: string
    description?: string
    image?: string | Array<string>
    prepTime?: string
    cookTime?: string
    totalTime?: string
    recipeYield?: string | number
    recipeIngredient?: Array<string>
    recipeInstructions?: Array<string> | Array<{ text?: string }>
    nutrition?: { calories?: string }
    keywords?: string | Array<string>
    author?: string
    publishedAt?: string
  }
}

function RecipesPage() {
  const { t, i18n } = useTranslation()
  const [recipes, setRecipes] = useState<Array<RecipeData>>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<RecipeData | null>(null)

  const [title, setTitle] = useState('')
  const [titleDirty, setTitleDirty] = useState(false)
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [selectedTags, setSelectedTags] = useState<Array<string>>([])
  const [saving, setSaving] = useState(false)
  const [fetchingMetadata, setFetchingMetadata] = useState(false)
  const [generatingTags, setGeneratingTags] = useState(false)
  const [metadata, setMetadata] = useState<RecipeMetadata | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function load() {
    const rs = await getMyRecipes()
    setRecipes(rs as Array<RecipeData>)
  }

  useEffect(() => {
    load()
  }, [])

  function openNew() {
    setEditing(null)
    setTitle('')
    setTitleDirty(false)
    setUrl('')
    setDescription('')
    setSelectedTags([])
    setMetadata(null)
    setFetchError(null)
    setShowForm(true)
  }

  function openEdit(recipe: RecipeData) {
    setEditing(recipe)
    setTitle(recipe.title)
    setTitleDirty(false)
    setUrl(recipe.url ?? '')
    setDescription(recipe.description ?? '')
    setSelectedTags(recipe.tags)
    setMetadata(recipe.metadata)
    setFetchError(null)
    setShowForm(true)
  }

  async function handleTitleBlur() {
    if (!titleDirty || !title.trim() || selectedTags.length > 0) return
    if (generatingTags) return

    setGeneratingTags(true)
    try {
      const result = (await generateRecipeTags({
        data: {
          title: title.trim(),
          description: description || undefined,
          language: i18n.language,
        },
      })) as { tags?: Array<string>; error?: string }

      if (result && result.tags && result.tags.length > 0) {
        setSelectedTags(result.tags)
      }
    } catch (e) {
      console.error('AI tagging error:', e)
    } finally {
      setGeneratingTags(false)
    }
  }

  async function handleUrlChange(value: string) {
    setUrl(value)
    setFetchError(null)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (!value || !value.startsWith(HTTP_PROTOCOL)) {
      setMetadata(null)
      return
    }

    if (editing?.url === value && editing.metadata) {
      setMetadata(editing.metadata)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setFetchingMetadata(true)
      try {
        const result = (await fetchRecipeMetadata({
          data: { url: value },
        })) as RecipeMetadata

        if (result && ERROR_KEY in result) {
          setFetchError(t('recipes.fetchError'))
          setMetadata(null)
        } else if (result && (result.title || result.recipe)) {
          setMetadata(result)
          if (!title && result.title) {
            setTitle(result.title)
          }
          if (!description && result.description) {
            setDescription(result.description)
          }
          if (!description && result.recipe?.description) {
            setDescription(result.recipe.description)
          }
          if (selectedTags.length === 0 && result.recipe?.keywords) {
            const keywords = result.recipe.keywords
            if (typeof keywords === 'string') {
              setSelectedTags(
                keywords
                  .split(',')
                  .map((t: string) => t.trim())
                  .filter(Boolean),
              )
            } else if (Array.isArray(keywords)) {
              setSelectedTags(
                keywords.map((t: string) => t.trim()).filter(Boolean),
              )
            }
          }
          if (selectedTags.length === 0 && result.keywords) {
            const keywords = result.keywords
            if (typeof keywords === 'string') {
              setSelectedTags(
                keywords
                  .split(',')
                  .map((t: string) => t.trim())
                  .filter(Boolean),
              )
            } else if (Array.isArray(keywords)) {
              setSelectedTags(
                keywords.map((t: string) => t.trim()).filter(Boolean),
              )
            }
          }

          if (selectedTags.length === 0) {
            console.log('[DEBUG] No tags found in metadata, calling AI...')
            setGeneratingTags(true)
            try {
              const aiResult = (await generateRecipeTags({
                data: {
                  title: result.title || result.recipe?.name || '',
                  description: result.description || result.recipe?.description,
                  ingredients: result.recipe?.recipeIngredient,
                  url: value,
                  language: i18n.language,
                },
              })) as { tags?: Array<string>; error?: string }

              console.log('[DEBUG] AI result:', aiResult)

              if (aiResult && aiResult.tags && aiResult.tags.length > 0) {
                console.log('[DEBUG] Setting tags:', aiResult.tags)
                setSelectedTags(aiResult.tags)
              } else {
                console.log('[DEBUG] AI returned no tags')
              }
            } catch (e) {
              console.error('[DEBUG] AI error:', e)
            } finally {
              setGeneratingTags(false)
            }
          }
        } else {
          setMetadata(null)
        }
      } catch {
        setFetchError('Failed to fetch recipe')
        setMetadata(null)
      } finally {
        setFetchingMetadata(false)
      }
    }, 800)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await saveRecipe({
        data: {
          id: editing?.id,
          title,
          url: url || undefined,
          description: description || undefined,
          tags: selectedTags,
          metadata,
        },
      })
      await load()
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t('recipes.deleteConfirm'))) return
    await deleteRecipe({ data: { id } })
    await load()
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

        {recipes.length === 0 && !showForm ? (
          <div className="text-center py-16 text-muted-foreground">
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                <CookbookIcon className="w-8 h-8 text-amber-600" />
              </div>
            </div>
            <p className="text-lg font-display font-medium mb-1">
              {t('recipes.noRecipes')}
            </p>
            <p className="text-sm mb-4">{t('recipes.noRecipesDesc')}</p>
            <Button onClick={openNew}>{t('recipes.addFirst')}</Button>
          </div>
        ) : (
          <RecipeSection
            recipes={recipes}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
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
                        value={url}
                        onChange={(e) => handleUrlChange(e.target.value)}
                        placeholder="https://..."
                        className={cn(
                          'pr-10 h-12 text-base transition-all',
                          fetchingMetadata &&
                            'border-amber-400 ring-2 ring-amber-100',
                        )}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {fetchingMetadata ? (
                          <div className="relative w-5 h-5">
                            <div className="absolute inset-0 rounded-full border-2 border-amber-200 border-t-amber-500 animate-spin" />
                            <SparkleIcon className="absolute inset-0 w-5 h-5 text-amber-500 animate-pulse" />
                          </div>
                        ) : url.startsWith(HTTP_PROTOCOL) && metadata ? (
                          <CheckIcon className="w-5 h-5 text-green-500" />
                        ) : (
                          <LinkIcon className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {fetchingMetadata
                        ? t('recipes.scanning')
                        : url.startsWith(HTTP_PROTOCOL)
                          ? t('recipes.pasteHint')
                          : t('recipes.urlHint')}
                    </p>
                  </div>

                  {(fetchingMetadata || generatingTags) && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <div className="relative w-6 h-6">
                        <div className="absolute inset-0 rounded-full border-2 border-amber-200 border-t-amber-500 animate-spin" />
                        <SparkleIcon className="absolute inset-0 w-4 h-4 text-amber-500 animate-pulse" />
                      </div>
                      <span className="text-sm text-amber-800">
                        {generatingTags
                          ? t('recipes.generatingTags')
                          : t('recipes.scanning')}
                      </span>
                    </div>
                  )}

                  {fetchError && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                      {fetchError}
                    </div>
                  )}

                  {metadata && (metadata.recipe || metadata.image) && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <RecipePreviewCard
                        metadata={metadata}
                        onClear={() => setMetadata(null)}
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="title">{t('recipes.titleLabel')}</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value)
                        setTitleDirty(true)
                      }}
                      onBlur={handleTitleBlur}
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
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t('recipes.descriptionPlaceholder')}
                      rows={3}
                      className="flex w-full rounded-xl border border-input bg-input/30 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>

                  <TagSelector
                    selectedTags={selectedTags}
                    onChange={setSelectedTags}
                  />
                </div>
              </form>
              <div className="shrink-0 px-6 py-4 border-t border-border flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  form="recipe-form"
                  className="flex-1"
                  disabled={saving || fetchingMetadata || generatingTags}
                >
                  {saving ? t('common.saving') : t('common.save')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
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

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
    </svg>
  )
}

function CookbookIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeLinecap="round" />
      <path
        d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 7h8M8 11h8M8 15h4" strokeLinecap="round" />
    </svg>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" strokeLinecap="round" />
    </svg>
  )
}

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="7" r="4" />
      <path
        d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
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

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <polyline points="3 6 5 6 21 6" />
      <path
        d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
