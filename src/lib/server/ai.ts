import { createServerFn } from '@tanstack/react-start'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDbWithSchema } from '../db'
import {
  constraints,
  dayTemplates,
  familyDayPlans,
  familyMealPlans,
  familyMembers,
  recipeLinks,
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
    z
      .object({
        weekStart: z.string(),
        timeframe: z.number().min(1).max(4).default(1),
        budget: z.number().min(1).max(3).default(2),
        healthMode: z.boolean().default(false),
      })
      .parse(data),
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
          const freq = c.frequency ? ` (max ${c.frequency}x/week)` : ''
          return (
            c.name +
            freq +
            (hasNewConstraint
              ? ' (NEW - make it something different from their history!)'
              : '')
          )
        })
        .join(', ')
      return `  ${name}: ${constraintDetails || '(no constraints)'}`
    }).join('\n')

    const frequencyConstraints = userConstraints
      .filter((c) => c.frequency)
      .map((c) => `  - ${c.name}: maximum ${c.frequency} times per week`)
      .join('\n')

    // Load user recipe links + curated recipes
    let linkLines = ''
    const userLinks = await db
      .select()
      .from(recipeLinks)
      .where(eq(recipeLinks.userId, user.id))

    const curatedLinks = await db
      .select()
      .from(recipeLinks)
      .where(eq(recipeLinks.curated, 1))

    if (userLinks.length > 0 || curatedLinks.length > 0) {
      const userSection =
        userLinks.length > 0
          ? '\n\nYOUR SAVED RECIPES - PRIORITIZE these:\n' +
            userLinks
              .slice(0, 8)
              .map(
                (l) =>
                  `  - ${l.title}: ${l.url || ''}${l.description ? ` (${l.description})` : ''}`,
              )
              .join('\n')
          : ''

      const curatedSection =
        curatedLinks.length > 0
          ? '\n\nCURATED ICELANDIC RECIPES (deep pockets - feel free to use these freely):\n' +
            curatedLinks
              .slice(0, 12)
              .map(
                (l) =>
                  `  - ${l.title}: ${l.url || ''}${l.description ? ` (${l.description})` : ''}`,
              )
              .join('\n')
          : ''

      linkLines = userSection + curatedSection
    }

    const weekDate = new Date(data.weekStart + 'T12:00:00')
    const weeks = data.timeframe || 1
    const endDate = new Date(weekDate)
    endDate.setDate(weekDate.getDate() + weeks * 7 - 1)
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })

    const budgetLabels = {
      1: 'Budget-friendly (tight)',
      2: 'Balanced',
      3: 'Generous',
    }
    const budgetContext = data.budget
      ? `\nBudget level: ${budgetLabels[data.budget as keyof typeof budgetLabels]} - ${data.budget === 1 ? 'prioritize affordable ingredients, simple recipes, batch cooking' : data.budget === 2 ? 'mix of everyday and occasional treats' : 'varied ingredients, quality proteins, willing to try special ingredients'}`
      : ''

    const healthContext = data.healthMode
      ? '\nHealth Mode (Átak): This is a focused cooking sprint - prioritize nutritious, well-balanced meals that fuel the family. Include plenty of vegetables, lean proteins, and wholesome ingredients.'
      : ''

    const prompt = `You are a dinner planning assistant helping a family plan their meals.
${weeks === 1 ? `Week: ${fmt(weekDate)} – ${fmt(endDate)}` : `Period: ${fmt(weekDate)} – ${fmt(endDate)} (${weeks} weeks)`}

${budgetContext}${healthContext}

Day constraints (these MUST be respected — they reflect real life constraints like busy evenings or dietary preferences):
${dayConstraintLines}${frequencyConstraints ? '\n\nFrequency limits (strictly respect these):\n' + frequencyConstraints : ''}${historyLines}${linkLines}

IMPORTANT: Prioritize using the user's saved recipes listed above when planning meals. Only suggest other meals if you cannot find a suitable match from the saved recipes.

Generate a ${weeks * 7}-day DINNER plan (dinner only — not breakfast or lunch). For each day:
- Suggest a meal name that fits the constraints
- Keep it realistic for a family with kids

Respond ONLY with valid JSON in this exact format, no other text:
[
  {"week": 0, "day": 0, "meal_name": "Spaghetti Bolognese"},
  {"week": 0, "day": 1, "meal_name": "Grilled Salmon with Vegetables"},
  ...
]

week 0 = first week, day 0 = Monday, day 6 = Sunday. Generate exactly ${weeks * 7} entries.`

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent(prompt)
    const text = result.response.text()

    // Parse JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('AI returned invalid response')

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      week: number
      day: number
      meal_name: string
      recipe_url?: string
    }>

    // Calculate the actual weekStart for each week
    const getWeekStart = (weekOffset: number) => {
      const d = new Date(data.weekStart + 'T12:00:00')
      d.setDate(d.getDate() + weekOffset * 7)
      return d.toISOString().slice(0, 10)
    }

    // Upsert each day plan
    for (const item of parsed) {
      const weekStart = getWeekStart(item.week)
      await upsertHomeDayPlan({
        data: {
          weekStart,
          dayOfWeek: item.day,
          mealName: item.meal_name,
          constraintIds: [],
        },
      })
    }

    return parsed
  })
