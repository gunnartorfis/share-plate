import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppLayout } from '@/components/layout/app-layout'
import {
  deleteRecipe,
  fetchRecipeMetadata,
  getMyRecipes,
  saveRecipe,
} from '@/lib/server/recipes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/recipes')({ component: RecipesPage })

type RecipeData = {
  id: string
  title: string
  url: string | null
  description: string | null
  tags: Array<string>
  metadata: Record<string, unknown> | null
}

function RecipesPage() {
  const { t } = useTranslation()
  const [recipes, setRecipes] = useState<Array<RecipeData>>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<RecipeData | null>(null)

  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [tagsStr, setTagsStr] = useState('')
  const [saving, setSaving] = useState(false)
  const [fetchingMetadata, setFetchingMetadata] = useState(false)

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
    setUrl('')
    setDescription('')
    setTagsStr('')
    setShowForm(true)
  }

  function openEdit(recipe: RecipeData) {
    setEditing(recipe)
    setTitle(recipe.title)
    setUrl(recipe.url ?? '')
    setDescription(recipe.description ?? '')
    setTagsStr(recipe.tags.join(', '))
    setShowForm(true)
  }

  async function handleUrlBlur() {
    if (!url || !url.startsWith('http')) return
    if (editing?.url === url) return

    setFetchingMetadata(true)
    try {
      const metadata = (await fetchRecipeMetadata({ data: { url } })) as Record<
        string,
        unknown
      >
      if (metadata && typeof metadata === 'object' && !('error' in metadata)) {
        if (!title && typeof metadata.title === 'string') {
          setTitle(metadata.title)
        }
        if (!description && typeof metadata.description === 'string') {
          setDescription(metadata.description)
        }
      }
    } catch {
      // Ignore errors
    } finally {
      setFetchingMetadata(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const tags = tagsStr
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      let metadata: Record<string, unknown> | undefined
      if (url && url.startsWith('http')) {
        try {
          const fetched = (await fetchRecipeMetadata({
            data: { url },
          })) as Record<string, unknown>
          if (fetched && typeof fetched === 'object' && !('error' in fetched)) {
            metadata = fetched
          }
        } catch {
          // Ignore errors
        }
      }

      await saveRecipe({
        data: {
          id: editing?.id,
          title,
          url: url || undefined,
          description: description || undefined,
          tags,
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
            <div className="w-full max-w-md bg-card border-l border-border h-full flex flex-col shadow-2xl">
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
                className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="title">{t('recipes.titleLabel')}</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder={t('recipes.titlePlaceholder')}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="url">
                    {t('recipes.urlLabel')}
                    {fetchingMetadata && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {t('recipes.fetchingMetadata')}
                      </span>
                    )}
                  </Label>
                  <Input
                    id="url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onBlur={handleUrlBlur}
                    placeholder={t('recipes.urlPlaceholder')}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description">
                    {t('recipes.descriptionLabel')}
                  </Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('recipes.descriptionPlaceholder')}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tags">{t('recipes.tagsLabel')}</Label>
                  <Input
                    id="tags"
                    value={tagsStr}
                    onChange={(e) => setTagsStr(e.target.value)}
                    placeholder={t('recipes.tagsPlaceholder')}
                  />
                </div>
              </form>
              <div className="shrink-0 px-6 py-4 border-t border-border flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowForm(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  form="recipe-form"
                  className="flex-1"
                  disabled={saving}
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
          className="flex items-start gap-3 bg-card border border-border rounded-lg p-4 group"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {recipe.url ? (
                <a
                  href={recipe.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-sm hover:text-primary transition-colors"
                >
                  {recipe.title}
                </a>
              ) : (
                <span className="font-medium text-sm">{recipe.title}</span>
              )}
            </div>
            {recipe.url && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {recipe.url}
              </p>
            )}
            {recipe.description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {recipe.description}
              </p>
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
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
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
