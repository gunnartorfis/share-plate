import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  avatarUrl: text('avatar_url'),
  homeSetupCompleted: integer('home_setup_completed', { mode: 'boolean' })
    .notNull()
    .default(false),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
})

export const families = sqliteTable('families', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  inviteCode: text('invite_code').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const familyMembers = sqliteTable('family_members', {
  familyId: text('family_id')
    .notNull()
    .references(() => families.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['admin', 'member'] })
    .notNull()
    .default('member'),
  joinedAt: integer('joined_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const familyMealPlans = sqliteTable('family_meal_plans', {
  id: text('id').primaryKey(),
  familyId: text('family_id')
    .notNull()
    .references(() => families.id, { onDelete: 'cascade' }),
  weekStart: text('week_start').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const familyDayPlans = sqliteTable('family_day_plans', {
  id: text('id').primaryKey(),
  familyMealPlanId: text('family_meal_plan_id')
    .notNull()
    .references(() => familyMealPlans.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull(),
  mealName: text('meal_name'),
  notes: text('notes'),
  recipeUrl: text('recipe_url'),
  constraintIds: text('constraint_ids').notNull().default('[]'),
})

export const familyShares = sqliteTable('family_shares', {
  familyMealPlanId: text('family_meal_plan_id')
    .notNull()
    .references(() => familyMealPlans.id, { onDelete: 'cascade' }),
  sharedWithFamilyId: text('shared_with_family_id')
    .notNull()
    .references(() => families.id, { onDelete: 'cascade' }),
  sharedAt: integer('shared_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const familySubscriptions = sqliteTable('family_subscriptions', {
  familyId: text('family_id')
    .notNull()
    .references(() => families.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  subscribedAt: integer('subscribed_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const constraints = sqliteTable('constraints', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').notNull().default('#6b7280'),
  emoji: text('emoji'),
  type: text('type', { enum: ['regular', 'new'] })
    .notNull()
    .default('regular'),
  frequency: text('frequency'),
})

export const dayTemplates = sqliteTable('day_templates', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull(),
  constraintIds: text('constraint_ids').notNull().default('[]'),
})

export const recipeLinks = sqliteTable('recipe_links', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  url: text('url'),
  description: text('description'),
  metadata: text('metadata'),
  tags: text('tags').notNull().default('[]'),
  stars: integer('stars').notNull().default(0),
  curated: integer('curated').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const mealPlans = sqliteTable('meal_plans', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  weekStart: text('week_start').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const dayPlans = sqliteTable('day_plans', {
  id: text('id').primaryKey(),
  mealPlanId: text('meal_plan_id')
    .notNull()
    .references(() => mealPlans.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull(),
  mealName: text('meal_name'),
  notes: text('notes'),
  recipeUrl: text('recipe_url'),
  constraintIds: text('constraint_ids').notNull().default('[]'),
})

// Types
export type User = typeof users.$inferSelect
export type Session = typeof sessions.$inferSelect
export type Constraint = typeof constraints.$inferSelect
export type DayTemplate = typeof dayTemplates.$inferSelect
export type RecipeLink = typeof recipeLinks.$inferSelect
export type MealPlan = typeof mealPlans.$inferSelect
export type DayPlan = typeof dayPlans.$inferSelect
export type Family = typeof families.$inferSelect
export type FamilyMember = typeof familyMembers.$inferSelect
export type FamilyMealPlan = typeof familyMealPlans.$inferSelect
export type FamilyDayPlan = typeof familyDayPlans.$inferSelect
export type FamilyShare = typeof familyShares.$inferSelect
export type FamilySubscription = typeof familySubscriptions.$inferSelect
