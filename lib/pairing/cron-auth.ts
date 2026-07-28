import { timingSafeEqual } from "crypto"

const HEADER_NAME = "authorization"

/**
 * Accepts `Authorization: Bearer <PAIRING_CRON_SECRET>` or
 * `x-parego-pairing-secret: <PAIRING_CRON_SECRET>`.
 */
export function isPairingCronAuthorized(request: Request): boolean {
  const expected = process.env.PAIRING_CRON_SECRET?.trim()
  if (!expected) return false

  const auth = request.headers.get(HEADER_NAME)
  let provided: string | null = null
  if (auth?.toLowerCase().startsWith("bearer ")) {
    provided = auth.slice(7).trim()
  } else {
    provided = request.headers.get("x-parego-pairing-secret")?.trim() ?? null
  }

  if (!provided) return false
  try {
    const a = Buffer.from(provided)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function pairingCronSecretConfigured(): boolean {
  return Boolean(process.env.PAIRING_CRON_SECRET?.trim())
}
