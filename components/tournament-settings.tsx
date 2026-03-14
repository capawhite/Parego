"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { X } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import type { TournamentSettings } from "@/lib/types"

interface TournamentSettingsProps {
  settings: TournamentSettings
  onUpdateSettings: (settings: TournamentSettings) => void
  onClose: () => void
  showSimulator?: boolean
  onToggleSimulator?: (show: boolean) => void
  isOrganizer?: boolean
}

export function TournamentSettingsPanel({
  settings,
  onUpdateSettings,
  onClose,
  showSimulator = false,
  onToggleSimulator,
  isOrganizer = true,
}: TournamentSettingsProps) {
  const { t } = useI18n()
  const updateSetting = <K extends keyof TournamentSettings>(key: K, value: TournamentSettings[K]) => {
    onUpdateSettings({ ...settings, [key]: value })
  }

  return (
    <div
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
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
              <h3 className="text-base font-semibold">Scoring System</h3>

              <div className="grid grid-cols-3 gap-3 max-w-sm">
                <div className="space-y-1.5">
                  <Label htmlFor="winPoints" className="text-xs">
                    Win
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
                    Loss
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
                    Multiplier
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
                    Win: {settings.winPoints * settings.streakMultiplier}, Draw:{" "}
                    {settings.drawPoints * settings.streakMultiplier}
                  </p>
                </div>
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
            </div>

            {/* Pairing Rules */}
            <div className="space-y-3">
              <h3 className="text-base font-semibold">Pairing Rules</h3>

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

              <div className="space-y-1 max-w-xs">
                <p className="text-sm font-medium">{t("settings.colorBalanceLabel")}</p>
                <p className="text-xs text-muted-foreground">{t("settings.colorBalanceHelp")}</p>
              </div>

              <div className="space-y-1 max-w-xs">
                <p className="text-sm font-medium">{t("settings.scoreMatchingLabel")}</p>
                <p className="text-xs text-muted-foreground">{t("settings.scoreMatchingComingSoon")}</p>
              </div>
            </div>

            {/* Tournament Settings */}
            <div className="space-y-3">
              <h3 className="text-base font-semibold">{t("settings.tournamentSection")}</h3>

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
                      streakEnabled: true,
                      streakMultiplier: 2,
                      allowSelfPause: true,
                      allowLateJoin: true,
                      minGamesBeforePause: 0,
                      avoidRecentRematches: 3,
                      colorBalancePriority: "high",
                      scoreMatchingStrictness: "normal",
                      tableCount: settings.tableCount,
                      autoEndAtCompletion: false,
                      completionThreshold: 95,
                      pairingAlgorithm: settings.pairingAlgorithm,
                      baseTimeMinutes: settings.baseTimeMinutes,
                      incrementSeconds: settings.incrementSeconds,
                      allowRematchToReduceWait: false,
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
    </div>
  )
}
