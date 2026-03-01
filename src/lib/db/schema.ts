import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
})

export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  inviteCode: text("invite_code").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const groupMembers = sqliteTable("group_members", {
  groupId: text("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["admin", "member"] })
    .notNull()
    .default("member"),
  joinedAt: integer("joined_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const constraints = sqliteTable("constraints", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6b7280"),
  emoji: text("emoji"),
})

export const dayTemplates = sqliteTable("day_templates", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Mon, 6=Sun
  constraintIds: text("constraint_ids").notNull().default("[]"), // JSON array
})

export const recipeLinks = sqliteTable("recipe_links", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  type: text("type", { enum: ["website", "recipe"] })
    .notNull()
    .default("recipe"),
  tags: text("tags").notNull().default("[]"), // JSON array
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const groupLinks = sqliteTable("group_links", {
  groupId: text("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  recipeLinkId: text("recipe_link_id")
    .notNull()
    .references(() => recipeLinks.id, { onDelete: "cascade" }),
  addedBy: text("added_by")
    .notNull()
    .references(() => users.id),
  addedAt: integer("added_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const mealPlans = sqliteTable("meal_plans", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  weekStart: text("week_start").notNull(), // ISO date string "YYYY-MM-DD" (always Monday)
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const dayPlans = sqliteTable("day_plans", {
  id: text("id").primaryKey(),
  mealPlanId: text("meal_plan_id")
    .notNull()
    .references(() => mealPlans.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Mon, 6=Sun
  mealName: text("meal_name"),
  notes: text("notes"),
  recipeLinkId: text("recipe_link_id").references(() => recipeLinks.id, {
    onDelete: "set null",
  }),
  constraintIds: text("constraint_ids").notNull().default("[]"), // JSON array
})

export const planShares = sqliteTable("plan_shares", {
  mealPlanId: text("meal_plan_id")
    .notNull()
    .references(() => mealPlans.id, { onDelete: "cascade" }),
  groupId: text("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  sharedAt: integer("shared_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
})

// Types
export type User = typeof users.$inferSelect
export type Session = typeof sessions.$inferSelect
export type Group = typeof groups.$inferSelect
export type GroupMember = typeof groupMembers.$inferSelect
export type Constraint = typeof constraints.$inferSelect
export type DayTemplate = typeof dayTemplates.$inferSelect
export type RecipeLink = typeof recipeLinks.$inferSelect
export type GroupLink = typeof groupLinks.$inferSelect
export type MealPlan = typeof mealPlans.$inferSelect
export type DayPlan = typeof dayPlans.$inferSelect
export type PlanShare = typeof planShares.$inferSelect
