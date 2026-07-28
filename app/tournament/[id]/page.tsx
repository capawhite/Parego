import { ArenaPanel } from "@/components/arena-panel"
import { loadTournamentServer } from "@/lib/database/tournament-db-server"
import { notFound } from "next/navigation"

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const tournament = await loadTournamentServer(id)

  if (!tournament) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-background">
      <ArenaPanel tournamentId={id} tournamentName={tournament.name} />
    </main>
  )
}
