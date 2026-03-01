import { createServerFn } from '@tanstack/react-start'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { getDbWithSchema } from '../db'
import {
  constraints,
  dayTemplates,
  groupLinks,
  groupFamilies,
  recipeLinks,
  familyMembers,
  familyMealPlans,
  familyDayPlans,
} from '../db/schema'
import { getUser } from '../auth/get-user'
import { upsertHomeDayPlan } from './homes'

const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

export const generateMealPlan = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ weekStart: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const apiKey = process.env['GEMINI_API_KEY']
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

    const db = await getDbWithSchema()

    // Get user's family membership
    const userFamilies = await db
      .select({ familyId: familyMembers.familyId })
      .from(familyMembers)
      .where(eq(familyMembers.userId, user.id))
      .limit(1)
    const userFamilyId = userFamilies[0]?.familyId
    if (!userFamilyId) throw new Error('Not a member of any home')

    // Load family constraints and day templates (using user's personal constraints for now)
    const userConstraints = await db
      .select()
      .from(constraints)
      .where(eq(constraints.userId, user.id))

    const templates = await db
      .select()
      .from(dayTemplates)
      .where(eq(dayTemplates.userId, user.id))

    // Build constraint map
    const constraintMap = new Map(userConstraints.map((c) => [c.id, c]))

    // Find constraint IDs that are type "new"
    const newConstraintIds = new Set(
      userConstraints.filter((c) => c.type === 'new').map((c) => c.id),
    )

    // Load family's meal history for the "new" constraint
    let historyLines = ''
    if (newConstraintIds.size > 0) {
      const pastPlans = await db
        .select({ fmp: familyMealPlans, fdp: familyDayPlans })
        .from(familyMealPlans)
        .innerJoin(
          familyDayPlans,
          eq(familyDayPlans.familyMealPlanId, familyMealPlans.id),
        )
        .where(eq(familyMealPlans.familyId, userFamilyId))
        .orderBy(familyMealPlans.createdAt)
        .limit(50)

      const mealNames = [
        ...new Set(pastPlans.map((p) => p.fdp.mealName).filter(Boolean)),
      ]
      if (mealNames.length > 0) {
        historyLines =
          '\n\nMEAL HISTORY - The family has already had these dinners (avoid repeating for "something new" constraints):\n' +
          mealNames.map((m) => `  - ${m}`).join('\n')
      }
    }

    const dayConstraintLines = DAY_NAMES.map((name, i) => {
      const tpl = templates.find((t) => t.dayOfWeek === i)
      if (!tpl) return `  ${name}: (no constraints)`
      const ids = JSON.parse(tpl.constraintIds) as Array<string>
      const constraintDetails = ids
        .map((id) => {
          const c = constraintMap.get(id)
          if (!c) return id
          const hasNewConstraint = newConstraintIds.has(id)
          return (
            c.name +
            (hasNewConstraint
              ? ' (NEW - make it something different from their history!)'
              : '')
          )
        })
        .join(', ')
      return `  ${name}: ${constraintDetails || '(no constraints)'}`
    }).join('\n')

    // Load group recipe links for inspiration
    let linkLines = ''
    if (userFamilyId) {
      const memberships = await db
        .select()
        .from(groupFamilies)
        .where(eq(groupFamilies.familyId, userFamilyId))

      if (memberships.length > 0) {
        const groupIds = memberships.map((m) => m.groupId)
        const gLinks = await db
          .select({ gl: groupLinks, rl: recipeLinks })
          .from(groupLinks)
          .innerJoin(recipeLinks, eq(groupLinks.recipeLinkId, recipeLinks.id))
          .where(inArray(groupLinks.groupId, groupIds))

        if (gLinks.length > 0) {
          linkLines =
            '\n\nAvailable recipe links (for inspiration, optional):\n' +
            gLinks.map(({ rl }) => `  - ${rl.title}: ${rl.url}`).join('\n')
        }
      }
    }

    const weekDate = new Date(data.weekStart + 'T12:00:00')
    const endDate = new Date(weekDate)
    endDate.setDate(weekDate.getDate() + 6)
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })

    const prompt = `You are a dinner planning assistant helping a family plan their week.
Week: ${fmt(weekDate)} – ${fmt(endDate)}

Day constraints (these MUST be respected — they reflect real life constraints like busy evenings or dietary preferences):
${dayConstraintLines}${historyLines}${linkLines}

Generate a 7-day DINNER plan (dinner only — not breakfast or lunch). For each day:
- Suggest a meal name that fits the constraints
- Keep it realistic for a family with kids

Respond ONLY with valid JSON in this exact format, no other text:
[
  {"day": 0, "meal_name": "Spaghetti Bolognese"},
  {"day": 1, "meal_name": "Grilled Salmon with Vegetables"},
  {"day": 2, "meal_name": "Chicken Stir Fry"},
  {"day": 3, "meal_name": "Homemade Pizza"},
  {"day": 4, "meal_name": "Fish Tacos"},
  {"day": 5, "meal_name": "Lamb Chops with Roasted Potatoes"},
  {"day": 6, "meal_name": "Beef Tacos"}
]

day 0 = Monday, day 6 = Sunday.`

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent(prompt)
    const text = result.response.text()

    // Parse JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('AI returned invalid response')

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      day: number
      meal_name: string
      recipe_url?: string
    }>

    // Upsert each day plan
    for (const item of parsed) {
      await upsertHomeDayPlan({
        data: {
          weekStart: data.weekStart,
          dayOfWeek: item.day,
          mealName: item.meal_name,
          constraintIds: [],
        },
      })
    }

    return parsed
  })
