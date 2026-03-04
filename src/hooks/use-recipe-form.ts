import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  fetchRecipeMetadata,
  generateRecipeTags,
  saveRecipe,
} from '@/lib/server/recipes'

const URL_PREFIX = 'http'
const ERROR_KEY = 'error'

export type RecipeMetadata = {
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

export type RecipeData = {
  id: string
  title: string
  url: string | null
  description: string | null
  tags: Array<string>
  metadata: RecipeMetadata | null
}

type UseRecipeFormOptions = {
  onSaved?: (id: string) => void
}

export function useRecipeForm(options?: UseRecipeFormOptions) {
  const { t, i18n } = useTranslation()

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
  const editingRef = useRef<RecipeData | null>(null)

  function reset() {
    setTitle('')
    setTitleDirty(false)
    setUrl('')
    setDescription('')
    setSelectedTags([])
    setMetadata(null)
    setFetchError(null)
    setSaving(false)
    editingRef.current = null
  }

  function loadFromExisting(recipe: RecipeData) {
    editingRef.current = recipe
    setTitle(recipe.title)
    setTitleDirty(false)
    setUrl(recipe.url ?? '')
    setDescription(recipe.description ?? '')
    setSelectedTags(recipe.tags)
    setMetadata(recipe.metadata)
    setFetchError(null)
  }

  async function generateTagsForTitle(titleOverride?: string) {
    const candidateTitle = (titleOverride ?? title).trim()
    if (!candidateTitle || selectedTags.length > 0) return
    if (generatingTags) return

    setGeneratingTags(true)
    try {
      const result = (await generateRecipeTags({
        data: {
          title: candidateTitle,
          description: description || undefined,
          language: i18n.language,
        },
      })) as { tags?: Array<string>; error?: string }

      if (result.tags && result.tags.length > 0) {
        setSelectedTags(result.tags)
      }
    } catch (e) {
      console.error('AI tagging error:', e)
    } finally {
      setGeneratingTags(false)
    }
  }

  async function handleTitleBlur() {
    if (!titleDirty || !title.trim()) return
    await generateTagsForTitle()
  }

  async function handleUrlChange(value: string) {
    setUrl(value)
    setFetchError(null)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (!value || !value.startsWith(URL_PREFIX)) {
      setMetadata(null)
      return
    }

    const editing = editingRef.current
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

              if (aiResult && aiResult.tags && aiResult.tags.length > 0) {
                setSelectedTags(aiResult.tags)
              } else {
                setSelectedTags([])
              }
            } catch (e) {
              console.error('AI error:', e)
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

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setSaving(true)
    try {
      const id = await saveRecipe({
        data: {
          id: editingRef.current?.id,
          title,
          url: url || undefined,
          description: description || undefined,
          tags: selectedTags,
          metadata,
        },
      })
      options?.onSaved?.(id)
      return id
    } finally {
      setSaving(false)
    }
  }

  return {
    title,
    setTitle,
    titleDirty,
    setTitleDirty,
    url,
    setUrl,
    description,
    setDescription,
    selectedTags,
    setSelectedTags,
    saving,
    fetchingMetadata,
    generatingTags,
    metadata,
    setMetadata,
    fetchError,
    handleUrlChange,
    generateTagsForTitle,
    handleTitleBlur,
    handleSave,
    reset,
    loadFromExisting,
  }
}
