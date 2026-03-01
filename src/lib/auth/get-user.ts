import { getCookie } from "@tanstack/react-start/server"
import { validateSession, SESSION_COOKIE } from "./session"
import type { User } from "../db/schema"

export async function getUser(): Promise<User | null> {
  const sessionId = getCookie(SESSION_COOKIE)
  if (!sessionId) return null
  const result = await validateSession(sessionId)
  return result?.user ?? null
}
