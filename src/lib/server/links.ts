import { createServerFn } from "@tanstack/react-start"
import { db } from "../db"
import { recipeLinks, groupLinks, groupMembers } from "../db/schema"
import { eq, and } from "drizzle-orm"
import { getUser } from "../auth/get-user"
import { z } from "zod"

function uid() {
  return crypto.randomUUID()
}

export const getMyLinks = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getUser()
  if (!user) throw new Error("Unauthorized")
  const rows = await db
    .select()
    .from(recipeLinks)
    .where(eq(recipeLinks.userId, user.id))
    .orderBy(recipeLinks.createdAt)
  return rows.map((r) => ({ ...r, tags: JSON.parse(r.tags) as string[] }))
})

const SaveLinkInput = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  url: z.string().url(),
  description: z.string().optional(),
  type: z.enum(["website", "recipe"]),
  tags: z.array(z.string()),
})

export const saveLink = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => SaveLinkInput.parse(data))
  .handler(async ({ data }) => {
    const user = await getUser()
    if (!user) throw new Error("Unauthorized")

    const payload = {
      title: data.title,
      url: data.url,
      description: data.description ?? null,
      type: data.type,
      tags: JSON.stringify(data.tags),
    }

    if (data.id) {
      await db
        .update(recipeLinks)
        .set(payload)
        .where(and(eq(recipeLinks.id, data.id), eq(recipeLinks.userId, user.id)))
      return data.id
    } else {
      const id = uid()
      await db.insert(recipeLinks).values({ id, userId: user.id, ...payload })
      return id
    }
  })

export const deleteLink = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const user = await getUser()
    if (!user) throw new Error("Unauthorized")
    await db
      .delete(recipeLinks)
      .where(and(eq(recipeLinks.id, data.id), eq(recipeLinks.userId, user.id)))
  })

export const addLinkToGroup = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ groupId: z.string(), linkId: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const user = await getUser()
    if (!user) throw new Error("Unauthorized")

    // Verify user is in group
    const membership = await db
      .select()
      .from(groupMembers)
      .where(
        and(eq(groupMembers.groupId, data.groupId), eq(groupMembers.userId, user.id)),
      )
      .limit(1)
    if (!membership[0]) throw new Error("Not a member of this group")

    // Verify link belongs to user
    const link = await db
      .select()
      .from(recipeLinks)
      .where(and(eq(recipeLinks.id, data.linkId), eq(recipeLinks.userId, user.id)))
      .limit(1)
    if (!link[0]) throw new Error("Link not found")

    await db
      .insert(groupLinks)
      .values({ groupId: data.groupId, recipeLinkId: data.linkId, addedBy: user.id })
      .onConflictDoNothing()
  })

export const getGroupLinks = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ groupId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const user = await getUser()
    if (!user) throw new Error("Unauthorized")

    const membership = await db
      .select()
      .from(groupMembers)
      .where(
        and(eq(groupMembers.groupId, data.groupId), eq(groupMembers.userId, user.id)),
      )
      .limit(1)
    if (!membership[0]) throw new Error("Not a member")

    const rows = await db
      .select({ gl: groupLinks, rl: recipeLinks })
      .from(groupLinks)
      .innerJoin(recipeLinks, eq(groupLinks.recipeLinkId, recipeLinks.id))
      .where(eq(groupLinks.groupId, data.groupId))

    return rows.map(({ gl, rl }) => ({
      ...rl,
      tags: JSON.parse(rl.tags) as string[],
      addedBy: gl.addedBy,
      addedAt: gl.addedAt,
    }))
  })

export const removeLinkFromGroup = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ groupId: z.string(), linkId: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const user = await getUser()
    if (!user) throw new Error("Unauthorized")
    await db
      .delete(groupLinks)
      .where(
        and(
          eq(groupLinks.groupId, data.groupId),
          eq(groupLinks.recipeLinkId, data.linkId),
        ),
      )
  })
