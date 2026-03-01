import { db } from "../db"
import { sessions, users } from "../db/schema"
import { eq, and, gt } from "drizzle-orm"
import type { User } from "../db/schema"

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
export const SESSION_COOKIE = "sp_session"

function generateId(length = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function createSession(userId: string): Promise<string> {
  const id = generateId()
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
  await db.insert(sessions).values({ id, userId, expiresAt })
  return id
}

export async function validateSession(
  sessionId: string,
): Promise<{ user: User; sessionId: string } | null> {
  const now = new Date()
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
    .limit(1)

  if (!rows[0]) return null

  // Slide expiry if more than halfway through
  const { session, user } = rows[0]
  const halfLife = SESSION_DURATION_MS / 2
  if (session.expiresAt.getTime() - Date.now() < halfLife) {
    const newExpiry = new Date(Date.now() + SESSION_DURATION_MS)
    await db.update(sessions).set({ expiresAt: newExpiry }).where(eq(sessions.id, sessionId))
  }

  return { user, sessionId }
}

export async function deleteSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId))
}
