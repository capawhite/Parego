import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { pairTournamentImpl } from "@/lib/pairing/pair-tournament"

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: tournamentId } = await context.params
    if (!tournamentId) {
      return NextResponse.json({ success: false, error: "Missing tournament id" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 })
    }

    const result = await pairTournamentImpl(tournamentId, user.id)
    if (!result.success) {
      const status =
        result.error?.includes("organizer") ? 403 : result.error?.includes("not found") ? 404 : 400
      return NextResponse.json(result, { status })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error("[api/pair] error:", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}
