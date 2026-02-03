import { ArenaPanel } from "@/components/arena-panel"
import { loadTournament } from "@/lib/database/tournament-db"
import { notFound } from "next/navigation"

export default async function TournamentPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = await params

  const tournament = await loadTournament(id)

  if (!tournament) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-background">
      <ArenaPanel tournamentId={id} tournamentName={tournament.name} />
    </main>
  )
}
