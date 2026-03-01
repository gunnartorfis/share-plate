import { createServerFn } from '@tanstack/react-start'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDbWithSchema } from '../db'
import { groupFamilies, groups, families, familyMembers } from '../db/schema'
import { getUser } from '../auth/get-user'

function uid() {
  return crypto.randomUUID()
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((b) => chars[b % chars.length])
    .join('')
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

export const getMyGroups = createServerFn({ method: 'GET' }).handler(
  async () => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const familyId = await getUserFamilyId(user.id)
    if (!familyId) return []

    const rows = await db
      .select({ group: groups, role: groupFamilies.role })
      .from(groupFamilies)
      .innerJoin(groups, eq(groupFamilies.groupId, groups.id))
      .where(eq(groupFamilies.familyId, familyId))

    return rows.map(({ group, role }) => ({ ...group, role }))
  },
)

export const createGroup = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ name: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const familyId = await getUserFamilyId(user.id)
    if (!familyId) throw new Error('You must be in a family to create a group')

    const id = uid()
    const inviteCode = generateInviteCode()

    await db
      .insert(groups)
      .values({ id, name: data.name, createdBy: user.id, inviteCode })
    await db
      .insert(groupFamilies)
      .values({ groupId: id, familyId, role: 'admin' })

    return { id, inviteCode }
  })

export const joinGroup = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ inviteCode: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const familyId = await getUserFamilyId(user.id)
    if (!familyId) throw new Error('You must be in a family to join a group')

    const group = await db
      .select()
      .from(groups)
      .where(eq(groups.inviteCode, data.inviteCode.toUpperCase()))
      .limit(1)

    if (!group[0]) throw new Error('Invalid invite code')

    const existing = await db
      .select()
      .from(groupFamilies)
      .where(
        and(
          eq(groupFamilies.groupId, group[0].id),
          eq(groupFamilies.familyId, familyId),
        ),
      )
      .limit(1)

    if (existing[0]) return group[0].id

    await db
      .insert(groupFamilies)
      .values({ groupId: group[0].id, familyId, role: 'member' })

    return group[0].id
  })

export const getGroup = createServerFn({ method: 'GET' })
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

    const [group] = await db
      .select()
      .from(groups)
      .where(eq(groups.id, data.groupId))
    if (!group) throw new Error('Group not found')

    const members = await db
      .select({ family: families, role: groupFamilies.role })
      .from(groupFamilies)
      .innerJoin(families, eq(groupFamilies.familyId, families.id))
      .where(eq(groupFamilies.groupId, data.groupId))

    return {
      ...group,
      role: membership[0].role,
      members: members.map(({ family: f, role }) => ({
        id: f.id,
        name: f.name,
        role,
      })),
    }
  })

export const leaveGroup = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ groupId: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const familyId = await getUserFamilyId(user.id)
    if (!familyId) throw new Error('Not a member')

    await db
      .delete(groupFamilies)
      .where(
        and(
          eq(groupFamilies.groupId, data.groupId),
          eq(groupFamilies.familyId, familyId),
        ),
      )
  })
