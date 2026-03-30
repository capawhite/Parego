import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { submitMatchResultImpl, type SubmitResultResponse } from "@/lib/submit-match-result"
import { revalidatePath } from "next/cache"
import type { ResultType } from "@/lib/result-utils"

const DEBUG = process.env.NODE_ENV === "development"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { matchId, result, confirmed } = body as {
      matchId?: string
      result?: ResultType
      confirmed?: boolean
    }
    if (DEBUG) console.log("[api/submit] POST body:", { matchId, result, confirmed })

    if (!matchId || result == null || confirmed == null) {
      const body: SubmitResultResponse = {
        success: false,
        error: "Missing matchId, result, or confirmed",
        errorCode: "BAD_REQUEST_MISSING_FIELDS",
      }
      return NextResponse.json(body, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const body: SubmitResultResponse = {
        success: false,
        error: "Sign in to submit a match result.",
        errorCode: "SIGN_IN_REQUIRED_TO_SUBMIT",
      }
      return NextResponse.json(body, { status: 401 })
    }

    const validResults: ResultType[] = ["player1-win", "draw", "player2-win"]
    if (!validResults.includes(result)) {
      const body: SubmitResultResponse = {
        success: false,
        error: "Invalid result",
        errorCode: "INVALID_RESULT",
      }
      return NextResponse.json(body, { status: 400 })
    }

    const res: SubmitResultResponse = await submitMatchResultImpl(matchId, result, !!confirmed, {
      userId: user.id,
    })
    if (DEBUG) console.log("[api/submit] submitMatchResultImpl result:", res.success, "matchCompleted:", res.matchCompleted, "error:", res.error)

    if (res.success && res.match?.tournament_id) {
      revalidatePath(`/tournament/${res.match.tournament_id}`)
    }

    return NextResponse.json(res)
  } catch (err) {
    console.error("[v0] API submit result error:", err)
    const body: SubmitResultResponse = {
      success: false,
      error: "Server error",
      errorCode: "INTERNAL_ERROR",
    }
    return NextResponse.json(body, { status: 500 })
  }
}
