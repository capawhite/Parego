import { ArenaPanel } from "@/components/arena-panel"
import { loadTournament } from "@/lib/database/tournament-db"

export default async function TournamentPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = await params

  const tournament = await loadTournament(id)
  const tournamentName = tournament?.name || "Arena Tournament"

  return (
    <main className="min-h-screen bg-background">
      <ArenaPanel tournamentId={id} tournamentName={tournamentName} />
    </main>
  )
}
