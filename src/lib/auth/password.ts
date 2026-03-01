// Native Web Crypto — no deps needed
const ITERATIONS = 100_000
const KEY_LENGTH = 256
const DIGEST = "SHA-256"

async function deriveKey(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  )
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations: ITERATIONS, hash: DIGEST },
    keyMaterial,
    KEY_LENGTH,
  )
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await deriveKey(password, salt)
  return `${toHex(salt.buffer as ArrayBuffer)}:${toHex(hash)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":")
  const salt = fromHex(saltHex!)
  const hash = await deriveKey(password, salt)
  // Constant-time comparison
  const a = new Uint8Array(hash)
  const b = fromHex(hashHex!)
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!
  return diff === 0
}
