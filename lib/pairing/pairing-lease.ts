import type { SupabaseClient } from "@supabase/supabase-js"

/** Default lease TTL — longer than a pair tick, shorter than cron interval. */
export const PAIRING_LEASE_TTL_SECONDS = 20

export function pairingLeaseHolderId(mode: "organizer" | "system", organizerUserId: string | null): string {
  if (mode === "system") {
    return `system:${crypto.randomUUID()}`
  }
  return `organizer:${organizerUserId ?? "unknown"}`
}

/**
 * Pure check used in tests / diagnostics.
 * A lease is free if missing, expired, or owned by the same holder.
 */
export function isPairingLeaseAvailable(input: {
  nowMs: number
  leaseUntilMs: number | null
  leaseHolder: string | null
  claimant: string
}): boolean {
  const { nowMs, leaseUntilMs, leaseHolder, claimant } = input
  if (leaseUntilMs == null || leaseUntilMs < nowMs) return true
  if (leaseHolder != null && leaseHolder === claimant) return true
  return false
}

export async function claimPairingLease(
  admin: SupabaseClient,
  tournamentId: string,
  holder: string,
  ttlSeconds: number = PAIRING_LEASE_TTL_SECONDS,
): Promise<boolean> {
  const { data, error } = await admin.rpc("claim_pairing_lease", {
    p_tournament_id: tournamentId,
    p_holder: holder,
    p_ttl_seconds: ttlSeconds,
  })
  if (error) {
    console.error("[pairing-lease] claim failed:", error)
    // Fail open only if RPC missing (migration not applied yet) — prefer skip? Fail closed is safer
    // once shipped; during rollout without SQL, pairings would stop. Fail open with warning:
    if (error.message?.includes("claim_pairing_lease") || error.code === "PGRST202") {
      console.warn("[pairing-lease] RPC missing — pairing without lease (apply migration)")
      return true
    }
    return false
  }
  return data === true
}

export async function releasePairingLease(
  admin: SupabaseClient,
  tournamentId: string,
  holder: string,
): Promise<void> {
  const { error } = await admin.rpc("release_pairing_lease", {
    p_tournament_id: tournamentId,
    p_holder: holder,
  })
  if (error && error.code !== "PGRST202" && !error.message?.includes("release_pairing_lease")) {
    console.error("[pairing-lease] release failed:", error)
  }
}
