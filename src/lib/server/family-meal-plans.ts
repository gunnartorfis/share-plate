import { createServerFn } from '@tanstack/react-start'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDbWithSchema } from '../db'
import {
  familyDayPlans,
  familyMealPlans,
  familyMembers,
  familyShares,
  families,
} from '../db/schema'
import { getUser } from '../auth/get-user'

function uid() {
  return crypto.randomUUID()
}

export const getFamilyMealPlan = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) =>
    z.object({ familyId: z.string(), weekStart: z.string() }).parse(data),
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

    let plan = await db
      .select()
      .from(familyMealPlans)
      .where(
        and(
          eq(familyMealPlans.familyId, data.familyId),
          eq(familyMealPlans.weekStart, data.weekStart),
        ),
      )
      .limit(1)

    if (!plan[0]) {
      const id = uid()
      await db
        .insert(familyMealPlans)
        .values({ id, familyId: data.familyId, weekStart: data.weekStart })
      plan = [
        {
          id,
          familyId: data.familyId,
          weekStart: data.weekStart,
          createdAt: new Date(),
        },
      ]
    }

    const days = await db
      .select()
      .from(familyDayPlans)
      .where(eq(familyDayPlans.familyMealPlanId, plan[0].id))

    const sharedWith = await db
      .select({ familyId: familyShares.sharedWithFamilyId })
      .from(familyShares)
      .where(eq(familyShares.familyMealPlanId, plan[0].id))

    return {
      plan: { ...plan[0] },
      days: days.map((d) => ({
        ...d,
        constraintIds: JSON.parse(d.constraintIds) as Array<string>,
      })),
      sharedWithFamilyIds: sharedWith.map((s) => s.familyId),
      role: membership[0].role,
    }
  })

const UpsertFamilyDayInput = z.object({
  familyId: z.string(),
  weekStart: z.string(),
  dayOfWeek: z.number().min(0).max(6),
  mealName: z.string().optional(),
  notes: z.string().optional(),
  recipeUrl: z.string().optional(),
  constraintIds: z.array(z.string()).optional(),
})

export const upsertFamilyDayPlan = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => UpsertFamilyDayInput.parse(data))
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

    const plan = await db
      .select()
      .from(familyMealPlans)
      .where(
        and(
          eq(familyMealPlans.familyId, data.familyId),
          eq(familyMealPlans.weekStart, data.weekStart),
        ),
      )
      .limit(1)

    if (!plan[0]) {
      const id = uid()
      await db
        .insert(familyMealPlans)
        .values({ id, familyId: data.familyId, weekStart: data.weekStart })
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

export const shareFamilyMealPlan = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        familyId: z.string(),
        weekStart: z.string(),
        shareWithFamilyId: z.string(),
      })
      .parse(data),
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
    if (membership[0].role !== 'admin') throw new Error('Only admins can share')

    const plan = await db
      .select()
      .from(familyMealPlans)
      .where(
        and(
          eq(familyMealPlans.familyId, data.familyId),
          eq(familyMealPlans.weekStart, data.weekStart),
        ),
      )
      .limit(1)

    if (!plan[0]) throw new Error('Meal plan not found')

    if (data.familyId === data.shareWithFamilyId) {
      throw new Error('Cannot share with yourself')
    }

    const existing = await db
      .select()
      .from(familyShares)
      .where(
        and(
          eq(familyShares.familyMealPlanId, plan[0].id),
          eq(familyShares.sharedWithFamilyId, data.shareWithFamilyId),
        ),
      )
      .limit(1)

    if (!existing[0]) {
      await db.insert(familyShares).values({
        familyMealPlanId: plan[0].id,
        sharedWithFamilyId: data.shareWithFamilyId,
      })
    }

    return { success: true }
  })

export const unshareFamilyMealPlan = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        familyId: z.string(),
        weekStart: z.string(),
        shareWithFamilyId: z.string(),
      })
      .parse(data),
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
    if (membership[0].role !== 'admin')
      throw new Error('Only admins can unshare')

    const plan = await db
      .select()
      .from(familyMealPlans)
      .where(
        and(
          eq(familyMealPlans.familyId, data.familyId),
          eq(familyMealPlans.weekStart, data.weekStart),
        ),
      )
      .limit(1)

    if (!plan[0]) throw new Error('Meal plan not found')

    await db
      .delete(familyShares)
      .where(
        and(
          eq(familyShares.familyMealPlanId, plan[0].id),
          eq(familyShares.sharedWithFamilyId, data.shareWithFamilyId),
        ),
      )

    return { success: true }
  })

export const getSharedFamilyMealPlans = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) =>
    z.object({ familyId: z.string(), weekStart: z.string() }).parse(data),
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

    const plan = await db
      .select()
      .from(familyMealPlans)
      .where(
        and(
          eq(familyMealPlans.familyId, data.familyId),
          eq(familyMealPlans.weekStart, data.weekStart),
        ),
      )
      .limit(1)

    if (!plan[0]) return []

    const shares = await db
      .select()
      .from(familyShares)
      .where(eq(familyShares.familyMealPlanId, plan[0].id))

    const sharedPlans = []
    for (const share of shares) {
      const [sharedFamily] = await db
        .select()
        .from(families)
        .where(eq(families.id, share.sharedWithFamilyId))

      if (sharedFamily) {
        const sharedPlan = await db
          .select()
          .from(familyMealPlans)
          .where(
            and(
              eq(familyMealPlans.familyId, share.sharedWithFamilyId),
              eq(familyMealPlans.weekStart, data.weekStart),
            ),
          )
          .limit(1)

        if (sharedPlan[0]) {
          const days = await db
            .select()
            .from(familyDayPlans)
            .where(eq(familyDayPlans.familyMealPlanId, sharedPlan[0].id))

          sharedPlans.push({
            family: sharedFamily,
            days: days.map((d) => ({
              ...d,
              constraintIds: JSON.parse(d.constraintIds) as Array<string>,
            })),
          })
        }
      }
    }

    return sharedPlans
  })
