"use client"

import { Card, CardContent } from "@/components/ui/card"
import type { Match } from "@/lib/types"

interface PairingsGridProps {
  matches: Match[]
}

export function PairingsGrid({ matches }: PairingsGridProps) {
  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            No active pairings. Waiting for more players to be available.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
      {matches.map((match) => (
        <div
          key={match.id}
          className="border-2 rounded-lg hover:bg-accent/50 transition-colors overflow-hidden"
        >
          {match.tableNumber && (
            <div className="bg-amber-700 px-3 py-1 flex items-center gap-2">
              <span className="text-white font-bold text-sm">Table {match.tableNumber}</span>
            </div>
          )}
          <div className="p-2 space-y-1">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded px-2 py-1">
              <div className="w-4 h-4 bg-white border-2 border-gray-300 rounded-sm flex-shrink-0" />
              <span className="font-semibold text-sm break-words">{match.player1.name}</span>
            </div>
            <div className="text-center text-xs text-muted-foreground">vs</div>
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded px-2 py-1">
              <div className="w-4 h-4 bg-gray-900 border-2 border-gray-600 rounded-sm flex-shrink-0" />
              <span className="font-semibold text-sm break-words">{match.player2.name}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
