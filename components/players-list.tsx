"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LogOut, MapPin, CheckCircle2, Loader2, Pencil } from "lucide-react"
import type { Player } from "@/lib/types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useState } from "react"

interface PlayersListProps {
  players: Player[]
  onRemovePlayer: (playerId: string) => void
  onTogglePause?: (playerId: string) => void
  /** Organizer marks player as present (override). Optional; when provided, "Mark present" is shown for players not checked in. */
  onMarkPresent?: (playerId: string) => Promise<void>
  /** When marking a player present, pass the player id to show loading state */
  markingPresentPlayerId?: string | null
  /** Organizer renames a player. Optional; when provided, "Rename" is shown for organizer. */
  onRenamePlayer?: (playerId: string, newName: string) => Promise<void>
  /** When renaming, pass the player id to show loading state */
  renamingPlayerId?: string | null
  status: "setup" | "active" | "completed"
  allowPause?: boolean
  showRemovedPlayers?: boolean
  isOrganizer?: boolean
  currentUserId?: string | null
}

export function PlayersList({
  players,
  onRemovePlayer,
  onTogglePause,
  onMarkPresent,
  markingPresentPlayerId = null,
  onRenamePlayer,
  renamingPlayerId = null,
  status,
  allowPause = true,
  showRemovedPlayers = false,
  isOrganizer = false,
  currentUserId = null,
}: PlayersListProps) {
  const [confirmRemovalPlayerId, setConfirmRemovalPlayerId] = useState<string | null>(null)
  const [renamePlayerId, setRenamePlayerId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [renameError, setRenameError] = useState<string | null>(null)
  const confirmRemovalPlayer = players.find((p) => p.id === confirmRemovalPlayerId)
  const renamePlayer = players.find((p) => p.id === renamePlayerId)

  const isActive = status === "active"

  const activeCount = players.filter(
    (p) => p.active && !p.paused && !p.markedForRemoval && !p.markedForPause,
  ).length

  const activePlayers = players.filter((p) => !p.markedForRemoval)
  const removedPlayers = players.filter((p) => p.markedForRemoval)

  const canRemovePlayer = (player: Player) => {
    // Organizer can remove anyone
    if (isOrganizer) return true
    // Players can only remove themselves (if they have a userId and it matches)
    if (currentUserId && player.userId === currentUserId) return true
    return false
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Players ({activeCount}/{players.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {players.length === 0 ? (
            <p className="text-muted-foreground text-center py-2 text-xs">No players yet</p>
          ) : (
            <div className="space-y-0.5">
              {/* Active players */}
              {activePlayers.map((player) => (
                <div
                  key={player.id}
                  className="flex justify-between items-center gap-2 p-1.5 bg-muted rounded hover:bg-muted/80 text-sm"
                  style={{ opacity: player.markedForPause ? 0.5 : 1 }}
                >
                  <Avatar className="size-8 shrink-0">
                    {player.avatarUrl ? (
                      <AvatarImage src={player.avatarUrl} alt={player.name} />
                    ) : null}
                    <AvatarFallback className="text-xs font-medium">
                      {player.name
                        .split(/\s+/)
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-medium text-sm">{player.name}</span>
                      {isActive && !player.paused && !player.markedForPause && (
                        <span className="text-[10px] px-1 py-0.5 bg-chart-4/20 text-chart-4 rounded">Active</span>
                      )}
                      {isActive && player.paused && (
                        <span className="text-[10px] px-1 py-0.5 bg-destructive/20 text-destructive rounded">
                          Removed
                        </span>
                      )}
                      {player.markedForPause && (
                        <span className="text-[10px] px-1 py-0.5 bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 rounded">
                          Pause Pending
                        </span>
                      )}
                      {player.streak > 0 && (
                        <span className="text-[10px] px-1 py-0.5 bg-accent text-accent-foreground rounded font-semibold">
                          {player.streak} streak
                        </span>
                      )}
                      {currentUserId && player.userId === currentUserId && (
                        <span className="text-[10px] px-1 py-0.5 bg-primary/20 text-primary rounded font-semibold">
                          You
                        </span>
                      )}
                      {player.checkedInAt != null ? (
                        <span className="text-[10px] px-1 py-0.5 bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded flex items-center gap-0.5">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          Checked in
                        </span>
                      ) : (
                        <span className="text-[10px] px-1 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5" />
                          Pending check-in
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{player.gamesPlayed} games</p>
                  </div>
                  <div className="text-right mx-2 flex-shrink-0">
                    <p className="font-semibold text-sm">{player.score} pts</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {isActive && onTogglePause && allowPause && (
                      <Button
                        variant={player.paused ? "default" : "outline"}
                        size="sm"
                        onClick={() => onTogglePause(player.id)}
                        disabled={false}
                        className="h-7 px-2 text-[11px]"
                      >
                        {player.paused ? "Resume" : player.markedForPause ? "Cancel" : "Pause"}
                      </Button>
                    )}
                    {isOrganizer && onMarkPresent && player.checkedInAt == null && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onMarkPresent(player.id)}
                        disabled={markingPresentPlayerId === player.id}
                        className="h-7 px-2 text-[11px]"
                      >
                        {markingPresentPlayerId === player.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>Mark present</>
                        )}
                      </Button>
                    )}
                    {isOrganizer && onRenamePlayer && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setRenamePlayerId(player.id)
                          setRenameValue(player.name)
                          setRenameError(null)
                        }}
                        disabled={renamingPlayerId === player.id}
                        className="h-7 px-2 text-[11px]"
                        title="Rename"
                      >
                        {renamingPlayerId === player.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Pencil className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                    {canRemovePlayer(player) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmRemovalPlayerId(player.id)}
                        className="h-7 px-2 text-[11px]"
                      >
                        {currentUserId && player.userId === currentUserId && !isOrganizer ? "Leave" : "Remove"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {showRemovedPlayers && removedPlayers.length > 0 && (
                <>
                  <div className="pt-2 border-t">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Left Tournament</p>
                  </div>
                  {removedPlayers.map((player) => (
                    <div
                      key={player.id}
                      className="flex justify-between items-center gap-2 p-1.5 bg-muted/50 rounded opacity-60 text-sm"
                    >
                      <Avatar className="size-8 shrink-0 opacity-75">
                        {player.avatarUrl ? (
                          <AvatarImage src={player.avatarUrl} alt={player.name} />
                        ) : null}
                        <AvatarFallback className="text-xs font-medium">
                          {player.name
                            .split(/\s+/)
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm">{player.name}</span>
                          <span className="text-[10px] px-1 py-0.5 bg-destructive/20 text-destructive rounded flex items-center gap-0.5">
                            <LogOut className="h-2.5 w-2.5" />
                            Left
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{player.gamesPlayed} games</p>
                      </div>
                      <div className="text-right mx-2 flex-shrink-0">
                        <p className="font-semibold text-sm text-muted-foreground">{player.score} pts</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmRemovalPlayerId} onOpenChange={(open) => !open && setConfirmRemovalPlayerId(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>
            {currentUserId && confirmRemovalPlayer?.userId === currentUserId && !isOrganizer
              ? "Leave Tournament"
              : "Remove Player"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {currentUserId && confirmRemovalPlayer?.userId === currentUserId && !isOrganizer
              ? "Are you sure you want to leave the tournament? Your results will be preserved."
              : `Are you sure you want to remove ${confirmRemovalPlayer?.name} from the tournament? Their results will be preserved.`}
          </AlertDialogDescription>
          <div className="flex gap-3 justify-end pt-4">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmRemovalPlayerId) {
                  onRemovePlayer(confirmRemovalPlayerId)
                  setConfirmRemovalPlayerId(null)
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {currentUserId && confirmRemovalPlayer?.userId === currentUserId && !isOrganizer ? "Leave" : "Remove"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!renamePlayerId}
        onOpenChange={(open) => {
          if (!open) {
            setRenamePlayerId(null)
            setRenameError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename player</DialogTitle>
            <DialogDescription>
              Change the display name for {renamePlayer?.name}. This will update pairings and standings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Input
              value={renameValue}
              onChange={(e) => {
                setRenameValue(e.target.value)
                setRenameError(null)
              }}
              placeholder="Player name"
              className="h-10"
            />
            {renameError && <p className="text-sm text-destructive">{renameError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamePlayerId(null)}>
              Cancel
            </Button>
            <Button
              disabled={!renameValue.trim() || renamingPlayerId === renamePlayerId}
              onClick={async () => {
                if (!renamePlayerId || !onRenamePlayer || !renameValue.trim()) return
                setRenameError(null)
                try {
                  await onRenamePlayer(renamePlayerId, renameValue.trim())
                  setRenamePlayerId(null)
                } catch (e) {
                  setRenameError(e instanceof Error ? e.message : "Could not rename")
                }
              }}
            >
              {renamingPlayerId === renamePlayerId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
