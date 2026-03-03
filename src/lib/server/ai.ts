import { createServerFn } from '@tanstack/react-start'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
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
import { upsertHomeDayPlansBatch } from './homes'

const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

const MAX_VALIDATION_LOOPS = 1

interface ValidationIssue {
  type: 'similarity' | 'frequency' | 'constraint'
  message: string
  dayIndex?: number
}

async function validateMealPlan(
  mealPlan: Array<{ week: number; day: number; meal_name: string }>,
  historyLines: string,
  frequencyConstraints: string,
  apiKey: string,
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []

  const mealList = mealPlan.map((m, i) => `${i}: ${m.meal_name}`).join('\n')

  const validationPrompt = `You are a meal plan validator. Check this meal plan for issues.

MEAL PLAN TO VALIDATE:
${mealList}

${historyLines ? historyLines + '\n' : ''}${frequencyConstraints ? frequencyConstraints + '\n' : ''}

Check for these issues:
1. SIMILARITY: Are any meals too similar? (e.g., "Fajitas with beef" and "Fajitas with chicken" are too similar - same dish type with minor variation)
2. FREQUENCY: Are any meal types repeated too often? (e.g., pasta 3+ times, tacos multiple days)
3. DIVERSITY: Is there good variety across the week?

Respond ONLY with valid JSON, no other text:
{"issues": [{"type": "similarity|frequency|diversity", "message": "describe the issue", "dayIndex": optional_day_number}]}

If no issues, respond: {"issues": []}`

  const google = createGoogleGenerativeAI({ apiKey })
  const { text } = await generateText({
    model: google('gemini-3.1-flash-lite-preview'),
    prompt: validationPrompt,
  })

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed.issues && Array.isArray(parsed.issues)) {
        issues.push(...parsed.issues)
      }
    } catch {
      // Ignore parse errors
    }
  }

  return issues
}

export const generateMealPlan = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        startDate: z.string(),
        endDate: z.string(),
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

    // Build constraint map (custom constraints from DB + preset constraints)
    const constraintMap = new Map(userConstraints.map((c) => [c.id, c]))

    // Add preset constraints to the map so AI can resolve names like "preset-fish" -> "Fish"
    const PRESET_CONSTRAINTS: Record<
      string,
      { name: string; frequency?: string }
    > = {
      'preset-fish': { name: 'Fish', frequency: '2' },
      'preset-simple': { name: 'Simple' },
      'preset-vegetarian': { name: 'Vegetarian', frequency: '2' },
      'preset-vegan': { name: 'Vegan', frequency: '1' },
      'preset-healthy': { name: 'Healthy' },
      'preset-quick': { name: 'Quick' },
      'preset-budget': { name: 'Budget-friendly' },
      'preset-new': { name: 'NEW', frequency: '1' },
    }
    for (const [id, preset] of Object.entries(PRESET_CONSTRAINTS)) {
      if (!constraintMap.has(id)) {
        constraintMap.set(id, {
          id,
          userId: '',
          name: preset.name,
          type: 'regular',
          color: '',
          emoji: '',
          frequency: preset.frequency ?? null,
        })
      }
    }

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

    // Build list of dates in the range
    const start = new Date(data.startDate + 'T12:00:00')
    const end = new Date(data.endDate + 'T12:00:00')
    const datesToPlan: Array<{ date: string; dayName: string; dayOfWeek: number }> = []
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = (d.getDay() + 6) % 7 // Mon=0, Sun=6
      datesToPlan.push({
        date: d.toISOString().slice(0, 10),
        dayName: DAY_NAMES[dow],
        dayOfWeek: dow,
      })
    }

    const totalDays = datesToPlan.length
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })

    // Build per-date constraint info for the prompt
    const dateConstraintLines = datesToPlan
      .map((dp) => {
        const tpl = templates.find((t) => t.dayOfWeek === dp.dayOfWeek)
        if (!tpl) return `  ${dp.date} (${dp.dayName}): (no constraints)`
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
        return `  ${dp.date} (${dp.dayName}): ${constraintDetails || '(no constraints)'}`
      })
      .join('\n')

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

    let prompt = `You are a dinner planning assistant helping a family plan their meals.
Period: ${fmt(start)} – ${fmt(end)} (${totalDays} days)

${budgetContext}${healthContext}

Day constraints per day of week (these MUST be respected — they reflect real life constraints like busy evenings or dietary preferences):
${dayConstraintLines}

Dates to plan (with their day-of-week constraints applied):
${dateConstraintLines}${frequencyConstraints ? '\n\nFrequency limits (strictly respect these):\n' + frequencyConstraints : ''}${historyLines}${linkLines}

IMPORTANT: Prioritize using the user's saved recipes listed above when planning meals. Only suggest other meals if you cannot find a suitable match from the saved recipes.

Generate a ${totalDays}-day DINNER plan (dinner only — not breakfast or lunch). For each date:
- Suggest a meal name that fits the constraints for that day
- Keep it realistic for a family with kids

Respond ONLY with valid JSON in this exact format, no other text:
[
  {"date": "${datesToPlan[0]?.date || data.startDate}", "meal_name": "Spaghetti Bolognese"},
  {"date": "${datesToPlan[1]?.date || ''}", "meal_name": "Grilled Salmon with Vegetables"},
  ...
]

Generate exactly ${totalDays} entries, one per date.`

    let parsed: Array<{
      date: string
      meal_name: string
    }> = []

    for (let loop = 0; loop < MAX_VALIDATION_LOOPS; loop++) {
      const google = createGoogleGenerativeAI({ apiKey })
      const { text } = await generateText({
        model: google('gemini-3.1-flash-lite-preview'),
        prompt,
      })

      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error('AI returned invalid response')

      parsed = JSON.parse(jsonMatch[0]) as Array<{
        date: string
        meal_name: string
      }>

      // Convert to week/day format for validation
      const validationFormat = parsed.map((item, i) => ({
        week: 0,
        day: i,
        meal_name: item.meal_name,
      }))

      const issues = await validateMealPlan(
        validationFormat,
        historyLines,
        frequencyConstraints,
        apiKey,
      )

      if (issues.length === 0) {
        break
      }

      const issueMessages = issues.map((i) => `- ${i.message}`).join('\n')

      prompt += `\n\nVALIDATION FEEDBACK (must fix these issues):
${issueMessages}

Please regenerate the meal plan addressing these issues.`
    }

    // Map each date to weekStart + dayOfWeek for storage
    const daysToInsert = parsed.map((item) => {
      const d = new Date(item.date + 'T12:00:00')
      const dow = (d.getDay() + 6) % 7
      const ws = new Date(d)
      ws.setDate(ws.getDate() - dow)
      return {
        weekStart: ws.toISOString().slice(0, 10),
        dayOfWeek: dow,
        mealName: item.meal_name,
        constraintIds: [],
      }
    })

    await upsertHomeDayPlansBatch({ data: { days: daysToInsert } })

    return parsed
  })
