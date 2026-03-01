import { createServerFn } from '@tanstack/react-start'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDbWithSchema } from '../db'
import { familyMembers, families, users } from '../db/schema'
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

export const getMyFamilies = createServerFn({ method: 'GET' }).handler(
  async () => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const rows = await db
      .select({ family: families, role: familyMembers.role })
      .from(familyMembers)
      .innerJoin(families, eq(familyMembers.familyId, families.id))
      .where(eq(familyMembers.userId, user.id))

    return rows.map(({ family, role }) => ({ ...family, role }))
  },
)

export const createFamily = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ name: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const id = uid()
    const inviteCode = generateInviteCode()

    await db
      .insert(families)
      .values({ id, name: data.name, createdBy: user.id, inviteCode })
    await db
      .insert(familyMembers)
      .values({ familyId: id, userId: user.id, role: 'admin' })

    return { id, inviteCode }
  })

export const joinFamily = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ inviteCode: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const family = await db
      .select()
      .from(families)
      .where(eq(families.inviteCode, data.inviteCode.toUpperCase()))
      .limit(1)

    if (!family[0]) throw new Error('Invalid invite code')

    const existing = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, family[0].id),
          eq(familyMembers.userId, user.id),
        ),
      )
      .limit(1)

    if (existing[0]) return family[0].id

    await db
      .insert(familyMembers)
      .values({ familyId: family[0].id, userId: user.id, role: 'member' })

    return family[0].id
  })

export const getFamily = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) =>
    z.object({ familyId: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const membership = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, data.familyId),
          eq(familyMembers.userId, user.id),
        ),
      )
      .limit(1)
    if (!membership[0]) throw new Error('Not a member')

    const [family] = await db
      .select()
      .from(families)
      .where(eq(families.id, data.familyId))
    if (!family) throw new Error('Family not found')

    const members = await db
      .select({ user: users, role: familyMembers.role })
      .from(familyMembers)
      .innerJoin(users, eq(familyMembers.userId, users.id))
      .where(eq(familyMembers.familyId, data.familyId))

    return {
      ...family,
      role: membership[0].role,
      members: members.map(({ user: u, role }) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role,
      })),
    }
  })

export const leaveFamily = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ familyId: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')
    await db
      .delete(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, data.familyId),
          eq(familyMembers.userId, user.id),
        ),
      )
  })
