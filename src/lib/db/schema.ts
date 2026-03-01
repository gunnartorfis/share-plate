import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  avatarUrl: text('avatar_url'),
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

export const groups = sqliteTable('groups', {
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

export const groupFamilies = sqliteTable('group_families', {
  groupId: text('group_id')
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  familyId: text('family_id')
    .notNull()
    .references(() => families.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['admin', 'member'] })
    .notNull()
    .default('member'),
  joinedAt: integer('joined_at', { mode: 'timestamp' })
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
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const groupLinks = sqliteTable('group_links', {
  groupId: text('group_id')
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  recipeLinkId: text('recipe_link_id')
    .notNull()
    .references(() => recipeLinks.id, { onDelete: 'cascade' }),
  addedBy: text('added_by')
    .notNull()
    .references(() => users.id),
  addedAt: integer('added_at', { mode: 'timestamp' })
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

export const planShares = sqliteTable('plan_shares', {
  mealPlanId: text('meal_plan_id')
    .notNull()
    .references(() => mealPlans.id, { onDelete: 'cascade' }),
  groupId: text('group_id')
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  sharedAt: integer('shared_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const groupShares = sqliteTable('group_shares', {
  familyMealPlanId: text('family_meal_plan_id')
    .notNull()
    .references(() => familyMealPlans.id, { onDelete: 'cascade' }),
  groupId: text('group_id')
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  sharedAt: integer('shared_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

// Types
export type User = typeof users.$inferSelect
export type Session = typeof sessions.$inferSelect
export type Group = typeof groups.$inferSelect
export type GroupFamily = typeof groupFamilies.$inferSelect
export type GroupShare = typeof groupShares.$inferSelect
export type Constraint = typeof constraints.$inferSelect
export type DayTemplate = typeof dayTemplates.$inferSelect
export type RecipeLink = typeof recipeLinks.$inferSelect
export type GroupLink = typeof groupLinks.$inferSelect
export type MealPlan = typeof mealPlans.$inferSelect
export type DayPlan = typeof dayPlans.$inferSelect
export type PlanShare = typeof planShares.$inferSelect
export type Family = typeof families.$inferSelect
export type FamilyMember = typeof familyMembers.$inferSelect
export type FamilyMealPlan = typeof familyMealPlans.$inferSelect
export type FamilyDayPlan = typeof familyDayPlans.$inferSelect
export type FamilyShare = typeof familyShares.$inferSelect
