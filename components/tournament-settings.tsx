"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ChevronDown, X } from "lucide-react"
import { useState } from "react"
import { useI18n } from "@/components/i18n-provider"
import type { TournamentSettings } from "@/lib/types"
import {
  MIN_SWISS_ROUNDS,
  MAX_SWISS_ROUNDS,
  MIN_SWISS_PLAYERS,
  clampPlannedSwissRounds,
  maxSwissRoundsForPlayerCount,
} from "@/lib/pairing/swiss"

interface TournamentSettingsProps {
  settings: TournamentSettings
  onUpdateSettings: (settings: TournamentSettings) => void
  onClose: () => void
  showSimulator?: boolean
  onToggleSimulator?: (show: boolean) => void
  isOrganizer?: boolean
  /** When true, render only the settings card (no fullscreen backdrop). Parent must provide overlay and layout. */
  embedded?: boolean
  /** Active (non-left) player count — used to cap Swiss rounds at players − 1. */
  playerCount?: number
}

export function TournamentSettingsPanel({
  settings,
  onUpdateSettings,
  onClose,
  showSimulator = false,
  onToggleSimulator,
  isOrganizer = true,
  embedded = false,
  playerCount,
}: TournamentSettingsProps) {
  const { t } = useI18n()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const showSwissOption = true
  const swissRoundsMax =
    playerCount != null && playerCount >= MIN_SWISS_PLAYERS
      ? maxSwissRoundsForPlayerCount(playerCount)
      : MAX_SWISS_ROUNDS
  const updateSetting = <K extends keyof TournamentSettings>(key: K, value: TournamentSettings[K]) => {
    onUpdateSettings({ ...settings, [key]: value })
  }

  const card = (
    <Card className="w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 h-8 w-8"
            onClick={onClose}
            aria-label={t("settings.closeAriaLabel")}
          >
            <X className="h-4 w-4" />
          </Button>
          <CardTitle>{t("settings.title")}</CardTitle>
          <CardDescription>
            {isOrganizer ? t("settings.descriptionOrganizer") : t("settings.descriptionViewer")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <fieldset disabled={!isOrganizer} className={!isOrganizer ? "opacity-60" : ""}>
            {/* Scoring Settings */}
            <div className="space-y-3">
              <h3 className="text-base font-semibold">{t("settings.scoringSection")}</h3>

              {settings.pairingAlgorithm === "swiss" ? (
                <>
                  <p className="text-xs text-muted-foreground">{t("settings.swissScoringHelp")}</p>
                  <div className="grid grid-cols-3 gap-3 max-w-sm">
                    <div className="space-y-1.5">
                      <Label htmlFor="swissWinPoints" className="text-xs">
                        {t("settings.winLabel")}
                      </Label>
                      <Input
                        id="swissWinPoints"
                        type="number"
                        step="0.5"
                        value={settings.swissWinPoints ?? 1}
                        onChange={(e) => updateSetting("swissWinPoints", Number(e.target.value))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="swissDrawPoints" className="text-xs">
                        {t("settings.drawLabel")}
                      </Label>
                      <Input
                        id="swissDrawPoints"
                        type="number"
                        step="0.5"
                        value={settings.swissDrawPoints ?? 0.5}
                        onChange={(e) => updateSetting("swissDrawPoints", Number(e.target.value))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="swissLossPoints" className="text-xs">
                        {t("settings.lossLabel")}
                      </Label>
                      <Input
                        id="swissLossPoints"
                        type="number"
                        step="0.5"
                        value={settings.swissLossPoints ?? 0}
                        onChange={(e) => updateSetting("swissLossPoints", Number(e.target.value))}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{t("settings.streakNotUsedSwiss")}</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">{t("settings.arenaScoringHelp")}</p>
                  <div className="grid grid-cols-3 gap-3 max-w-sm">
                    <div className="space-y-1.5">
                      <Label htmlFor="winPoints" className="text-xs">
                        {t("settings.winLabel")}
                      </Label>
                      <Input
                        id="winPoints"
                        type="number"
                        value={settings.winPoints}
                        onChange={(e) => updateSetting("winPoints", Number(e.target.value))}
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="drawPoints" className="text-xs">
                        {t("settings.drawLabel")}
                      </Label>
                      <Input
                        id="drawPoints"
                        type="number"
                        value={settings.drawPoints}
                        onChange={(e) => updateSetting("drawPoints", Number(e.target.value))}
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="lossPoints" className="text-xs">
                        {t("settings.lossLabel")}
                      </Label>
                      <Input
                        id="lossPoints"
                        type="number"
                        value={settings.lossPoints}
                        onChange={(e) => updateSetting("lossPoints", Number(e.target.value))}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div className="space-y-0.5">
                      <Label htmlFor="streakEnabled" className="text-sm">
                        {t("settings.streakEnabledLabel")}
                      </Label>
                      <p className="text-xs text-muted-foreground">{t("settings.streakEnabledHelp")}</p>
                    </div>
                    <Switch
                      id="streakEnabled"
                      checked={settings.streakEnabled}
                      onCheckedChange={(checked) => updateSetting("streakEnabled", checked)}
                    />
                  </div>

                  {settings.streakEnabled && (
                    <div className="space-y-1.5 max-w-[140px]">
                      <Label htmlFor="streakMultiplier" className="text-sm">
                        {t("settings.multiplierLabel")}
                      </Label>
                      <Input
                        id="streakMultiplier"
                        type="number"
                        min="1"
                        step="0.5"
                        value={settings.streakMultiplier}
                        onChange={(e) => updateSetting("streakMultiplier", Number(e.target.value))}
                        className="h-8 text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("settings.multiplierPreview", {
                          win: settings.winPoints * settings.streakMultiplier,
                          draw: settings.drawPoints * settings.streakMultiplier,
                        })}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Player Management */}
            <div className="space-y-3">
              <h3 className="text-base font-semibold">{t("settings.playerManagementSection")}</h3>

              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label htmlFor="allowSelfPause" className="text-sm">
                    {t("settings.allowSelfPauseLabel")}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t("settings.allowSelfPauseHelp")}</p>
                </div>
                <Switch
                  id="allowSelfPause"
                  checked={settings.allowSelfPause}
                  onCheckedChange={(checked) => updateSetting("allowSelfPause", checked)}
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label htmlFor="allowLateJoin" className="text-sm">
                    {t("settings.allowLateJoinLabel")}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t("settings.allowLateJoinHelp")}</p>
                </div>
                <Switch
                  id="allowLateJoin"
                  checked={settings.allowLateJoin}
                  onCheckedChange={(checked) => updateSetting("allowLateJoin", checked)}
                />
              </div>
            </div>

            {/* Pairing Rules */}
            <div className="space-y-3">
              <h3 className="text-base font-semibold">{t("settings.pairingRulesSection")}</h3>

              <div className="space-y-1.5 max-w-xs">
                <Label htmlFor="pairingAlgorithm" className="text-sm">
                  {t("settings.pairingAlgorithmLabel")}
                </Label>
                <Select
                  value={settings.pairingAlgorithm || "all-vs-all"}
                  onValueChange={(v) => {
                    if (v === "swiss") {
                      onUpdateSettings({
                        ...settings,
                        pairingAlgorithm: "swiss",
                        plannedSwissRounds:
                          typeof settings.plannedSwissRounds === "number" &&
                          settings.plannedSwissRounds >= MIN_SWISS_ROUNDS
                            ? clampPlannedSwissRounds(settings.plannedSwissRounds, playerCount)
                            : 5,
                        swissLastCompletedRound: settings.swissLastCompletedRound ?? 0,
                        swissLastRoundColorRelax: settings.swissLastRoundColorRelax ?? false,
                        swissWinPoints: settings.swissWinPoints ?? 1,
                        swissDrawPoints: settings.swissDrawPoints ?? 0.5,
                        swissLossPoints: settings.swissLossPoints ?? 0,
                      })
                    } else {
                      onUpdateSettings({ ...settings, pairingAlgorithm: v })
                    }
                  }}
                >
                  <SelectTrigger id="pairingAlgorithm" className="h-8 text-sm w-full max-w-[280px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-vs-all">{t("settings.pairingAlgoAllVsAll")}</SelectItem>
                    <SelectItem value="balanced-strength">{t("settings.pairingAlgoArena")}</SelectItem>
                    {showSwissOption && (
                      <SelectItem value="swiss">
                        {t("settings.pairingAlgoSwiss")}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {settings.pairingAlgorithm === "balanced-strength"
                    ? t("settings.pairingAlgoHelpArena")
                    : settings.pairingAlgorithm === "swiss"
                      ? t("settings.pairingAlgoHelpSwiss")
                      : t("settings.pairingAlgoHelpAllVsAll")}
                </p>
              </div>

              <div className="space-y-1.5 max-w-[140px]">
                <Label htmlFor="settingsTableSlots" className="text-sm">
                  {t("settings.tableSlotsLabel")}
                </Label>
                <Input
                  id="settingsTableSlots"
                  type="number"
                  min={0}
                  value={settings.tableCount}
                  onChange={(e) => updateSetting("tableCount", Math.max(0, Number(e.target.value) || 0))}
                  className="h-8 text-sm"
                />
                <p className="text-xs text-muted-foreground">{t("settings.tableSlotsHelp")}</p>
              </div>

              {settings.pairingAlgorithm === "swiss" && (
                <div className="space-y-3 rounded-md border p-3 bg-muted/30">
                  <p className="text-sm font-medium">{t("settings.swissOptionsTitle")}</p>
                  <div className="space-y-1.5 max-w-[140px]">
                    <Label htmlFor="plannedSwissRounds" className="text-sm">
                      {t("settings.plannedSwissRoundsLabel")}
                    </Label>
                    <Input
                      id="plannedSwissRounds"
                      type="number"
                      min={MIN_SWISS_ROUNDS}
                      max={swissRoundsMax}
                      value={clampPlannedSwissRounds(settings.plannedSwissRounds ?? 5, playerCount)}
                      onChange={(e) =>
                        updateSetting(
                          "plannedSwissRounds",
                          clampPlannedSwissRounds(Number.parseInt(e.target.value, 10) || MIN_SWISS_ROUNDS, playerCount),
                        )
                      }
                      className="h-8 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      {playerCount != null && playerCount >= MIN_SWISS_PLAYERS
                        ? t("settings.plannedSwissRoundsHelpWithPlayers", {
                            min: MIN_SWISS_ROUNDS,
                            max: swissRoundsMax,
                            players: playerCount,
                          })
                        : t("settings.plannedSwissRoundsHelp", {
                            min: MIN_SWISS_ROUNDS,
                            max: MAX_SWISS_ROUNDS,
                            minPlayers: MIN_SWISS_PLAYERS,
                          })}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.swissCompletedRoundsHint", {
                      n: settings.swissLastCompletedRound ?? 0,
                    })}
                  </p>
                  <div className="flex items-center justify-between py-1 gap-2">
                    <div className="space-y-0.5">
                      <Label htmlFor="swissLastRoundColorRelax" className="text-sm">
                        {t("settings.swissLastRoundColorRelaxLabel")}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t("settings.swissLastRoundColorRelaxHelp")}
                      </p>
                    </div>
                    <Switch
                      id="swissLastRoundColorRelax"
                      checked={settings.swissLastRoundColorRelax ?? false}
                      onCheckedChange={(checked) => updateSetting("swissLastRoundColorRelax", checked)}
                    />
                  </div>
                </div>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-between px-2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowAdvanced((v) => !v)}
                aria-expanded={showAdvanced}
              >
                <span className="text-sm font-medium">{t("settings.advancedToggle")}</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                />
              </Button>

              {showAdvanced && (
                <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
                  <div className="space-y-1.5 max-w-[140px]">
                    <Label htmlFor="minGamesBeforePause" className="text-sm">
                      {t("settings.minGamesBeforePauseLabel")}
                    </Label>
                    <Input
                      id="minGamesBeforePause"
                      type="number"
                      min="0"
                      value={settings.minGamesBeforePause}
                      onChange={(e) => updateSetting("minGamesBeforePause", Number(e.target.value))}
                      className="h-8 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5 max-w-[140px]">
                    <Label htmlFor="avoidRecentRematches" className="text-sm">
                      {t("settings.avoidRecentRematchesLabel")}
                    </Label>
                    <Input
                      id="avoidRecentRematches"
                      type="number"
                      min="0"
                      value={settings.avoidRecentRematches}
                      onChange={(e) => updateSetting("avoidRecentRematches", Number(e.target.value))}
                      className="h-8 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">{t("settings.avoidRecentRematchesHelp")}</p>
                  </div>

                  {settings.pairingAlgorithm === "all-vs-all" && (
                    <div className="flex items-center justify-between py-2">
                      <div className="space-y-0.5">
                        <Label htmlFor="allowRematchToReduceWait" className="text-sm">
                          {t("settings.allowRematchToReduceWaitLabel")}
                        </Label>
                        <p className="text-xs text-muted-foreground">{t("settings.allowRematchToReduceWaitHelp")}</p>
                      </div>
                      <Switch
                        id="allowRematchToReduceWait"
                        checked={settings.allowRematchToReduceWait ?? false}
                        onCheckedChange={(checked) => updateSetting("allowRematchToReduceWait", checked)}
                      />
                    </div>
                  )}

                  <div className="space-y-1.5 max-w-xs">
                    <Label htmlFor="colorBalancePriority" className="text-sm">
                      {t("settings.colorBalanceLabel")}
                    </Label>
                    <Select
                      value={settings.colorBalancePriority}
                      onValueChange={(v) =>
                        updateSetting("colorBalancePriority", v as TournamentSettings["colorBalancePriority"])
                      }
                    >
                      <SelectTrigger id="colorBalancePriority" className="h-8 text-sm w-full max-w-[220px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">{t("settings.colorBalanceHigh")}</SelectItem>
                        <SelectItem value="medium">{t("settings.colorBalanceMedium")}</SelectItem>
                        <SelectItem value="low">{t("settings.colorBalanceLow")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{t("settings.colorBalanceHelp")}</p>
                  </div>

                  <div className="space-y-1.5 max-w-xs">
                    <Label htmlFor="scoreMatchingStrictness" className="text-sm">
                      {t("settings.scoreMatchingLabel")}
                    </Label>
                    <Select
                      value={settings.scoreMatchingStrictness}
                      onValueChange={(v) =>
                        updateSetting("scoreMatchingStrictness", v as TournamentSettings["scoreMatchingStrictness"])
                      }
                    >
                      <SelectTrigger id="scoreMatchingStrictness" className="h-8 text-sm w-full max-w-[220px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="loose">{t("settings.scoreMatchingLoose")}</SelectItem>
                        <SelectItem value="normal">{t("settings.scoreMatchingNormal")}</SelectItem>
                        <SelectItem value="strict">{t("settings.scoreMatchingStrict")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{t("settings.scoreMatchingHelp")}</p>
                  </div>

                  <div className="space-y-1.5 max-w-[260px]">
                    <Label htmlFor="t1CapPreset" className="text-sm">
                      {t("settings.t1CapPresetLabel")}
                    </Label>
                    <Select
                      value={settings.t1CapPreset ?? "balanced"}
                      onValueChange={(v) => updateSetting("t1CapPreset", v as TournamentSettings["t1CapPreset"])}
                    >
                      <SelectTrigger id="t1CapPreset" className="h-8 text-sm w-full max-w-[240px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fast">{t("settings.t1CapPresetFast")}</SelectItem>
                        <SelectItem value="balanced">{t("settings.t1CapPresetBalanced")}</SelectItem>
                        <SelectItem value="strict">{t("settings.t1CapPresetStrict")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{t("settings.t1CapPresetHelp")}</p>
                  </div>

                  {onToggleSimulator && (
                    <div className="flex items-center justify-between py-2">
                      <div className="space-y-0.5">
                        <Label htmlFor="showSimulator" className="text-sm">
                          {t("settings.showSimulatorLabel")}
                        </Label>
                        <p className="text-xs text-muted-foreground">{t("settings.showSimulatorHelp")}</p>
                      </div>
                      <Switch id="showSimulator" checked={showSimulator} onCheckedChange={onToggleSimulator} />
                    </div>
                  )}

                  <div className="flex items-center justify-between py-2">
                    <div className="space-y-0.5">
                      <Label htmlFor="autoEndAtCompletion" className="text-sm">
                        {t("settings.autoEndAtCompletionLabel")}
                      </Label>
                      <p className="text-xs text-muted-foreground">{t("settings.autoEndAtCompletionHelp")}</p>
                    </div>
                    <Switch
                      id="autoEndAtCompletion"
                      checked={settings.autoEndAtCompletion}
                      onCheckedChange={(checked) => updateSetting("autoEndAtCompletion", checked)}
                    />
                  </div>

                  {settings.autoEndAtCompletion && (
                    <div className="space-y-1.5 max-w-[140px]">
                      <Label htmlFor="completionThreshold" className="text-sm">
                        {t("settings.completionThresholdLabel")}
                      </Label>
                      <Input
                        id="completionThreshold"
                        type="number"
                        min="50"
                        max="100"
                        value={settings.completionThreshold}
                        onChange={(e) => updateSetting("completionThreshold", Number(e.target.value))}
                        className="h-8 text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("settings.completionThresholdHelp", { percent: settings.completionThreshold })}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </fieldset>

          <div className="flex gap-2 pt-2">
            <Button onClick={onClose} className="flex-1" size="sm" disabled={!isOrganizer}>
              {isOrganizer ? t("settings.saveAndClose") : t("settings.close")}
            </Button>
            {isOrganizer && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm(t("settings.resetConfirm"))) {
                    onUpdateSettings({
                      winPoints: 2,
                      drawPoints: 1,
                      lossPoints: 0,
                      swissWinPoints: 1,
                      swissDrawPoints: 0.5,
                      swissLossPoints: 0,
                      streakEnabled: true,
                      streakMultiplier: 2,
                      allowSelfPause: true,
                      allowLateJoin: true,
                      minGamesBeforePause: 0,
                      avoidRecentRematches: 3,
                      colorBalancePriority: "high",
                      scoreMatchingStrictness: "normal",
                      t1CapPreset: "balanced",
                      tableCount: settings.tableCount,
                      autoEndAtCompletion: false,
                      completionThreshold: 95,
                      pairingAlgorithm: settings.pairingAlgorithm,
                      baseTimeMinutes: settings.baseTimeMinutes,
                      incrementSeconds: settings.incrementSeconds,
                      allowRematchToReduceWait: false,
                      plannedSwissRounds: settings.plannedSwissRounds ?? 5,
                      swissLastCompletedRound: settings.swissLastCompletedRound ?? 0,
                      swissLastRoundColorRelax: settings.swissLastRoundColorRelax ?? false,
                    })
                    onClose()
                  }
                }}
              >
                {t("settings.reset")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
  )

  if (embedded) {
    return card
  }

  return (
    <div
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {card}
    </div>
  )
}
