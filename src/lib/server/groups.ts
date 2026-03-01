import { createServerFn } from "@tanstack/react-start"
import { db } from "../db"
import { groups, groupMembers, users } from "../db/schema"
import { eq, and } from "drizzle-orm"
import { getUser } from "../auth/get-user"
import { z } from "zod"

function uid() {
  return crypto.randomUUID()
}

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((b) => chars[b % chars.length])
    .join("")
}

export const getMyGroups = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getUser()
  if (!user) throw new Error("Unauthorized")

  const rows = await db
    .select({ group: groups, role: groupMembers.role })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(eq(groupMembers.userId, user.id))

  return rows.map(({ group, role }) => ({ ...group, role }))
})

export const createGroup = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ name: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const user = await getUser()
    if (!user) throw new Error("Unauthorized")

    const id = uid()
    const inviteCode = generateInviteCode()

    await db.insert(groups).values({ id, name: data.name, createdBy: user.id, inviteCode })
    await db.insert(groupMembers).values({ groupId: id, userId: user.id, role: "admin" })

    return { id, inviteCode }
  })

export const joinGroup = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ inviteCode: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const user = await getUser()
    if (!user) throw new Error("Unauthorized")

    const group = await db
      .select()
      .from(groups)
      .where(eq(groups.inviteCode, data.inviteCode.toUpperCase()))
      .limit(1)

    if (!group[0]) throw new Error("Invalid invite code")

    const existing = await db
      .select()
      .from(groupMembers)
      .where(
        and(eq(groupMembers.groupId, group[0].id), eq(groupMembers.userId, user.id)),
      )
      .limit(1)

    if (existing[0]) return group[0].id // already a member

    await db
      .insert(groupMembers)
      .values({ groupId: group[0].id, userId: user.id, role: "member" })

    return group[0].id
  })

export const getGroup = createServerFn({ method: "GET" })
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

    const [group] = await db.select().from(groups).where(eq(groups.id, data.groupId))
    if (!group) throw new Error("Group not found")

    const members = await db
      .select({ user: users, role: groupMembers.role })
      .from(groupMembers)
      .innerJoin(users, eq(groupMembers.userId, users.id))
      .where(eq(groupMembers.groupId, data.groupId))

    return {
      ...group,
      role: membership[0].role,
      members: members.map(({ user: u, role }) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role,
      })),
    }
  })

export const leaveGroup = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ groupId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const user = await getUser()
    if (!user) throw new Error("Unauthorized")
    await db
      .delete(groupMembers)
      .where(
        and(eq(groupMembers.groupId, data.groupId), eq(groupMembers.userId, user.id)),
      )
  })
