import { createServerFn } from '@tanstack/react-start'
import {
  deleteCookie,
  getCookie,
  setCookie,
} from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { users } from '../db/schema'
import { hashPassword, verifyPassword } from '../auth/password'
import { SESSION_COOKIE, createSession, deleteSession } from '../auth/session'
import { getUser } from '../auth/get-user'

function uid() {
  return crypto.randomUUID()
}

const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export const login = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({ email: z.string().email(), password: z.string().min(1) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1)
    if (!user) throw new Error('Invalid email or password')

    const valid = await verifyPassword(data.password, user.passwordHash)
    if (!valid) throw new Error('Invalid email or password')

    const sessionId = await createSession(user.id)
    setCookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    })

    return { userId: user.id }
  })

export const register = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(8),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1)
    if (existing[0]) throw new Error('Email already registered')

    const passwordHash = await hashPassword(data.password)
    const id = uid()
    await db
      .insert(users)
      .values({ id, email: data.email, name: data.name, passwordHash })

    const sessionId = await createSession(id)
    setCookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    })

    return { userId: id }
  })

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  const sessionId = getCookie(SESSION_COOKIE)
  if (sessionId) await deleteSession(sessionId)
  deleteCookie(SESSION_COOKIE, { path: '/' })
})

export const updateProfile = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({ name: z.string().min(1), email: z.string().email() })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')
    await db
      .update(users)
      .set({ name: data.name, email: data.email })
      .where(eq(users.id, user.id))
  })

export const changePassword = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({ currentPassword: z.string(), newPassword: z.string().min(8) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const user = await getUser()
    if (!user) throw new Error('Unauthorized')

    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
    if (!dbUser) throw new Error('User not found')

    const valid = await verifyPassword(
      data.currentPassword,
      dbUser.passwordHash,
    )
    if (!valid) throw new Error('Current password is incorrect')

    const newHash = await hashPassword(data.newPassword)
    await db
      .update(users)
      .set({ passwordHash: newHash })
      .where(eq(users.id, user.id))
  })
