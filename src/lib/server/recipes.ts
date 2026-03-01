import { createServerFn } from '@tanstack/react-start'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDbWithSchema } from '../db'
import {
  groupFamilies,
  groupLinks,
  recipeLinks,
  familyMembers,
} from '../db/schema'
import { getUser } from '../auth/get-user'

function uid() {
  return crypto.randomUUID()
}

async function getUserFamilyId(userId: string): Promise<string | null> {
  const db = await getDbWithSchema()
  const userFamilies = await db
    .select({ familyId: familyMembers.familyId })
    .from(familyMembers)
    .where(eq(familyMembers.userId, userId))
    .limit(1)
  return userFamilies[0]?.familyId ?? null
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
    return rows.map((r) => ({
      ...r,
      tags: JSON.parse(r.tags) as Array<string>,
      metadata: r.metadata ? JSON.parse(r.metadata) : null,
    }))
  },
)

const SaveRecipeInput = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  url: z.string().url().optional().or(z.literal('')),
  description: z.string().optional(),
  tags: z.array(z.string()),
  metadata: z.record(z.string(), z.unknown()).optional(),
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

export const addRecipeToGroup = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ groupId: z.string(), recipeId: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const familyId = await getUserFamilyId(user.id)
    if (!familyId) throw new Error('Not a member of this group')

    const membership = await db
      .select()
      .from(groupFamilies)
      .where(
        and(
          eq(groupFamilies.groupId, data.groupId),
          eq(groupFamilies.familyId, familyId),
        ),
      )
      .limit(1)
    if (!membership[0]) throw new Error('Not a member of this group')

    const recipe = await db
      .select()
      .from(recipeLinks)
      .where(
        and(eq(recipeLinks.id, data.recipeId), eq(recipeLinks.userId, user.id)),
      )
      .limit(1)
    if (!recipe[0]) throw new Error('Recipe not found')

    await db
      .insert(groupLinks)
      .values({
        groupId: data.groupId,
        recipeLinkId: data.recipeId,
        addedBy: user.id,
      })
      .onConflictDoNothing()
  })

export const getGroupRecipes = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) =>
    z.object({ groupId: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const familyId = await getUserFamilyId(user.id)
    if (!familyId) throw new Error('Not a member')

    const membership = await db
      .select()
      .from(groupFamilies)
      .where(
        and(
          eq(groupFamilies.groupId, data.groupId),
          eq(groupFamilies.familyId, familyId),
        ),
      )
      .limit(1)
    if (!membership[0]) throw new Error('Not a member')

    const rows = await db
      .select({ gl: groupLinks, rl: recipeLinks })
      .from(groupLinks)
      .innerJoin(recipeLinks, eq(groupLinks.recipeLinkId, recipeLinks.id))
      .where(eq(groupLinks.groupId, data.groupId))

    return rows.map(({ gl, rl }) => ({
      ...rl,
      tags: JSON.parse(rl.tags) as Array<string>,
      metadata: rl.metadata ? JSON.parse(rl.metadata) : null,
      addedBy: gl.addedBy,
      addedAt: gl.addedAt,
    }))
  })

export const removeRecipeFromGroup = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ groupId: z.string(), recipeId: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')
    await db
      .delete(groupLinks)
      .where(
        and(
          eq(groupLinks.groupId, data.groupId),
          eq(groupLinks.recipeLinkId, data.recipeId),
        ),
      )
  })

export const fetchRecipeMetadata = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ url: z.string().url() }).parse(data),
  )
  .handler(async ({ data }) => {
    try {
      const response = await fetch(data.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SharePlate/1.0)',
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

      const categoryMatch = html.match(/category["\s:=]+([^<>"']+)/i)
      if (categoryMatch) {
        const cats = categoryMatch[1]
          .split(/[,;]/)
          .map((c: string) => c.trim())
          .filter(Boolean)
        if (cats.length > 0) {
          metadata.keywords = [
            ...((metadata.keywords as string[]) || []),
            ...cats,
          ]
        }
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
