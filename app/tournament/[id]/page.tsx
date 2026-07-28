import { ArenaPanel } from "@/components/arena-panel"
import { loadTournamentServer, parseTournamentSettings } from "@/lib/database/tournament-db-server"
import { notFound, redirect } from "next/navigation"

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

  const settings = parseTournamentSettings(tournament)
  if (settings.pairingAlgorithm === "fide-swiss") {
    redirect(`/tournament/${id}/swiss`)
  }

  return (
    <main className="min-h-screen bg-background">
      <ArenaPanel tournamentId={id} tournamentName={tournament.name} />
    </main>
  )
}
