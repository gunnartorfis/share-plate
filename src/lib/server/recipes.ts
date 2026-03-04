import { createServerFn } from '@tanstack/react-start'
import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { getDbWithSchema } from '../db'
import { recipeLinks } from '../db/schema'
import { getUser } from '../auth/get-user'

function uid() {
  return crypto.randomUUID()
}

function parseRecipeRow(row: typeof recipeLinks.$inferSelect) {
  return {
    ...row,
    tags: JSON.parse(row.tags) as Array<string>,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  }
}

export const getMyRecipes = createServerFn({ method: 'GET' }).handler(
  async () => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')
    const rows = await db
      .select()
      .from(recipeLinks)
      .where(eq(recipeLinks.userId, user.id))
      .orderBy(recipeLinks.createdAt)
    return rows.map(parseRecipeRow)
  },
)

export const getCuratedQuickAdds = createServerFn({ method: 'GET' }).handler(
  async () => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const [curatedRows, myRows] = await Promise.all([
      db.select().from(recipeLinks).where(eq(recipeLinks.curated, 1)),
      db.select().from(recipeLinks).where(eq(recipeLinks.userId, user.id)),
    ])

    const mySignatures = new Set(
      myRows.map((r) => `${r.title.trim().toLowerCase()}::${r.url ?? ''}`),
    )

    return curatedRows
      .filter((recipe) => {
        const signature = `${recipe.title.trim().toLowerCase()}::${recipe.url ?? ''}`
        return !mySignatures.has(signature)
      })
      .map(parseRecipeRow)
      .slice(0, 8)
  },
)

export const quickAddCuratedRecipe = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ curatedRecipeId: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const curatedRows = await db
      .select()
      .from(recipeLinks)
      .where(
        and(
          eq(recipeLinks.id, data.curatedRecipeId),
          eq(recipeLinks.curated, 1),
        ),
      )
      .limit(1)

    if (curatedRows.length === 0) {
      throw new Error('Curated recipe not found')
    }
    const curatedRecipe = curatedRows[0]

    const existingRows = await db
      .select({ id: recipeLinks.id })
      .from(recipeLinks)
      .where(
        and(
          eq(recipeLinks.userId, user.id),
          eq(recipeLinks.title, curatedRecipe.title),
          curatedRecipe.url
            ? eq(recipeLinks.url, curatedRecipe.url)
            : isNull(recipeLinks.url),
        ),
      )
      .limit(1)

    if (existingRows.length > 0) {
      return { id: existingRows[0].id, created: false }
    }

    const id = uid()
    await db.insert(recipeLinks).values({
      id,
      userId: user.id,
      title: curatedRecipe.title,
      url: curatedRecipe.url,
      description: curatedRecipe.description,
      metadata: curatedRecipe.metadata,
      tags: curatedRecipe.tags,
      stars: curatedRecipe.stars,
      curated: 0,
    })
    return { id, created: true }
  })

const SaveRecipeInput = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  url: z.string().url().optional().or(z.literal('')),
  description: z.string().optional(),
  tags: z.array(z.string()),
  metadata: z.record(z.string(), z.unknown()).nullish(),
})

export const saveRecipe = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => SaveRecipeInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const url = data.url || null
    let metadata: string | null = null

    if (data.metadata) {
      metadata = JSON.stringify(data.metadata)
    }

    const payload = {
      title: data.title,
      url,
      description: data.description ?? null,
      tags: JSON.stringify(data.tags),
      metadata: metadata ?? null,
    }

    if (data.id) {
      await db
        .update(recipeLinks)
        .set(payload)
        .where(
          and(eq(recipeLinks.id, data.id), eq(recipeLinks.userId, user.id)),
        )
      return data.id
    } else {
      const id = uid()
      await db.insert(recipeLinks).values({ id, userId: user.id, ...payload })
      return id
    }
  })

export const deleteRecipe = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')
    await db
      .delete(recipeLinks)
      .where(and(eq(recipeLinks.id, data.id), eq(recipeLinks.userId, user.id)))
  })

export const fetchRecipeMetadata = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ url: z.string().url() }).parse(data),
  )
  .handler(async ({ data }) => {
    try {
      const response = await fetch(data.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PlatePool/1.0)',
        },
      })
      const html = await response.text()

      const metadata: { [key: string]: {} } = {}

      const getMetaContent = (property: string): string | null => {
        const patterns = [
          new RegExp(
            `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
            'i',
          ),
          new RegExp(
            `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
            'i',
          ),
          new RegExp(
            `<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`,
            'i',
          ),
          new RegExp(
            `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`,
            'i',
          ),
        ]
        for (const pattern of patterns) {
          const match = html.match(pattern)
          if (match) return match[1]
        }
        return null
      }

      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      if (titleMatch) {
        metadata.title = titleMatch[1].trim()
      }

      const ogTitle = getMetaContent('og:title')
      if (ogTitle) metadata.title = ogTitle

      const description =
        getMetaContent('description') || getMetaContent('og:description')
      if (description) metadata.description = description

      const image =
        getMetaContent('og:image') || getMetaContent('twitter:image')
      if (image) {
        metadata.image = image.startsWith('http')
          ? image
          : new URL(image, data.url).href
      }

      const metaKeywords = getMetaContent('keywords')
      if (metaKeywords) {
        metadata.keywords = metaKeywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean)
      }

      const recipeJsonLd = html.match(
        /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i,
      )
      if (recipeJsonLd) {
        try {
          const jsonLd = JSON.parse(recipeJsonLd[1])
          const recipe = Array.isArray(jsonLd)
            ? jsonLd.find(
                (item) =>
                  item['@type'] === 'Recipe' ||
                  item['@type']?.includes('Recipe'),
              )
            : jsonLd['@type'] === 'Recipe' ||
                jsonLd['@type']?.includes('Recipe')
              ? jsonLd
              : null

          if (recipe) {
            metadata.recipe = {
              name: recipe.name,
              description: recipe.description,
              image: recipe.image,
              prepTime: recipe.prepTime || recipe.prepTimeISO,
              cookTime: recipe.cookTime || recipe.cookTimeISO,
              totalTime: recipe.totalTime || recipe.totalTimeISO,
              recipeYield: recipe.recipeYield,
              recipeIngredient: recipe.recipeIngredient,
              recipeInstructions: recipe.recipeInstructions,
              nutrition: recipe.nutrition,
              keywords: recipe.keywords,
              author: recipe.author?.name || recipe.author,
              publishedAt: recipe.datePublished,
            }
          }
        } catch {
          // Ignore JSON parse errors
        }
      }

      return metadata
    } catch {
      return { error: 'Failed to fetch metadata' } as { [key: string]: {} }
    }
  })

export const generateRecipeTags = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        title: z.string(),
        description: z.string().optional(),
        ingredients: z.array(z.string()).optional(),
        url: z.string().optional(),
        language: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return { error: 'AI not configured' }
    }

    const { createGoogleGenerativeAI } = await import('@ai-sdk/google')
    const { generateText } = await import('ai')
    const google = createGoogleGenerativeAI({ apiKey })

    const ingredientsList = data.ingredients?.slice(0, 10).join(', ') || ''
    const description = data.description || ''
    const language = data.language || 'en'
    const languageName = language === 'is' ? 'Icelandic' : 'English'

    const prompt = `Analyze this recipe and generate 3-5 relevant tags in ${languageName}. Consider:
- Main protein/ingredient (fish, chicken, beef, vegetarian, etc.)
- Cooking method (grilled, baked, quick, slow, etc.)
- Dietary category (healthy, comfort, light, etc.)
- Cuisine type (italian, mexican, asian, etc.)

IMPORTANT: Do NOT include tags like "dinner", "kvöldmatur", "main course", "evening meal", or any term that means dinner or evening meal. This app is already for dinner, so such tags are redundant.

Recipe: ${data.title}
${description ? `Description: ${description}` : ''}
${ingredientsList ? `Ingredients: ${ingredientsList}` : ''}

Return ONLY a JSON array of strings, like ["fish", "healthy", "baked", "quick"]. No other text. Tags MUST be in ${languageName}.`

    const { text } = await generateText({
      model: google('gemini-3.1-flash-lite-preview'),
      prompt,
    })

    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return { error: 'AI returned invalid response' }
    }

    try {
      const tags = JSON.parse(jsonMatch[0]) as Array<string>
      const filtered = tags
        .filter((t) => typeof t === 'string')
        .filter(
          (t) =>
            t.toLowerCase() !== 'kvöldmatur' && t.toLowerCase() !== 'dinner',
        )
      return { tags: filtered.slice(0, 5) }
    } catch {
      return { error: 'Failed to parse AI response' }
    }
  })
