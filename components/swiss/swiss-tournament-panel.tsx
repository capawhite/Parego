"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useI18n } from "@/components/i18n-provider"
import { createClient } from "@/lib/supabase/client"
import {
  loadPlayers,
  loadMatches,
  savePlayers,
  saveMatches,
  saveTournament,
  formatSupabaseError,
} from "@/lib/database/tournament-db"
import { fetchTournamentById, joinTournamentAction } from "@/app/actions/join-tournament"
import { parseTournamentSettings } from "@/lib/tournament-settings"
import {
  effectiveTableCountFromDb,
  effectiveTableSlotsForPairing,
} from "@/lib/tournament/effective-table-count"
import {
  applyPairingByeToPlayers,
  createSwissPairingsForRound,
  getSwissPairingBlockReason,
  isPairingByeMatch,
  maybeAdvanceSwissLastCompletedRound,
  mergeMatchesForSwiss,
  nextSwissRoundToPair,
} from "@/lib/pairing/fide-swiss"
import { isPlayerAvailableForPairing } from "@/lib/pairing/player-eligibility"
import { calculatePointsFromSettings } from "@/lib/points"
import { PAIRING_BYE_PLAYER_ID, type Match, type Player, type TournamentSettings } from "@/lib/types"
import { mergeMatchesForSave } from "@/lib/tournament/merge-matches"
import { toast } from "sonner"
import { startTournament } from "@/app/actions/start-tournament"
import { markPresentOverride } from "@/app/actions/check-in"
import { generateGuestUsername } from "@/lib/guest-names"
import { generateQRCode } from "@/lib/qr-utils"
import Image from "next/image"
import { Loader2, ArrowLeft, Settings, Copy, Check, UserPlus, Trash2, MapPin, QrCode } from "lucide-react"
import { TournamentSettingsPanel } from "@/components/tournament-settings"

const DEBUG = process.env.NODE_ENV === "development"

function applyPlayResultToPlayers(
  match: Match,
  winnerId: string | undefined,
  isDraw: boolean,
  players: Player[],
  settings: TournamentSettings,
): Player[] {
  return players.map((player) => {
    if (player.id !== match.player1.id && player.id !== match.player2.id) return player
    const isPlayer1 = player.id === match.player1.id
    const isWinner = winnerId === player.id
    const opponent = isPlayer1 ? match.player2 : match.player1
    const swiss = settings.pairingAlgorithm === "fide-swiss"
    let newStreak = player.streak
    if (swiss) newStreak = 0
    else if (isDraw) newStreak = 0
    else if (isWinner) newStreak = player.streak + 1
    else newStreak = 0
    const points = calculatePointsFromSettings(isWinner, isDraw, player.streak, settings)
    const gameResult: "W" | "D" | "L" = isDraw ? "D" : isWinner ? "W" : "L"
    const pieceColor: "white" | "black" = isPlayer1 ? "white" : "black"
    return {
      ...player,
      score: player.score + points,
      gamesPlayed: player.gamesPlayed + 1,
      streak: newStreak,
      opponentIds: [...player.opponentIds, opponent.id],
      gameResults: [...player.gameResults, gameResult],
      pieceColors: [...player.pieceColors, pieceColor],
      pointsEarned: [...(player.pointsEarned || []), points],
      tableNumbers: [...(player.tableNumbers || []), match.tableNumber || 0],
    }
  })
}

export function SwissTournamentPanel({ tournamentId }: { tournamentId: string }) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [status, setStatus] = useState<"setup" | "active" | "completed">("setup")
  const [players, setPlayers] = useState<Player[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [settings, setSettings] = useState<TournamentSettings>(parseTournamentSettings({}))
  const [organizerId, setOrganizerId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [tablesCount, setTablesCount] = useState(0)
  const [hasVenue, setHasVenue] = useState(false)
  const [pairBusy, setPairBusy] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [guestNameInput, setGuestNameInput] = useState("")
  const [addingPlayer, setAddingPlayer] = useState(false)
  const [markingPresentPlayerId, setMarkingPresentPlayerId] = useState<string | null>(null)
  const [joinUrlFull, setJoinUrlFull] = useState("")
  const [joinCopied, setJoinCopied] = useState(false)
  const [tableSlotsDraft, setTableSlotsDraft] = useState("1")
  const suppressUntil = useRef(0)
  const settingsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isOrganizer = currentUserId != null && organizerId === currentUserId

  const flushSettingsToDb = useCallback(
    async (next: TournamentSettings) => {
      const trow = await fetchTournamentById(tournamentId)
      if (!trow) return
      const tablesSave = Math.max(trow.tables_count ?? 0, next.tableCount ?? 0)
      await saveTournament(
        tournamentId,
        trow.name,
        trow.status,
        tablesSave,
        next,
        trow.city,
        trow.country,
        trow.organizer_id,
        trow.latitude,
        trow.longitude,
        trow.visibility ?? "public",
        trow.start_time,
      )
      setTablesCount(
        effectiveTableCountFromDb({
          tables_count: tablesSave,
          settings: next,
          status: trow.status,
        }),
      )
    },
    [tournamentId],
  )

  const handleUpdateSettings = useCallback(
    (next: TournamentSettings) => {
      setSettings(next)
      if (!isOrganizer) return
      if (settingsSaveTimer.current) clearTimeout(settingsSaveTimer.current)
      settingsSaveTimer.current = setTimeout(() => {
        flushSettingsToDb(next).catch((e) => {
          console.error(e)
          toast.error(formatSupabaseError(e))
        })
      }, 800)
    },
    [isOrganizer, flushSettingsToDb],
  )

  const persistTableSlots = useCallback(
    async (raw: number) => {
      const n = Math.min(99, Math.max(1, Math.floor(raw) || 1))
      if (settingsSaveTimer.current) {
        clearTimeout(settingsSaveTimer.current)
        settingsSaveTimer.current = null
      }
      const trow = await fetchTournamentById(tournamentId)
      if (!trow) return
      const nextSettings = { ...parseTournamentSettings(trow), tableCount: n }
      const tablesSave = Math.max(trow.tables_count ?? 0, n)
      try {
        suppressUntil.current = Date.now() + 800
        await saveTournament(
          tournamentId,
          trow.name,
          trow.status,
          tablesSave,
          nextSettings,
          trow.city,
          trow.country,
          trow.organizer_id,
          trow.latitude,
          trow.longitude,
          trow.visibility ?? "public",
          trow.start_time,
        )
        setSettings(nextSettings)
        setTablesCount(
          effectiveTableCountFromDb({
            tables_count: tablesSave,
            settings: nextSettings,
            status: trow.status,
          }),
        )
      } catch (e) {
        toast.error(formatSupabaseError(e))
      }
    },
    [tournamentId],
  )

  const refresh = useCallback(async () => {
    const trow = await fetchTournamentById(tournamentId)
    if (!trow) return
    setName(trow.name)
    setStatus(trow.status)
    setOrganizerId(trow.organizer_id ?? null)
    setTablesCount(effectiveTableCountFromDb(trow))
    setHasVenue(trow.latitude != null && trow.longitude != null)
    const s = parseTournamentSettings(trow)
    const pl = await loadPlayers(tournamentId)
    const mt = await loadMatches(tournamentId)
    const merged = mergeMatchesForSwiss(
      mt.filter((m) => !m.result?.completed),
      mt.filter((m) => m.result?.completed),
    )
    const advanced = maybeAdvanceSwissLastCompletedRound(s, merged)
    setSettings(advanced)
    setPlayers(pl)
    setMatches(mt)
    if (advanced.swissLastCompletedRound !== s.swissLastCompletedRound) {
      await saveTournament(
        tournamentId,
        trow.name,
        trow.status,
        trow.tables_count,
        advanced,
        trow.city,
        trow.country,
        trow.organizer_id,
        trow.latitude,
        trow.longitude,
        trow.visibility ?? "public",
        trow.start_time,
      ).catch((e) => console.error(e))
    }
  }, [tournamentId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!cancelled) setCurrentUserId(user?.id ?? null)
        await refresh()
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refresh])

  useEffect(() => {
    const supabase = createClient()
    const topic = "swiss:" + tournamentId
    const ch = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: "tournament_id=eq." + tournamentId },
        () => {
          if (Date.now() < suppressUntil.current) return
          refresh()
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: "tournament_id=eq." + tournamentId },
        () => {
          if (Date.now() < suppressUntil.current) return
          refresh()
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournaments", filter: "id=eq." + tournamentId },
        () => {
          if (Date.now() < suppressUntil.current) return
          refresh()
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [tournamentId, refresh])

  useEffect(() => {
    return () => {
      if (settingsSaveTimer.current) clearTimeout(settingsSaveTimer.current)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    setJoinUrlFull(`${window.location.origin}/join/${tournamentId}`)
  }, [tournamentId])

  useEffect(() => {
    setTableSlotsDraft(String(Math.max(1, settings.tableCount || 1)))
  }, [settings.tableCount])

  const activeIncomplete = useMemo(
    () => matches.filter((m) => !m.result?.completed && !isPairingByeMatch(m)),
    [matches],
  )

  const blockReason = useMemo(() => {
    const tableSlots = effectiveTableSlotsForPairing(tablesCount, settings)
    return getSwissPairingBlockReason({
      settings,
      players,
      hasVenue,
      tableSlots,
      allMatches: matches,
    })
  }, [settings, players, hasVenue, tablesCount, matches])

  const nextRound = useMemo(() => nextSwissRoundToPair(settings, matches), [settings, matches])

  const handleStart = async () => {
    const res = await startTournament(tournamentId)
    if (!res.success) {
      toast.error(res.error || "Start failed")
      return
    }
    toast.success(t("swiss.started"))
    await refresh()
  }

  const handlePairRound = async () => {
    if (!isOrganizer || nextRound == null) return
    setPairBusy(true)
    try {
      const tableSlots = effectiveTableSlotsForPairing(tablesCount, settings)
      const activePairing = matches.filter((m) => !m.result?.completed && !isPairingByeMatch(m))
      const eligible = players.filter((p) => isPlayerAvailableForPairing(p, activePairing, hasVenue))
      const historical = matches.filter((m) => m.result?.completed || isPairingByeMatch(m))
      const newMatches = createSwissPairingsForRound(eligible, historical, settings, tableSlots)
      if (newMatches.length === 0) {
        toast.error(t("swiss.pairingFailed"))
        return
      }
      let nextPlayers = [...players]
      const byeMatches = newMatches.filter(isPairingByeMatch)
      for (const bm of byeMatches) {
        nextPlayers = applyPairingByeToPlayers(bm, nextPlayers, settings)
      }
      suppressUntil.current = Date.now() + 2000
      await savePlayers(tournamentId, nextPlayers, settings)
      await saveMatches(tournamentId, mergeMatchesForSave(matches, newMatches))
      toast.success(t("swiss.pairedRound", { round: nextRound }))
      await refresh()
    } catch (e) {
      console.error(e)
      toast.error(formatSupabaseError(e))
    } finally {
      setPairBusy(false)
    }
  }

  const handleTdResult = async (match: Match, winnerId: string | undefined, isDraw: boolean) => {
    if (!isOrganizer) return
    try {
      const updated: Match = {
        ...match,
        endTime: Date.now(),
        result: { winnerId, isDraw, completed: true, completedAt: Date.now() },
      }
      const nextPlayers = applyPlayResultToPlayers(match, winnerId, isDraw, players, settings)
      const nextMatches = matches.map((m) => (m.id === match.id ? updated : m))
      const merged = mergeMatchesForSwiss(
        nextMatches.filter((m) => !m.result?.completed),
        nextMatches.filter((m) => m.result?.completed),
      )
      const advanced = maybeAdvanceSwissLastCompletedRound(settings, merged)
      suppressUntil.current = Date.now() + 2000
      await savePlayers(tournamentId, nextPlayers, advanced)
      await saveMatches(tournamentId, nextMatches)
      const trow = await fetchTournamentById(tournamentId)
      if (trow) {
        await saveTournament(
          tournamentId,
          trow.name,
          trow.status,
          trow.tables_count,
          advanced,
          trow.city,
          trow.country,
          trow.organizer_id,
          trow.latitude,
          trow.longitude,
          trow.visibility ?? "public",
          trow.start_time,
        )
      }
      toast.success(t("swiss.resultSaved"))
      await refresh()
    } catch (e) {
      console.error(e)
      toast.error(formatSupabaseError(e))
    }
  }

  const insertSwissPlayer = useCallback(
    async (playerName: string, opts: { isGuest: boolean; userId?: string | null }) => {
      const trimmed = playerName.trim()
      if (!trimmed) return
      const activeList = players.filter((p) => !p.hasLeft)
      const dup = activeList.some((p) =>
        opts.userId ? p.userId === opts.userId : p.name.toLowerCase() === trimmed.toLowerCase(),
      )
      if (dup) {
        toast.error(t("arena.alertPlayerAlreadyInTournament"))
        return
      }
      if (status === "active" && !settings.allowLateJoin) {
        toast.error(t("arena.alertLateJoinsNotAllowed"))
        return
      }
      if (status === "active") {
        const n = activeList.length + 1
        const maxSim = Math.floor(n / 2)
        const cap = effectiveTableSlotsForPairing(tablesCount, settings)
        if (maxSim > cap) {
          toast.error(t("arena.alertCannotAddPlayerTables", { max: maxSim, tables: cap }))
          return
        }
      }
      const id = `p-${Date.now()}`
      setAddingPlayer(true)
      try {
        const joinResult = await joinTournamentAction({
          tournamentId,
          name: trimmed,
          userId: opts.userId ?? null,
          isGuest: opts.isGuest,
          asOrganizer: isOrganizer,
          playerId: id,
        })
        if (!joinResult.success) {
          if (joinResult.errorCode === "ALREADY_JOINED") {
            toast.error(t("arena.toastAlreadyJoinedFromDevice"))
            return
          }
          console.error(joinResult.error)
          toast.error(joinResult.error || t("arena.toastFailedToAddPlayer"))
          return
        }
        toast.success(t("swiss.playerAdded", { name: trimmed }))
        setGuestNameInput("")
        await refresh()
      } finally {
        setAddingPlayer(false)
      }
    },
    [players, status, settings, tablesCount, tournamentId, t, refresh, isOrganizer],
  )

  const handleAddRandomGuest = () => {
    const names = players.filter((p) => !p.hasLeft).map((p) => p.name)
    void insertSwissPlayer(generateGuestUsername(names), { isGuest: true })
  }

  const handleAddNamedGuest = () => {
    void insertSwissPlayer(guestNameInput, { isGuest: true })
  }

  const handleCopyJoinLink = async () => {
    const text = joinUrlFull || `/join/${tournamentId}`
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      }
      setJoinCopied(true)
      toast.success(t("swiss.joinLinkCopied"))
      window.setTimeout(() => setJoinCopied(false), 2000)
    } catch {
      toast.error(t("common.errorGeneric"))
    }
  }

  const handleRemovePlayerSetup = async (playerId: string) => {
    if (!isOrganizer || status !== "setup") return
    try {
      const supabase = createClient()
      const { error } = await supabase.from("players").delete().eq("id", playerId).eq("tournament_id", tournamentId)
      if (error) throw error
      toast.success(t("swiss.playerRemoved"))
      await refresh()
    } catch (e) {
      toast.error(formatSupabaseError(e))
    }
  }

  const handleMarkPresentSwiss = async (playerId: string) => {
    if (!isOrganizer) return
    setMarkingPresentPlayerId(playerId)
    try {
      const res = await markPresentOverride(tournamentId, playerId)
      if (!res.ok) {
        toast.error(res.error ?? t("common.errorGeneric"))
        return
      }
      toast.success(t("arena.toastPlayerMarkedPresent"))
      await refresh()
    } finally {
      setMarkingPresentPlayerId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (settings.pairingAlgorithm !== "fide-swiss") {
    return (
      <div className="p-6 text-center space-y-4">
        <p className="text-muted-foreground">{t("swiss.notSwissTournament")}</p>
        <Button asChild variant="outline">
          <Link href={"/tournament/" + tournamentId}>{t("swiss.openArena")}</Link>
        </Button>
      </div>
    )
  }

  const standings = [...players]
    .filter((p) => !p.hasLeft)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  const planned = settings.plannedSwissRounds ?? 1
  const lastDone = settings.swissLastCompletedRound ?? 0

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/" aria-label={t("common.back")}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold">{name}</h1>
          <p className="text-sm text-muted-foreground">{t("swiss.title")}</p>
        </div>
        {isOrganizer && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("tournamentHeader.settingsTooltip")}
            onClick={() => setShowSettings(true)}
          >
            <Settings className="h-5 w-5" />
          </Button>
        )}
      </div>

      {showSettings && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-background/80 backdrop-blur-sm"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8"
            onClick={(e) => e.stopPropagation()}
          >
            <TournamentSettingsPanel
              embedded
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onClose={() => setShowSettings(false)}
              isOrganizer={isOrganizer}
            />
          </div>
        </div>
      )}

      {isOrganizer && status !== "completed" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("swiss.playersSectionTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-2 max-w-xs">
              <Label htmlFor="swissTableSlots" className="text-sm">
                {t("settings.tableSlotsLabel")}
              </Label>
              <Input
                id="swissTableSlots"
                type="number"
                min={1}
                max={99}
                value={tableSlotsDraft}
                onChange={(e) => setTableSlotsDraft(e.target.value)}
                onBlur={() => {
                  const v = Math.min(99, Math.max(1, Number.parseInt(tableSlotsDraft, 10) || 1))
                  setTableSlotsDraft(String(v))
                  void persistTableSlots(v)
                }}
                className="h-9 w-24 text-sm"
              />
              <p className="text-xs text-muted-foreground">{t("settings.tableSlotsHelp")}</p>
            </div>

            {joinUrlFull ? (
              <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 rounded border border-primary/20 bg-white p-1 dark:bg-background">
                    <Image
                      src={generateQRCode(joinUrlFull)}
                      alt={t("arena.qrJoinCodeAlt")}
                      width={112}
                      height={112}
                      className="h-28 w-28"
                      unoptimized
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <QrCode className="h-4 w-4 shrink-0" aria-hidden />
                      <h3 className="text-sm font-semibold">{t("arena.playerJoinLink")}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">{t("swiss.qrJoinHelp")}</p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{t("swiss.joinLinkLabel")}</Label>
              <div className="flex flex-wrap gap-2 items-center">
                <code className="text-xs bg-muted px-2 py-1 rounded break-all flex-1 min-w-0">
                  {joinUrlFull || `/join/${tournamentId}`}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleCopyJoinLink()}
                  className="shrink-0"
                  aria-label={t("swiss.copyJoinLink")}
                >
                  {joinCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("swiss.joinLinkHelp")}</p>
            </div>

            {hasVenue && (
              <p className="text-xs text-muted-foreground flex items-start gap-2">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
                {t("swiss.venueCheckInHint")}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <Button type="button" variant="secondary" onClick={handleAddRandomGuest} disabled={addingPlayer}>
                {addingPlayer ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                {t("swiss.addGuestPlayer")}
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="swissGuestName">{t("swiss.namedGuestLabel")}</Label>
              <div className="flex flex-wrap gap-2 items-end">
                <Input
                  id="swissGuestName"
                  value={guestNameInput}
                  onChange={(e) => setGuestNameInput(e.target.value)}
                  placeholder={t("swiss.namedGuestPlaceholder")}
                  className="max-w-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddNamedGuest()
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={() => handleAddNamedGuest()}
                  disabled={addingPlayer || !guestNameInput.trim()}
                >
                  {t("swiss.addNamedGuestButton")}
                </Button>
              </div>
            </div>

            <ul className="space-y-2 border-t pt-3 list-none m-0 p-0">
              {standings.length === 0 ? (
                <li className="text-muted-foreground">{t("swiss.noPlayersYet")}</li>
              ) : (
                standings.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {p.name}
                      {p.isGuest ? (
                        <span className="text-muted-foreground text-xs ml-1">({t("swiss.guestBadge")})</span>
                      ) : null}
                    </span>
                    <span className="flex gap-2 shrink-0">
                      {hasVenue && p.checkedInAt == null ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void handleMarkPresentSwiss(p.id)}
                          disabled={markingPresentPlayerId === p.id}
                        >
                          {markingPresentPlayerId === p.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            t("swiss.markPresent")
                          )}
                        </Button>
                      ) : null}
                      {status === "setup" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleRemovePlayerSetup(p.id)}
                          aria-label={t("swiss.removePlayer")}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      ) : null}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("swiss.roundStatus")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{t("swiss.roundsProgress", { last: lastDone, planned })}</p>
          {nextRound != null && (
            <p className="text-muted-foreground">{t("swiss.nextToPair", { round: nextRound })}</p>
          )}
          {status === "setup" && isOrganizer && (
            <div className="space-y-2 mt-2">
              <Button onClick={handleStart} disabled={standings.length < 2}>
                {t("swiss.startTournament")}
              </Button>
              {standings.length < 2 ? (
                <p className="text-xs text-muted-foreground">{t("swiss.needTwoPlayersToStart")}</p>
              ) : null}
            </div>
          )}
          {status === "active" && isOrganizer && (
            <div className="flex flex-col gap-2 mt-2">
              {blockReason && (
                <Alert>
                  <AlertDescription>{t(blockReason)}</AlertDescription>
                </Alert>
              )}
              <Button disabled={pairBusy || nextRound == null || blockReason != null} onClick={handlePairRound}>
                {pairBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("swiss.pairNextRound")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {activeIncomplete.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("swiss.currentPairings")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeIncomplete.map((m) => (
              <div key={m.id} className="border rounded-lg p-3 space-y-2">
                <p className="font-medium">
                  {t("swiss.tableVs", {
                    table: String(m.tableNumber ?? "—"),
                    p1: m.player1.name,
                    p2: m.player2.name,
                  })}
                </p>
                {isOrganizer && status === "active" && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleTdResult(m, m.player1.id, false)}>
                      {m.player1.name} {t("swiss.wins")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleTdResult(m, undefined, true)}>
                      {t("currentRound.draw")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleTdResult(m, m.player2.id, false)}>
                      {m.player2.name} {t("swiss.wins")}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("swiss.standings")}</CardTitle>
        </CardHeader>
        <CardContent>
          {standings.length % 2 === 1 ? (
            <p className="text-xs text-muted-foreground mb-3">{t("swiss.standingsOddPlayersNote")}</p>
          ) : null}
          <ol className="list-decimal pl-5 space-y-1 text-sm">
            {standings.map((p) => {
              const byeCount = (p.opponentIds ?? []).filter((id) => id === PAIRING_BYE_PLAYER_ID).length
              return (
                <li key={p.id}>
                  {p.name} — {p.score} ({p.gamesPlayed} {t("swiss.games")})
                  {byeCount > 0 ? (
                    <span className="text-muted-foreground">
                      {" "}
                      (
                      {byeCount === 1
                        ? t("swiss.pairingByeOne")
                        : t("swiss.pairingByeMany", { count: byeCount })}
                      )
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ol>
        </CardContent>
      </Card>

      {DEBUG && (
        <p className="text-xs text-muted-foreground">
          organizer={String(isOrganizer)} nextRound={String(nextRound)} block={String(blockReason)}
        </p>
      )}
    </div>
  )
}
