import { NextResponse } from "next/server"
import { searchFidePlayers } from "@/lib/fide/lichess-client"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")?.trim() ?? ""

    if (q.length < 2) {
      return NextResponse.json({ players: [] })
    }

    if (q.length > 80) {
      return NextResponse.json({ error: "Query too long" }, { status: 400 })
    }

    const players = await searchFidePlayers(q)
    return NextResponse.json(
      { players: players.slice(0, 20) },
      { headers: { "Cache-Control": "private, max-age=60" } },
    )
  } catch (err) {
    console.error("[api/fide/search]", err)
    return NextResponse.json({ error: "FIDE search unavailable" }, { status: 502 })
  }
}
