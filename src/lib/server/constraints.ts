import { createServerFn } from '@tanstack/react-start'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDbWithSchema } from '../db'
import { constraints, dayTemplates } from '../db/schema'
import { getUser } from '../auth/get-user'

function uid() {
  return crypto.randomUUID()
}

export const getMyConstraints = createServerFn({ method: 'GET' }).handler(
  async () => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')
    return db.select().from(constraints).where(eq(constraints.userId, user.id))
  },
)

const SaveConstraintInput = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  color: z.string(),
  emoji: z.string().optional(),
})

export const saveConstraint = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => SaveConstraintInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    if (data.id) {
      await db
        .update(constraints)
        .set({ name: data.name, color: data.color, emoji: data.emoji ?? null })
        .where(
          and(eq(constraints.id, data.id), eq(constraints.userId, user.id)),
        )
      return data.id
    } else {
      const id = uid()
      await db.insert(constraints).values({
        id,
        userId: user.id,
        name: data.name,
        color: data.color,
        emoji: data.emoji ?? null,
      })
      return id
    }
  })

export const deleteConstraint = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')
    await db
      .delete(constraints)
      .where(and(eq(constraints.id, data.id), eq(constraints.userId, user.id)))
  })

export const getDayTemplates = createServerFn({ method: 'GET' }).handler(
  async () => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')
    return db
      .select()
      .from(dayTemplates)
      .where(eq(dayTemplates.userId, user.id))
  },
)

const SaveDayTemplateInput = z.object({
  dayOfWeek: z.number().min(0).max(6),
  constraintIds: z.array(z.string()),
})

export const saveDayTemplate = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => SaveDayTemplateInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDbWithSchema()
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const existing = await db
      .select()
      .from(dayTemplates)
      .where(
        and(
          eq(dayTemplates.userId, user.id),
          eq(dayTemplates.dayOfWeek, data.dayOfWeek),
        ),
      )
      .limit(1)

    if (existing[0]) {
      await db
        .update(dayTemplates)
        .set({ constraintIds: JSON.stringify(data.constraintIds) })
        .where(
          and(
            eq(dayTemplates.userId, user.id),
            eq(dayTemplates.dayOfWeek, data.dayOfWeek),
          ),
        )
    } else {
      await db.insert(dayTemplates).values({
        id: uid(),
        userId: user.id,
        dayOfWeek: data.dayOfWeek,
        constraintIds: JSON.stringify(data.constraintIds),
      })
    }
  })
