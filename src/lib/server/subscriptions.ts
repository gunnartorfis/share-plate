import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDbWithSchema } from '../db'
import {
  families,
  familyMealPlans,
  familyMembers,
  familySubscriptions,
  users,
} from '../db/schema'
import { getUser } from '../auth/get-user'

export const getMySubscriptions = createServerFn({ method: 'GET' }).handler(
  async () => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const rows = await db
      .select({ family: families })
      .from(familySubscriptions)
      .innerJoin(families, eq(familySubscriptions.familyId, families.id))
      .where(eq(familySubscriptions.userId, user.id))

    return rows.map(({ family }) => family)
  },
)

export const subscribeToFamily = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ familyId: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const family = await db
      .select()
      .from(families)
      .where(eq(families.id, data.familyId))
      .limit(1)

    if (!family[0]) throw new Error('Family not found')

    const existing = await db
      .select()
      .from(familySubscriptions)
      .where(
        and(
          eq(familySubscriptions.familyId, data.familyId),
          eq(familySubscriptions.userId, user.id),
        ),
      )
      .limit(1)

    if (existing[0]) return data.familyId

    await db
      .insert(familySubscriptions)
      .values({ familyId: data.familyId, userId: user.id })

    return data.familyId
  })

export const unsubscribeFromFamily = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ familyId: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    await db
      .delete(familySubscriptions)
      .where(
        and(
          eq(familySubscriptions.familyId, data.familyId),
          eq(familySubscriptions.userId, user.id),
        ),
      )
  })

export const subscribeToFamilyByCode = createServerFn({ method: 'POST' })
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
      .from(familySubscriptions)
      .where(
        and(
          eq(familySubscriptions.familyId, family[0].id),
          eq(familySubscriptions.userId, user.id),
        ),
      )
      .limit(1)

    if (existing[0]) return { id: family[0].id, name: family[0].name }

    await db
      .insert(familySubscriptions)
      .values({ familyId: family[0].id, userId: user.id })

    return { id: family[0].id, name: family[0].name }
  })

export const getFamilySubscribers = createServerFn({ method: 'GET' })
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
          eq(familyMembers.role, 'admin'),
        ),
      )
      .limit(1)

    if (!membership[0]) throw new Error('Only admins can see subscribers')

    const subscribers = await db
      .select({ user: users, subscribedAt: familySubscriptions.subscribedAt })
      .from(familySubscriptions)
      .innerJoin(users, eq(familySubscriptions.userId, users.id))
      .where(eq(familySubscriptions.familyId, data.familyId))
      .orderBy(desc(familySubscriptions.subscribedAt))

    return subscribers.map(({ user: u, subscribedAt }) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      avatarUrl: u.avatarUrl,
      subscribedAt,
    }))
  })

export const getSubscriptionFeed = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) =>
    z
      .object({
        limit: z.number().optional().default(10),
        offset: z.number().optional().default(0),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const subscriptions = await db
      .select({ familyId: familySubscriptions.familyId })
      .from(familySubscriptions)
      .where(eq(familySubscriptions.userId, user.id))

    if (subscriptions.length === 0) return []

    const familyIds = subscriptions.map((s) => s.familyId)

    const allMealPlans = await db
      .select({
        mealPlan: familyMealPlans,
        family: families,
      })
      .from(familyMealPlans)
      .innerJoin(families, eq(familyMealPlans.familyId, families.id))
      .where(and(eq(familyMealPlans.weekStart, getCurrentWeekStart())))
      .orderBy(desc(familyMealPlans.createdAt))
      .limit(data.limit * 2)

    const filtered = allMealPlans.filter((mp) =>
      familyIds.includes(mp.mealPlan.familyId),
    )

    return filtered.slice(0, data.limit).map(({ mealPlan, family }) => ({
      ...mealPlan,
      family: {
        id: family.id,
        name: family.name,
      },
    }))
  })

function getCurrentWeekStart(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().split('T')[0]
}
