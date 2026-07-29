const STORAGE_KEY = "parego_guest_history"
const MAX_ENTRIES = 20
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export interface GuestSessionEntry {
  tournamentId: string
  playerId: string
  displayName: string
  lastPlayedAt: string // ISO string
  /** Optional strength band remembered for one-tap rejoin */
  ratingBand?: string
}

function getStorage(): GuestSessionEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is GuestSessionEntry =>
        e != null &&
        typeof e === "object" &&
        typeof e.tournamentId === "string" &&
        typeof e.playerId === "string" &&
        typeof e.displayName === "string" &&
        typeof e.lastPlayedAt === "string",
    )
  } catch {
    return []
  }
}

function setStorage(entries: GuestSessionEntry[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // ignore
  }
}

/** Prune old entries and cap size. */
function prune(entries: GuestSessionEntry[]): GuestSessionEntry[] {
  const now = Date.now()
  return entries
    .filter((e) => now - new Date(e.lastPlayedAt).getTime() < MAX_AGE_MS)
    .slice(-MAX_ENTRIES)
}

/**
 * Append a guest session to history. Call after a guest successfully joins a tournament.
 * Automatically prunes entries older than 30 days and caps at 20 entries.
 */
export function addGuestSession(entry: Omit<GuestSessionEntry, "lastPlayedAt">) {
  const entries = getStorage()
  const now = new Date().toISOString()
  const updated = [...entries, { ...entry, lastPlayedAt: now }]
  setStorage(prune(updated))
}

/**
 * Get recent guest sessions from this device. Used for "you've played before" prompts
 * and for the claim flow at signup.
 */
export function getGuestSessionHistory(): GuestSessionEntry[] {
  return prune(getStorage())
}

/**
 * Clear all guest session history from this device.
 * Call after a successful claim so the entries are not re-submitted on next sign-in.
 */
export function clearGuestSessionHistory(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

const CONVERSION_DISMISSED_KEY = "parego_conversion_dismissed"
const SECOND_JOIN_NUDGE_KEY = "parego_second_join_nudge_count"
export const SECOND_JOIN_NUDGE_SOFT_LIMIT = 2

/** Check if the user has dismissed this conversion prompt this session. */
export function getConversionPromptDismissed(triggerKey: string): boolean {
  if (typeof window === "undefined") return false
  try {
    const raw = sessionStorage.getItem(CONVERSION_DISMISSED_KEY)
    if (!raw) return false
    const set = new Set(JSON.parse(raw) as string[])
    return set.has(triggerKey)
  } catch {
    return false
  }
}

/** Mark this conversion prompt as dismissed for this session. */
export function setConversionPromptDismissed(triggerKey: string): void {
  if (typeof window === "undefined") return
  try {
    const raw = sessionStorage.getItem(CONVERSION_DISMISSED_KEY)
    const set = new Set<string>(raw ? JSON.parse(raw) : [])
    set.add(triggerKey)
    sessionStorage.setItem(CONVERSION_DISMISSED_KEY, JSON.stringify([...set]))
  } catch {
    // ignore
  }
}

/** Most recent guest display name on this device (for one-tap rejoin). */
export function getLastGuestDisplayName(): string | null {
  const entries = getGuestSessionHistory()
  if (entries.length === 0) return null
  const last = entries[entries.length - 1]
  return last?.displayName?.trim() || null
}

/** Most recent guest strength band if stored. */
export function getLastGuestRatingBand(): string | null {
  const entries = getGuestSessionHistory()
  if (entries.length === 0) return null
  const last = entries[entries.length - 1]
  const band = last?.ratingBand?.trim()
  return band || null
}

/** True if this device has joined at least one tournament as a guest before. */
export function hasPriorGuestSessions(excludeTournamentId?: string): boolean {
  const entries = getGuestSessionHistory()
  if (!excludeTournamentId) return entries.length > 0
  return entries.some((e) => e.tournamentId !== excludeTournamentId)
}

export function getSecondJoinNudgeCount(): number {
  if (typeof window === "undefined") return 0
  try {
    const raw = localStorage.getItem(SECOND_JOIN_NUDGE_KEY)
    const n = raw ? Number.parseInt(raw, 10) : 0
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

export function incrementSecondJoinNudgeCount(): number {
  const next = getSecondJoinNudgeCount() + 1
  if (typeof window === "undefined") return next
  try {
    localStorage.setItem(SECOND_JOIN_NUDGE_KEY, String(next))
  } catch {
    // ignore
  }
  return next
}
