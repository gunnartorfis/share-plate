import { createServerFn } from "@tanstack/react-start"
import { db } from "../db"
import {
  mealPlans,
  dayPlans,
  planShares,
  groupMembers,
  users,
  recipeLinks,
} from "../db/schema"
import { eq, and, inArray } from "drizzle-orm"
import { getUser } from "../auth/get-user"
import { z } from "zod"

function uid() {
  return crypto.randomUUID()
}

/** Returns ISO YYYY-MM-DD for the Monday of the current week */
export function currentWeekStart(): string {
  const now = new Date()
  const day = now.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(now)
  mon.setDate(now.getDate() + diff)
  return mon.toISOString().slice(0, 10)
}

export function weekStartFromParam(param: string): string {
  // Accept "YYYY-WXX" or "YYYY-MM-DD"
  if (/^\d{4}-W\d{2}$/.test(param)) {
    const [year, week] = param.split("-W").map(Number)
    const jan4 = new Date(year!, 0, 4)
    const startOfWeek1 = new Date(jan4)
    startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
    const mon = new Date(startOfWeek1)
    mon.setDate(startOfWeek1.getDate() + (week! - 1) * 7)
    return mon.toISOString().slice(0, 10)
  }
  return param
}

export function isoWeek(weekStart: string): string {
  const d = new Date(weekStart + "T12:00:00")
  const year = d.getFullYear()
  const jan1 = new Date(year, 0, 1)
  const week = Math.ceil(
    ((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7,
  )
  return `${year}-W${String(week).padStart(2, "0")}`
}

async function ensureMealPlan(userId: string, weekStart: string) {
  const existing = await db
    .select()
    .from(mealPlans)
    .where(and(eq(mealPlans.userId, userId), eq(mealPlans.weekStart, weekStart)))
    .limit(1)

  if (existing[0]) return existing[0]

  const id = uid()
  await db.insert(mealPlans).values({ id, userId, weekStart })
  return { id, userId, weekStart, createdAt: new Date() }
}

export const getMealPlan = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ weekStart: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const user = await getUser()
    if (!user) throw new Error("Unauthorized")

    const plan = await ensureMealPlan(user.id, data.weekStart)
    const days = await db
      .select()
      .from(dayPlans)
      .where(eq(dayPlans.mealPlanId, plan.id))

    // Fetch recipe link details for days that have one
    const linkIds = days.map((d) => d.recipeLinkId).filter(Boolean) as string[]
    const links =
      linkIds.length > 0
        ? await db.select().from(recipeLinks).where(inArray(recipeLinks.id, linkIds))
        : []

    const sharedGroups = await db
      .select({ groupId: planShares.groupId })
      .from(planShares)
      .where(eq(planShares.mealPlanId, plan.id))

    return {
      plan: { ...plan },
      days: days.map((d) => ({
        ...d,
        constraintIds: JSON.parse(d.constraintIds) as string[],
        recipeLink: links.find((l) => l.id === d.recipeLinkId) ?? null,
      })),
      sharedGroupIds: sharedGroups.map((s) => s.groupId),
    }
  })

const UpsertDayInput = z.object({
  weekStart: z.string(),
  dayOfWeek: z.number().min(0).max(6),
  mealName: z.string().optional(),
  notes: z.string().optional(),
  recipeLinkId: z.string().optional().nullable(),
  constraintIds: z.array(z.string()),
})

export const upsertDayPlan = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => UpsertDayInput.parse(data))
  .handler(async ({ data }) => {
    const user = await getUser()
    if (!user) throw new Error("Unauthorized")

    const plan = await ensureMealPlan(user.id, data.weekStart)

    const existing = await db
      .select()
      .from(dayPlans)
      .where(and(eq(dayPlans.mealPlanId, plan.id), eq(dayPlans.dayOfWeek, data.dayOfWeek)))
      .limit(1)

    const payload = {
      mealName: data.mealName ?? null,
      notes: data.notes ?? null,
      recipeLinkId: data.recipeLinkId ?? null,
      constraintIds: JSON.stringify(data.constraintIds),
    }

    if (existing[0]) {
      await db.update(dayPlans).set(payload).where(eq(dayPlans.id, existing[0].id))
    } else {
      await db.insert(dayPlans).values({
        id: uid(),
        mealPlanId: plan.id,
        dayOfWeek: data.dayOfWeek,
        ...payload,
      })
    }
  })

export const sharePlan = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ weekStart: z.string(), groupId: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const user = await getUser()
    if (!user) throw new Error("Unauthorized")

    const plan = await ensureMealPlan(user.id, data.weekStart)

    await db
      .insert(planShares)
      .values({ mealPlanId: plan.id, groupId: data.groupId })
      .onConflictDoNothing()
  })

export const unsharePlan = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ weekStart: z.string(), groupId: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const user = await getUser()
    if (!user) throw new Error("Unauthorized")

    const plan = await db
      .select()
      .from(mealPlans)
      .where(and(eq(mealPlans.userId, user.id), eq(mealPlans.weekStart, data.weekStart)))
      .limit(1)

    if (!plan[0]) return

    await db
      .delete(planShares)
      .where(
        and(eq(planShares.mealPlanId, plan[0].id), eq(planShares.groupId, data.groupId)),
      )
  })

export const getGroupFeed = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ groupId: z.string(), weekStart: z.string() }).parse(data),
  )
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

    // Get all members of the group
    const members = await db
      .select({ user: users })
      .from(groupMembers)
      .innerJoin(users, eq(groupMembers.userId, users.id))
      .where(eq(groupMembers.groupId, data.groupId))

    // Get shared meal plans for this week
    const sharedPlans = await db
      .select({ plan: mealPlans, share: planShares })
      .from(planShares)
      .innerJoin(mealPlans, eq(planShares.mealPlanId, mealPlans.id))
      .where(
        and(eq(planShares.groupId, data.groupId), eq(mealPlans.weekStart, data.weekStart)),
      )

    const planIds = sharedPlans.map((p) => p.plan.id)
    const allDays =
      planIds.length > 0
        ? await db.select().from(dayPlans).where(inArray(dayPlans.mealPlanId, planIds))
        : []

    // Link recipe details
    const linkIds = allDays.map((d) => d.recipeLinkId).filter(Boolean) as string[]
    const links =
      linkIds.length > 0
        ? await db.select().from(recipeLinks).where(inArray(recipeLinks.id, linkIds))
        : []

    return members.map(({ user: member }) => {
      const memberPlan = sharedPlans.find((p) => p.plan.userId === member.id)
      const memberDays = memberPlan
        ? allDays
            .filter((d) => d.mealPlanId === memberPlan.plan.id)
            .map((d) => ({
              ...d,
              constraintIds: JSON.parse(d.constraintIds) as string[],
              recipeLink: links.find((l) => l.id === d.recipeLinkId) ?? null,
            }))
        : []

      return {
        user: { id: member.id, name: member.name, email: member.email },
        days: memberDays,
        isMe: member.id === user.id,
      }
    })
  })
