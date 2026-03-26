"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PlayersList } from "@/components/players-list"
import { UserSearchAutocomplete } from "@/components/user-search-autocomplete"
import { generateQRCode } from "@/lib/qr-utils"
import type { Player } from "@/lib/types"
import Image from "next/image"
import { Check, Loader2, MapPin, QrCode, UserPlus } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useI18n } from "@/components/i18n-provider"

export interface ArenaPlayersTabProps {
  tournamentId: string | null
  status: "setup" | "active" | "completed"
  isActive: boolean
  allowLateJoin: boolean
  players: Player[]
  maxSimultaneousPairings: number
  tableCountInput: string
  tournamentDurationInput: string
  isOrganizer: boolean
  currentUserId: string | null
  isCurrentUserInTournament: boolean
  joiningSelf: boolean
  checkingIn: boolean
  markingPresentPlayerId: string | null
  renamingPlayerId: string | null
  canStartTournament: boolean
  canAccessQR: boolean
  onTableCountChange: (value: string) => void
  onDurationChange: (value: string) => void
  onStartTournament: () => void
  onJoinAsSelf: () => void
  onCheckIn: () => void
  onAddGuestPlayer: () => void
  onSelectUser: (user: { id: string; name: string; rating: number | null }) => void
  onRemovePlayer: (playerId: string) => void
  onTogglePause?: (playerId: string) => void
  onMarkPresent?: (playerId: string) => Promise<void>
  onRenamePlayer?: (playerId: string, newName: string) => Promise<void>
}

/**
 * Players tab body: setup, QR/join link, add players, and list.
 * Kept stateless; parent owns handlers and arena state.
 */
export function ArenaPlayersTab({
  tournamentId,
  status,
  isActive,
  allowLateJoin,
  players,
  maxSimultaneousPairings,
  tableCountInput,
  tournamentDurationInput,
  isOrganizer,
  currentUserId,
  isCurrentUserInTournament,
  joiningSelf,
  checkingIn,
  markingPresentPlayerId,
  renamingPlayerId,
  canStartTournament,
  canAccessQR,
  onTableCountChange,
  onDurationChange,
  onStartTournament,
  onJoinAsSelf,
  onCheckIn,
  onAddGuestPlayer,
  onSelectUser,
  onRemovePlayer,
  onTogglePause,
  onMarkPresent,
  onRenamePlayer,
}: ArenaPlayersTabProps) {
  const { t } = useI18n()
  const [joinOrigin, setJoinOrigin] = useState("")
  useEffect(() => {
    setJoinOrigin(window.location.origin)
  }, [])
  const joinUrl = joinOrigin && tournamentId ? `${joinOrigin}/join/${tournamentId}` : ""
  const qrSrc = joinUrl ? generateQRCode(joinUrl) : ""

  return (
    <>
      {status === "setup" &&
        (isOrganizer ? (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("arena.setupTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="tables" className="text-sm">
                      {t("arena.setupTables")}
                    </Label>
                    <Input
                      id="tables"
                      type="number"
                      placeholder={t("arena.setupTablesPlaceholder")}
                      value={tableCountInput}
                      onChange={(e) => onTableCountChange(e.target.value)}
                      className="h-9 w-20 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="duration" className="text-sm">
                      {t("arena.setupDuration")}
                    </Label>
                    <Input
                      id="duration"
                      type="number"
                      placeholder={t("arena.setupDurationPlaceholder")}
                      value={tournamentDurationInput}
                      onChange={(e) => onDurationChange(e.target.value)}
                      className="h-9 w-20 text-sm"
                    />
                  </div>
                </div>
                {canStartTournament && (
                  <Button
                    type="button"
                    onClick={onStartTournament}
                    className="h-10 w-fit rounded-full px-6 text-sm font-semibold shadow-md transition-[box-shadow,transform] hover:shadow-lg active:scale-[0.98]"
                  >
                    {t("arena.setupStartTournament")}
                  </Button>
                )}
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">
                  {t("arena.setupPlayersNeedTables", {
                    players: players.length,
                    tables: maxSimultaneousPairings,
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-4 border-amber-400/30 bg-amber-50/40 dark:bg-amber-950/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-amber-500 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm">{t("arena.waitingForOrganizer")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("arena.playersRegisteredSoFar", { count: players.filter((p) => !p.hasLeft).length })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

      {tournamentId && canAccessQR && (
        <Card className="p-2 bg-primary/5 mb-4">
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0">
              <div className="bg-white p-1 rounded border border-primary/20">
                {qrSrc ? (
                  <Image
                    src={qrSrc}
                    alt={t("arena.qrJoinCodeAlt")}
                    width={56}
                    height={56}
                    className="h-14 w-14"
                    unoptimized
                  />
                ) : (
                  <div className="h-14 w-14 animate-pulse rounded bg-muted" aria-hidden />
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-1.5">
                <QrCode className="h-3.5 w-3.5 flex-shrink-0" />
                <h3 className="font-semibold text-xs">{t("arena.playerJoinLink")}</h3>
              </div>
              <div className="flex gap-1">
                <Input
                  value={joinUrl}
                  readOnly
                  className="text-[11px] font-mono h-7 flex-1 min-w-0"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 bg-transparent text-xs flex-shrink-0"
                  onClick={() => {
                    if (!joinUrl) return
                    navigator.clipboard.writeText(joinUrl)
                    toast.success(t("common.linkCopied"))
                  }}
                >
                  {t("arena.copy")}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {t("arena.tournamentIdLabel")}{" "}
                <span className="font-mono font-semibold">{tournamentId}</span>
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {t("tournamentHeader.playersTab")} ({players.filter((p) => !p.hasLeft).length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(!isActive || (isActive && allowLateJoin)) && status !== "completed" && (
            <div className="space-y-3">
              {currentUserId && !isOrganizer && !isCurrentUserInTournament && (
                <Button onClick={onJoinAsSelf} className="w-full" disabled={joiningSelf}>
                  {joiningSelf ? (
                    <>
                      <MapPin className="mr-2 h-4 w-4" />
                      {t("arena.verifyingLocation")}
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      {t("arena.joinTournament")}
                    </>
                  )}
                </Button>
              )}

              {currentUserId && !isOrganizer && isCurrentUserInTournament && (() => {
                const me = players.find((p) => p.userId === currentUserId && !p.hasLeft)
                const needsCheckIn = me && me.checkedInAt == null
                return (
                  <div className="space-y-2">
                    {needsCheckIn ? (
                      <Button onClick={onCheckIn} disabled={checkingIn} variant="default" className="w-full">
                        {checkingIn ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <MapPin className="h-4 w-4 mr-2" />
                        )}
                        {t("arena.checkInAtVenue")}
                      </Button>
                    ) : (
                      <div className="text-center text-sm text-muted-foreground p-3 border rounded-lg bg-primary/5">
                        <Check className="inline-block mr-1 h-4 w-4 text-green-500" />
                        {t("arena.youHaveJoined")}
                      </div>
                    )}
                  </div>
                )
              })()}

              {isOrganizer && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("arena.searchRegisteredPlayers")}
                    </label>
                    <UserSearchAutocomplete onSelectUser={onSelectUser} />
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">{t("arena.orAddGuest")}</span>
                    </div>
                  </div>

                  <Button
                    onClick={onAddGuestPlayer}
                    variant="outline"
                    className="w-full h-8 text-sm bg-transparent"
                  >
                    {t("arena.addGuestPlayer")}
                  </Button>
                </>
              )}

              {!currentUserId && (
                <div className="space-y-3">
                  <Button onClick={onAddGuestPlayer} variant="outline" className="w-full bg-transparent">
                    <UserPlus className="mr-2 h-4 w-4" />
                    {t("arena.joinAsGuest")}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    <Link href="/auth/login" className="text-primary hover:underline">
                      {t("home.loginButton")}
                    </Link>{" "}
                    or{" "}
                    <Link href="/auth/signup" className="text-primary hover:underline">
                      {t("home.signUp")}
                    </Link>{" "}
                    {t("arena.loginOrRegisterToTrack")}
                  </p>
                </div>
              )}
            </div>
          )}

          <PlayersList
            players={players}
            onRemovePlayer={onRemovePlayer}
            onTogglePause={onTogglePause}
            onMarkPresent={onMarkPresent}
            markingPresentPlayerId={markingPresentPlayerId}
            onRenamePlayer={onRenamePlayer}
            renamingPlayerId={renamingPlayerId}
            status={status}
            isOrganizer={isOrganizer}
            currentUserId={currentUserId}
          />
        </CardContent>
      </Card>
    </>
  )
}
