"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useI18n } from "@/components/i18n-provider"
import type { ArenaState } from "@/lib/types"
import {
  computeArenaPairingInsights,
  type PairingInsightPlayer,
  type PairingInsightPlayerStatus,
} from "@/lib/pairing/arena-pairing-insights"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ArenaPairingStatusPanelProps {
  arenaState: ArenaState
  tournamentMetadata: { latitude?: number | null; longitude?: number | null } | null
  isActive: boolean
  waitingForFinalResults: boolean
  onForcePairing?: () => void
}

function formatWaitLabel(ms: number | null, t: (key: string, params?: Record<string, string | number>) => string): string {
  if (ms == null) return t("arena.pairingStatusWaitReady")
  if (ms <= 0) return t("arena.pairingStatusWaitReady")
  const sec = Math.ceil(ms / 1000)
  if (sec < 60) return t("arena.pairingStatusWaitSeconds", { seconds: sec })
  const minutes = Math.floor(sec / 60)
  const seconds = sec % 60
  return t("arena.pairingStatusWaitMinutes", { minutes, seconds })
}

function tpMinutesRounded(tpMs: number): number {
  return Math.max(1, Math.round(tpMs / 60000))
}

function statusLabel(
  status: PairingInsightPlayerStatus,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  switch (status) {
    case "ready":
      return t("arena.pairingStatusReady")
    case "t1_wait":
      return t("arena.pairingStatusT1Wait")
    case "in_game":
      return t("arena.pairingStatusInGame")
    case "paused":
      return t("arena.pairingStatusPaused")
    case "marked":
      return t("arena.pairingStatusMarked")
    case "not_checked_in":
      return t("arena.pairingStatusNotCheckedIn")
    case "left":
      return t("arena.pairingStatusLeft")
    default:
      return status
  }
}

export function ArenaPairingStatusPanel({
  arenaState,
  tournamentMetadata,
  isActive,
  waitingForFinalResults,
  onForcePairing,
}: ArenaPairingStatusPanelProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(true)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const insights = useMemo(
    () =>
      computeArenaPairingInsights({
        state: arenaState,
        nowMs,
        tournamentMetadata,
        isActive,
        waitingForFinalResults,
      }),
    [arenaState, nowMs, tournamentMetadata, isActive, waitingForFinalResults],
  )

  const inGame = insights.players.filter((p) => p.status === "in_game").length
  const ready = insights.players.filter((p) => p.status === "ready").length
  const t1 = insights.players.filter((p) => p.status === "t1_wait").length

  const idleReadyCount = insights.players.filter((p) => p.status === "ready").length
  const summary = insights.usesT1
    ? t("arena.pairingStatusSummary", { inGame, ready, t1 })
    : t("arena.pairingStatusSummaryNoT1", { inGame, ready: idleReadyCount })

  const minIdleLabel = insights.usesT1
    ? t("arena.pairingStatusMinIdleLabelT1")
    : t("arena.pairingStatusMinIdleLabelIdle")
  const minIdleHave = insights.usesT1 ? insights.t1EligibleIdleCount : insights.idleForPairingCount
  const baseMinutes = arenaState.settings.baseTimeMinutes || 5
  const incrementSeconds = arenaState.settings.incrementSeconds || 0
  const algorithmName =
    insights.algorithmId === "all-vs-all"
      ? t("create.pairingAllVsAll")
      : insights.algorithmId === "balanced-strength"
        ? t("create.pairingArenaBalanced")
        : insights.algorithmId
  const algorithmDescription =
    insights.algorithmId === "all-vs-all"
      ? t("create.pairingAllVsAllDescription")
      : insights.algorithmId === "balanced-strength"
        ? t("create.pairingArenaBalancedDescription")
        : t("arena.pairingStatusAlgorithmFallbackDescription")
  const presetLabel =
    arenaState.settings.t1CapPreset === "fast"
      ? t("settings.t1CapPresetFast")
      : arenaState.settings.t1CapPreset === "strict"
        ? t("settings.t1CapPresetStrict")
        : t("settings.t1CapPresetBalanced")
  const cooldownBounds =
    arenaState.settings.t1CapPreset === "fast"
      ? { minSec: 60, maxSec: 120 }
      : arenaState.settings.t1CapPreset === "strict"
        ? { minSec: 120, maxSec: 300 }
        : { minSec: 90, maxSec: 180 }
  const canForcePairing =
    !!onForcePairing &&
    insights.algorithmId === "balanced-strength" &&
    insights.availableTables > 0 &&
    insights.idleForPairingCount >= 2 &&
    isActive &&
    !waitingForFinalResults

  const blockerMessages = insights.blockers.map((b) => {
    switch (b.id) {
      case "small_field":
        return t("arena.pairingStatusBlockerSmallField")
      case "min_idle":
        return t("arena.pairingStatusBlockerMinIdle", { need: b.need ?? 0, have: b.have ?? 0 })
      case "no_tables":
        return t("arena.pairingStatusBlockerNoTables")
      case "not_active":
        return t("arena.pairingStatusBlockerNotActive")
      case "waiting_final_results":
        return t("arena.pairingStatusBlockerWaitingFinal")
      default:
        return ""
    }
  })

  const showRows = (p: PairingInsightPlayer) =>
    p.status === "ready" || p.status === "t1_wait" || p.status === "in_game"

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2 space-y-0">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-base">{t("arena.pairingStatusTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">{summary}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 h-8 px-2"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={t("arena.pairingStatusCollapse")}
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="pt-0 space-y-3 text-sm">
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">{t("arena.pairingStatusAlgorithmLabel")}</p>
            <p className="font-medium">{algorithmName}</p>
            <p className="text-xs text-muted-foreground mt-1">{algorithmDescription}</p>
            {insights.algorithmId === "balanced-strength" ? (
              <p className="text-xs text-muted-foreground mt-1">{t("arena.pairingStatusPresetLabel", { preset: presetLabel })}</p>
            ) : null}
          </div>
          <p className="text-muted-foreground">
            {t("arena.pairingStatusMaxGameEstimate", {
              base: baseMinutes,
              increment: incrementSeconds,
              minutes: tpMinutesRounded(insights.tpMs),
            })}
          </p>
          <p className="text-muted-foreground">
            {t("arena.pairingStatusCooldownHelp", {
              minSeconds: cooldownBounds.minSec,
              maxSeconds: cooldownBounds.maxSec,
            })}
          </p>
          <p>{t("arena.pairingStatusTables", { free: insights.availableTables, total: insights.tableSlots })}</p>
          <p>
            {t("arena.pairingStatusMinIdle", {
              need: insights.effectiveMinIdle,
              label: minIdleLabel,
              have: minIdleHave,
            })}
          </p>
          {insights.usesT1 &&
          insights.activeMatchesCount > 0 &&
          insights.effectiveMinIdle < insights.baseMinIdle ? (
            <p className="text-muted-foreground">
              {t("arena.pairingStatusMinIdleRelaxed", {
                effective: insights.effectiveMinIdle,
                base: insights.baseMinIdle,
              })}
            </p>
          ) : null}
          {insights.algorithmId === "balanced-strength" ? (
            <div className="pt-1">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={!canForcePairing}>
                    {t("arena.forcePairingButton")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("arena.forcePairingConfirmTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>{t("arena.forcePairingConfirmDescription")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onForcePairing?.()}>{t("arena.forcePairingConfirmAction")}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              {!canForcePairing ? (
                <p className="text-xs text-muted-foreground mt-1">{t("arena.forcePairingDisabledHelp")}</p>
              ) : null}
            </div>
          ) : null}

          <ul className="list-disc pl-5 space-y-1">
            {insights.wouldPair ? (
              <li className="text-muted-foreground">{t("arena.pairingStatusCanPair")}</li>
            ) : (
              blockerMessages.filter(Boolean).map((msg, i) => <li key={i}>{msg}</li>)
            )}
          </ul>

          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left font-medium p-2">{t("arena.pairingStatusPlayerCol")}</th>
                  <th className="text-left font-medium p-2">{t("arena.pairingStatusStateCol")}</th>
                  <th className="text-left font-medium p-2 whitespace-nowrap">{t("arena.pairingStatusWaitCol")}</th>
                </tr>
              </thead>
              <tbody>
                {insights.players.filter(showRows).map((p) => (
                  <tr key={p.id} className="border-b border-border/60 last:border-0">
                    <td className="p-2 align-top">{p.name}</td>
                    <td className="p-2 align-top">{statusLabel(p.status, t)}</td>
                    <td className={cn("p-2 align-top whitespace-nowrap", p.status !== "t1_wait" && "text-muted-foreground")}>
                      {insights.usesT1 && p.status === "t1_wait"
                        ? formatWaitLabel(p.remainingMs, t)
                        : insights.usesT1 && p.status === "ready"
                          ? t("arena.pairingStatusWaitReady")
                          : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              {statusLabel("paused", t)}: {insights.players.filter((p) => p.status === "paused").length}
            </span>
            <span>
              {statusLabel("not_checked_in", t)}: {insights.players.filter((p) => p.status === "not_checked_in").length}
            </span>
            <span>
              {statusLabel("marked", t)}: {insights.players.filter((p) => p.status === "marked").length}
            </span>
            <span>
              {statusLabel("left", t)}: {insights.players.filter((p) => p.status === "left").length}
            </span>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
