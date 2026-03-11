import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { submitMatchResultImpl, type SubmitResultResponse } from "@/lib/submit-match-result"
import { revalidatePath } from "next/cache"
import type { ResultType } from "@/lib/result-utils"

const DEBUG = process.env.NODE_ENV === "development"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { matchId, result, confirmed, playerId } = body as {
      matchId?: string
      result?: ResultType
      confirmed?: boolean
      playerId?: string
    }
    if (DEBUG) console.log("[api/submit] POST body:", { matchId, result, confirmed, playerId })

    if (!matchId || result == null || confirmed == null) {
      return NextResponse.json(
        { success: false, error: "Missing matchId, result, or confirmed" },
        { status: 400 },
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user && !playerId) {
      return NextResponse.json(
        { success: false, error: "Guest players must send playerId. Rejoin the tournament from the join link if you don't see your session." },
        { status: 400 },
      )
    }

    const validResults: ResultType[] = ["player1-win", "draw", "player2-win"]
    if (!validResults.includes(result)) {
      return NextResponse.json(
        { success: false, error: "Invalid result" },
        { status: 400 },
      )
    }

    const res: SubmitResultResponse = await submitMatchResultImpl(matchId, result, !!confirmed, {
      playerId: playerId ?? undefined,
      userId: user?.id,
    })
    if (DEBUG) console.log("[api/submit] submitMatchResultImpl result:", res.success, "matchCompleted:", res.matchCompleted, "error:", res.error)

    if (res.success && res.match?.tournament_id) {
      revalidatePath(`/tournament/${res.match.tournament_id}`)
    }

    return NextResponse.json(res)
  } catch (err) {
    console.error("[v0] API submit result error:", err)
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 },
    )
  }
}
