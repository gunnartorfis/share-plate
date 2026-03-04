import type { Constraint } from '@/lib/db/schema'

export type MealPlanDay = {
  id: string
  dayOfWeek: number
  mealName: string | null
  notes: string | null
  recipeUrl: string | null
  constraintIds: Array<string>
}

export type HomeData = {
  id: string
  name: string
  inviteCode: string
  role: string
  members: Array<{ id: string; name: string; email: string; role: string }>
}

export type MealPlanData = {
  plan: { id: string; weekStart: string }
  days: Array<MealPlanDay>
  role: string
  sharedFamilyIds: Array<string>
}

export type DayTemplate = {
  dayOfWeek: number
  constraintIds: Array<string>
}

export const DAY_NAMES = [
  'days.mon',
  'days.tue',
  'days.wed',
  'days.thu',
  'days.fri',
  'days.sat',
  'days.sun',
] as const

export const DAY_FULL = [
  'days.monday',
  'days.tuesday',
  'days.wednesday',
  'days.thursday',
  'days.friday',
  'days.saturday',
  'days.sunday',
] as const

export const MONTH_KEYS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const

export type MonthMealPlans = Record<string, Array<MealPlanDay>>

export { type Constraint }
