"use client"

import { useParams } from "next/navigation"
import { SwissTournamentPanel } from "@/components/swiss/swiss-tournament-panel"

export default function SwissTournamentPage() {
  const params = useParams()
  const id = typeof params.id === "string" ? params.id : ""
  if (!id) return null
  return (
    <main className="min-h-screen bg-background">
      <SwissTournamentPanel tournamentId={id} />
    </main>
  )
}
