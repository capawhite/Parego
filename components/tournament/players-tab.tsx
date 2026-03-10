"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { PlayersList } from "@/components/players-list"
import { UserSearchAutocomplete } from "@/components/user-search-autocomplete"
import { generateQRCode } from "@/lib/qr-utils"
import { cn } from "@/lib/utils"
import {
  Heart,
  Loader2,
  QrCode,
  UserPlus,
  MapPin,
  Check,
} from "lucide-react"
import Link from "next/link"
import type { Player } from "@/lib/types"
import type { InterestedUser } from "@/lib/database/tournament-db"

interface PlayersTabProps {
  tournamentId: string | null
  status: "setup" | "active" | "completed"
  isActive: boolean
  isOrganizer: boolean
  currentUserId: string | null
  isCurrentUserInTournament: boolean
  joiningSelf: boolean
  checkingIn: boolean
  markingPresentPlayerId: string | null
  renamingPlayerId: string | null
  players: Player[]
  maxSimultaneousPairings: number
  tableCountInput: string
  tournamentDurationInput: string
  canStartTournament: boolean
  canAccessQR: boolean
  interestCount: number
  interestedUsers: InterestedUser[]
  userInterested: boolean
  togglingInterest: boolean
  onTableCountChange: (value: string) => void
  onDurationChange: (value: string) => void
  onStartTournament: () => void
  onJoinAsSelf: () => void
  onCheckIn: () => void
  onAddGuestPlayer: () => void
  onSelectUser: (user: { id: string; name: string; rating: number | null }) => void
  onRemovePlayer: (playerId: string) => void
  onMarkPresent: (playerId: string) => Promise<void>
  onRenamePlayer: (playerId: string, newName: string) => Promise<void>
  onToggleInterest: () => void
}

export function PlayersTab({
  tournamentId,
  status,
  isActive,
  isOrganizer,
  currentUserId,
  isCurrentUserInTournament,
  joiningSelf,
  checkingIn,
  markingPresentPlayerId,
  renamingPlayerId,
  players,
  maxSimultaneousPairings,
  tableCountInput,
  tournamentDurationInput,
  canStartTournament,
  canAccessQR,
  interestCount,
  interestedUsers,
  userInterested,
  togglingInterest,
  onTableCountChange,
  onDurationChange,
  onStartTournament,
  onJoinAsSelf,
  onCheckIn,
  onAddGuestPlayer,
  onSelectUser,
  onRemovePlayer,
  onMarkPresent,
  onRenamePlayer,
  onToggleInterest,
}: PlayersTabProps) {
  const me = players.find((p) => p.userId === currentUserId && !p.hasLeft)
  const needsCheckIn = me && me.checkedInAt == null

  return (
    <div className="space-y-2">
      {/* Express interest card */}
      <Card className="mb-4 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-primary" />
              Interest
            </span>
            {interestCount > 0 && (
              <span className="text-muted-foreground font-normal">
                {interestCount} {interestCount === 1 ? "person" : "people"} interested
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentUserId && (
            <Button
              variant={userInterested ? "secondary" : "outline"}
              size="sm"
              className="w-full sm:w-auto"
              onClick={onToggleInterest}
              disabled={togglingInterest}
            >
              {togglingInterest ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Heart className={cn("h-4 w-4 mr-2", userInterested && "fill-current")} />
              )}
              {userInterested ? "Interested" : "I'm interested"}
            </Button>
          )}
          {!currentUserId && interestCount > 0 && (
            <p className="text-xs text-muted-foreground">
              <Link href="/auth/login" className="text-primary hover:underline">
                Sign in
              </Link>{" "}
              to express interest
            </p>
          )}
          {isOrganizer && interestedUsers.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Interested</p>
              <ul className="text-sm space-y-1">
                {interestedUsers.map((u) => (
                  <li key={u.user_id}>{u.name ?? "Unknown"}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tournament Setup Card - only in setup status */}
      {status === "setup" && (
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tournament Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[120px] space-y-1.5">
                <Label htmlFor="tables" className="text-sm">
                  Tables
                </Label>
                <Input
                  id="tables"
                  type="number"
                  placeholder="# of tables"
                  value={tableCountInput}
                  onChange={(e) => onTableCountChange(e.target.value)}
                  className="w-20 h-8 text-sm"
                  disabled={!isOrganizer}
                />
              </div>
              <div className="flex-1 min-w-[120px] space-y-1.5">
                <Label htmlFor="duration" className="text-sm">
                  Duration (min)
                </Label>
                <Input
                  id="duration"
                  type="number"
                  placeholder="Min"
                  value={tournamentDurationInput}
                  onChange={(e) => onDurationChange(e.target.value)}
                  className="w-20 h-8 text-sm"
                  disabled={!isOrganizer}
                />
              </div>
              {canStartTournament && (
                <Button onClick={onStartTournament} className="w-full h-8 text-sm" size="sm">
                  Start Tournament
                </Button>
              )}
              {!isOrganizer && (
                <p className="text-xs text-muted-foreground text-center py-2 flex-1">
                  Waiting for organizer to start the tournament
                </p>
              )}
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">
                {players.length} players • Need {maxSimultaneousPairings} tables for full pairings
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* QR / join link card */}
      {tournamentId && canAccessQR && (
        <Card className="p-2 bg-primary/5 mb-4">
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0">
              <div className="bg-white p-1 rounded border border-primary/20">
                <img
                  src={generateQRCode(`${window.location.origin}/join/${tournamentId}`) || "/placeholder.svg"}
                  alt="QR Code"
                  className="w-14 h-14"
                />
              </div>
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-1.5">
                <QrCode className="h-3.5 w-3.5 flex-shrink-0" />
                <h3 className="font-semibold text-xs">Player Join Link</h3>
              </div>
              <div className="flex gap-1">
                <Input
                  value={`${window.location.origin}/join/${tournamentId}`}
                  readOnly
                  className="text-[11px] font-mono h-7 flex-1 min-w-0"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 bg-transparent text-xs flex-shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/join/${tournamentId}`)
                  }}
                >
                  Copy
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                ID: <span className="font-mono font-semibold">{tournamentId}</span>
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Players list card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Players ({players.filter((p) => !p.hasLeft).length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(!isActive || (isActive && true)) && status !== "completed" && (
            <div className="space-y-3">
              {currentUserId && !isOrganizer && !isCurrentUserInTournament && (
                <Button onClick={onJoinAsSelf} className="w-full" disabled={joiningSelf}>
                  {joiningSelf ? (
                    <>
                      <MapPin className="mr-2 h-4 w-4" />
                      Verifying location...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Join Tournament
                    </>
                  )}
                </Button>
              )}

              {currentUserId && !isOrganizer && isCurrentUserInTournament && (
                <div className="space-y-2">
                  {needsCheckIn ? (
                    <Button
                      onClick={onCheckIn}
                      disabled={checkingIn}
                      variant="default"
                      className="w-full"
                    >
                      {checkingIn ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <MapPin className="h-4 w-4 mr-2" />
                      )}
                      Check in at venue
                    </Button>
                  ) : (
                    <div className="text-center text-sm text-muted-foreground p-3 border rounded-lg bg-primary/5">
                      <Check className="inline-block mr-1 h-4 w-4 text-green-500" />
                      You have joined this tournament
                    </div>
                  )}
                </div>
              )}

              {isOrganizer && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Search Registered Players
                    </label>
                    <UserSearchAutocomplete onSelectUser={onSelectUser} />
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or add guest</span>
                    </div>
                  </div>

                  <Button
                    onClick={onAddGuestPlayer}
                    variant="outline"
                    className="w-full h-8 text-sm bg-transparent"
                  >
                    Add Guest Player
                  </Button>
                </>
              )}

              {!currentUserId && (
                <div className="space-y-3">
                  <Button onClick={onAddGuestPlayer} variant="outline" className="w-full bg-transparent">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Join as Guest
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    <Link href="/auth/login" className="text-primary hover:underline">
                      Login
                    </Link>{" "}
                    or{" "}
                    <Link href="/auth/signup" className="text-primary hover:underline">
                      register
                    </Link>{" "}
                    to track your progress
                  </p>
                </div>
              )}
            </div>
          )}

          <PlayersList
            players={players}
            onRemovePlayer={onRemovePlayer}
            onMarkPresent={isOrganizer ? onMarkPresent : undefined}
            markingPresentPlayerId={markingPresentPlayerId}
            onRenamePlayer={isOrganizer ? onRenamePlayer : undefined}
            renamingPlayerId={renamingPlayerId}
            status={status}
            isOrganizer={isOrganizer}
            currentUserId={currentUserId}
          />
        </CardContent>
      </Card>
    </div>
  )
}
