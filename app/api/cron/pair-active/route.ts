import { NextResponse } from "next/server"
import { isPairingCronAuthorized, pairingCronSecretConfigured } from "@/lib/pairing/cron-auth"
import { pairActiveTournamentsImpl } from "@/lib/pairing/pair-tournament"
import { autoCompleteStaleTournamentsImpl } from "@/lib/tournament/auto-complete-stale"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Cron entrypoint: auto-complete stale tournaments, then pair active arenas.
 * Auth: Authorization: Bearer $PAIRING_CRON_SECRET
 */
export async function POST(request: Request) {
  try {
    if (!pairingCronSecretConfigured()) {
      return NextResponse.json(
        { success: false, error: "PAIRING_CRON_SECRET is not configured" },
        { status: 503 },
      )
    }
    if (!isPairingCronAuthorized(request)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const stale = await autoCompleteStaleTournamentsImpl()
    const summary = await pairActiveTournamentsImpl()
    if (!summary.success) {
      return NextResponse.json({ ...summary, stale }, { status: 500 })
    }
    return NextResponse.json({ ...summary, stale })
  } catch (err) {
    console.error("[api/cron/pair-active] error:", err)
    const { captureException } = await import("@/lib/sentry")
    captureException(err, { route: "api/cron/pair-active" })
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}

/** Some schedulers only support GET — same auth + behavior. */
export async function GET(request: Request) {
  return POST(request)
}
