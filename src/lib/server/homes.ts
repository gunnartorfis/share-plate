import { createServerFn } from '@tanstack/react-start'
import { and, eq, desc, isNotNull } from 'drizzle-orm'
import { z } from 'zod'
import { getDbWithSchema } from '../db'
import {
  familyMembers,
  families,
  familyMealPlans,
  familyDayPlans,
  familyShares,
  users,
} from '../db/schema'
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

export const getMyHome = createServerFn({ method: 'GET' }).handler(async () => {
  const db = await getDbWithSchema()
  const user = await getUser()
  if (!user) throw new Error('Unauthorized')

  const membership = await db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.userId, user.id))
    .limit(1)

  if (!membership[0]) return null

  const [home] = await db
    .select()
    .from(families)
    .where(eq(families.id, membership[0].familyId))

  if (!home) return null

  const members = await db
    .select({ user: users, role: familyMembers.role })
    .from(familyMembers)
    .innerJoin(users, eq(familyMembers.userId, users.id))
    .where(eq(familyMembers.familyId, home.id))

  return {
    ...home,
    role: membership[0].role,
    members: members.map(({ user: u, role }) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role,
    })),
  }
})

export const createHome = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ name: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const existingMembership = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, user.id))
      .limit(1)

    if (existingMembership[0]) {
      throw new Error(
        'You already have a home. Leave it first to create a new one.',
      )
    }

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

export const joinHome = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ inviteCode: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const home = await db
      .select()
      .from(families)
      .where(eq(families.inviteCode, data.inviteCode.toUpperCase()))
      .limit(1)

    if (!home[0]) throw new Error('Invalid invite code')

    const currentMembership = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, user.id))
      .limit(1)

    if (currentMembership[0]) {
      if (currentMembership[0].familyId === home[0].id) {
        return home[0].id
      }
      await db
        .delete(familyMembers)
        .where(
          and(
            eq(familyMembers.familyId, currentMembership[0].familyId),
            eq(familyMembers.userId, user.id),
          ),
        )
    }

    await db
      .insert(familyMembers)
      .values({ familyId: home[0].id, userId: user.id, role: 'member' })

    return home[0].id
  })

export const updateHomeName = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ name: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const membership = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, user.id))
      .limit(1)

    if (!membership[0]) throw new Error('Not a member of any home')

    await db
      .update(families)
      .set({ name: data.name })
      .where(eq(families.id, membership[0].familyId))

    return { success: true }
  })

export const leaveHome = createServerFn({ method: 'POST' }).handler(
  async () => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const membership = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, user.id))
      .limit(1)

    if (!membership[0]) return { success: true }

    const homeId = membership[0].familyId

    await db
      .delete(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, homeId),
          eq(familyMembers.userId, user.id),
        ),
      )

    const remainingMembers = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.familyId, homeId))
      .limit(1)

    if (!remainingMembers[0]) {
      await db.delete(families).where(eq(families.id, homeId))
    }

    return { success: true }
  },
)

export const getHomeMealPlan = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) =>
    z.object({ weekStart: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const membership = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, user.id))
      .limit(1)
    if (!membership[0]) throw new Error('Not a member of any home')

    let plan = await db
      .select()
      .from(familyMealPlans)
      .where(
        and(
          eq(familyMealPlans.familyId, membership[0].familyId),
          eq(familyMealPlans.weekStart, data.weekStart),
        ),
      )
      .limit(1)

    if (!plan[0]) {
      const id = uid()
      await db.insert(familyMealPlans).values({
        id,
        familyId: membership[0].familyId,
        weekStart: data.weekStart,
      })
      plan = [
        {
          id,
          familyId: membership[0].familyId,
          weekStart: data.weekStart,
          createdAt: new Date(),
        },
      ]
    }

    const days = await db
      .select()
      .from(familyDayPlans)
      .where(eq(familyDayPlans.familyMealPlanId, plan[0].id))

    return {
      plan: plan[0],
      days: days.map((d) => ({
        ...d,
        constraintIds: JSON.parse(d.constraintIds) as Array<string>,
      })),
      role: membership[0].role,
    }
  })

const UpsertHomeDayInput = z.object({
  weekStart: z.string(),
  dayOfWeek: z.number().min(0).max(6),
  mealName: z.string().optional(),
  notes: z.string().optional(),
  recipeUrl: z.string().optional(),
  constraintIds: z.array(z.string()).optional(),
})

export const upsertHomeDayPlan = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => UpsertHomeDayInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const membership = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, user.id))
      .limit(1)
    if (!membership[0]) throw new Error('Not a member of any home')

    let plan = await db
      .select()
      .from(familyMealPlans)
      .where(
        and(
          eq(familyMealPlans.familyId, membership[0].familyId),
          eq(familyMealPlans.weekStart, data.weekStart),
        ),
      )
      .limit(1)

    if (!plan[0]) {
      const id = uid()
      await db.insert(familyMealPlans).values({
        id,
        familyId: membership[0].familyId,
        weekStart: data.weekStart,
      })
      const [newPlan] = await db
        .select()
        .from(familyMealPlans)
        .where(eq(familyMealPlans.id, id))
      plan[0] = newPlan
    }

    const existing = await db
      .select()
      .from(familyDayPlans)
      .where(
        and(
          eq(familyDayPlans.familyMealPlanId, plan[0].id),
          eq(familyDayPlans.dayOfWeek, data.dayOfWeek),
        ),
      )
      .limit(1)

    if (existing[0]) {
      await db
        .update(familyDayPlans)
        .set({
          mealName: data.mealName ?? null,
          notes: data.notes ?? null,
          recipeUrl: data.recipeUrl ?? null,
          constraintIds: JSON.stringify(data.constraintIds ?? []),
        })
        .where(eq(familyDayPlans.id, existing[0].id))
    } else {
      const id = uid()
      await db.insert(familyDayPlans).values({
        id,
        familyMealPlanId: plan[0].id,
        dayOfWeek: data.dayOfWeek,
        mealName: data.mealName ?? null,
        notes: data.notes ?? null,
        recipeUrl: data.recipeUrl ?? null,
        constraintIds: JSON.stringify(data.constraintIds ?? []),
      })
    }

    return { success: true }
  })

export const getHomeMealPlanWithSharing = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) =>
    z.object({ weekStart: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const membership = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, user.id))
      .limit(1)
    if (!membership[0]) throw new Error('Not a member of any home')

    let plan = await db
      .select()
      .from(familyMealPlans)
      .where(
        and(
          eq(familyMealPlans.familyId, membership[0].familyId),
          eq(familyMealPlans.weekStart, data.weekStart),
        ),
      )
      .limit(1)

    if (!plan[0]) {
      const id = uid()
      await db.insert(familyMealPlans).values({
        id,
        familyId: membership[0].familyId,
        weekStart: data.weekStart,
      })
      plan = [
        {
          id,
          familyId: membership[0].familyId,
          weekStart: data.weekStart,
          createdAt: new Date(),
        },
      ]
    }

    const days = await db
      .select()
      .from(familyDayPlans)
      .where(eq(familyDayPlans.familyMealPlanId, plan[0].id))

    const sharedFamilies = await db
      .select({ familyId: familyShares.sharedWithFamilyId })
      .from(familyShares)
      .where(eq(familyShares.familyMealPlanId, plan[0].id))

    return {
      plan: plan[0],
      days: days.map((d) => ({
        ...d,
        constraintIds: JSON.parse(d.constraintIds) as Array<string>,
      })),
      role: membership[0].role,
      sharedFamilyIds: sharedFamilies.map((s) => s.familyId),
    }
  })

export const shareHomeMealPlan = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({ weekStart: z.string(), sharedWithFamilyId: z.string() })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const membership = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, user.id))
      .limit(1)
    if (!membership[0]) throw new Error('Not a member of any home')

    const plan = await db
      .select()
      .from(familyMealPlans)
      .where(
        and(
          eq(familyMealPlans.familyId, membership[0].familyId),
          eq(familyMealPlans.weekStart, data.weekStart),
        ),
      )
      .limit(1)

    if (!plan[0]) throw new Error('Meal plan not found')

    await db
      .insert(familyShares)
      .values({
        familyMealPlanId: plan[0].id,
        sharedWithFamilyId: data.sharedWithFamilyId,
      })
      .onConflictDoNothing()
  })

export const unshareHomeMealPlan = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({ weekStart: z.string(), sharedWithFamilyId: z.string() })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const membership = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, user.id))
      .limit(1)
    if (!membership[0]) throw new Error('Not a member of any home')

    const plan = await db
      .select()
      .from(familyMealPlans)
      .where(
        and(
          eq(familyMealPlans.familyId, membership[0].familyId),
          eq(familyMealPlans.weekStart, data.weekStart),
        ),
      )
      .limit(1)

    if (!plan[0]) return

    await db
      .delete(familyShares)
      .where(
        and(
          eq(familyShares.familyMealPlanId, plan[0].id),
          eq(familyShares.sharedWithFamilyId, data.sharedWithFamilyId),
        ),
      )
  })

export const getPastHomeMealNames = createServerFn({ method: 'GET' }).handler(
  async () => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const membership = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, user.id))
      .limit(1)
    if (!membership[0]) return []

    const rows = await db
      .select({ mealName: familyDayPlans.mealName })
      .from(familyDayPlans)
      .innerJoin(
        familyMealPlans,
        eq(familyDayPlans.familyMealPlanId, familyMealPlans.id),
      )
      .where(
        and(
          eq(familyMealPlans.familyId, membership[0].familyId),
          isNotNull(familyDayPlans.mealName),
        ),
      )
      .orderBy(desc(familyMealPlans.weekStart))

    const seen = new Set<string>()
    return rows
      .filter((r) => {
        if (r.mealName && !seen.has(r.mealName)) {
          seen.add(r.mealName)
          return true
        }
        return false
      })
      .map((r) => r.mealName as string)
  },
)

export const getPastHomeRecipeUrls = createServerFn({ method: 'GET' }).handler(
  async () => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const membership = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, user.id))
      .limit(1)
    if (!membership[0]) return []

    const rows = await db
      .select({ recipeUrl: familyDayPlans.recipeUrl })
      .from(familyDayPlans)
      .innerJoin(
        familyMealPlans,
        eq(familyDayPlans.familyMealPlanId, familyMealPlans.id),
      )
      .where(
        and(
          eq(familyMealPlans.familyId, membership[0].familyId),
          isNotNull(familyDayPlans.recipeUrl),
        ),
      )
      .orderBy(desc(familyMealPlans.weekStart))

    const seen = new Set<string>()
    return rows
      .filter((r) => {
        if (r.recipeUrl && !seen.has(r.recipeUrl)) {
          seen.add(r.recipeUrl)
          return true
        }
        return false
      })
      .map((r) => r.recipeUrl as string)
  },
)
