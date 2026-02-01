"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X } from "lucide-react"
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
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </Button>
          <CardTitle>Tournament Settings</CardTitle>
          <CardDescription>
            {isOrganizer
              ? "Customize scoring, pairing rules, and player management"
              : "View tournament configuration (organizer only can edit)"}
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
                    Draw
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
                    Enable Streak Bonuses
                  </Label>
                  <p className="text-xs text-muted-foreground">After 2 consecutive wins, multiply all points</p>
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
              <h3 className="text-base font-semibold">Player Management</h3>

              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label htmlFor="allowSelfPause" className="text-sm">
                    Allow Player Self-Pause
                  </Label>
                  <p className="text-xs text-muted-foreground">Players can pause themselves during tournament</p>
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
                    Allow Late Joins
                  </Label>
                  <p className="text-xs text-muted-foreground">New players can join after tournament starts</p>
                </div>
                <Switch
                  id="allowLateJoin"
                  checked={settings.allowLateJoin}
                  onCheckedChange={(checked) => updateSetting("allowLateJoin", checked)}
                />
              </div>

              <div className="space-y-1.5 max-w-[140px]">
                <Label htmlFor="minGamesBeforePause" className="text-sm">
                  Min Games Before Pause
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
                  Avoid Recent Rematches
                </Label>
                <Input
                  id="avoidRecentRematches"
                  type="number"
                  min="0"
                  value={settings.avoidRecentRematches}
                  onChange={(e) => updateSetting("avoidRecentRematches", Number(e.target.value))}
                  className="h-8 text-sm"
                />
                <p className="text-xs text-muted-foreground">Games since last match (0 = allow immediate)</p>
              </div>

              <div className="space-y-1.5 max-w-xs">
                <Label htmlFor="colorBalancePriority" className="text-sm">
                  Color Balance
                </Label>
                <Select
                  value={settings.colorBalancePriority}
                  onValueChange={(value: any) => updateSetting("colorBalancePriority", value)}
                >
                  <SelectTrigger id="colorBalancePriority" className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 max-w-xs">
                <Label htmlFor="scoreMatchingStrictness" className="text-sm">
                  Score Matching
                </Label>
                <Select
                  value={settings.scoreMatchingStrictness}
                  onValueChange={(value: any) => updateSetting("scoreMatchingStrictness", value)}
                >
                  <SelectTrigger id="scoreMatchingStrictness" className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loose">Loose</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="strict">Strict</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tournament Settings */}
            <div className="space-y-3">
              <h3 className="text-base font-semibold">Tournament Settings</h3>

              {onToggleSimulator && (
                <div className="flex items-center justify-between py-2">
                  <div className="space-y-0.5">
                    <Label htmlFor="showSimulator" className="text-sm">
                      Enable Tournament Simulator
                    </Label>
                    <p className="text-xs text-muted-foreground">Show auto-simulator in Results tab for testing</p>
                  </div>
                  <Switch id="showSimulator" checked={showSimulator} onCheckedChange={onToggleSimulator} />
                </div>
              )}

              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label htmlFor="autoEndAtCompletion" className="text-sm">
                    Auto-End at Completion
                  </Label>
                  <p className="text-xs text-muted-foreground">Automatically end when most unique pairings played</p>
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
                    Threshold (%)
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
                  <p className="text-xs text-muted-foreground">End at {settings.completionThreshold}% completion</p>
                </div>
              )}
            </div>
          </fieldset>

          <div className="flex gap-2 pt-2">
            <Button onClick={onClose} className="flex-1" size="sm" disabled={!isOrganizer}>
              {isOrganizer ? "Save & Close" : "Close"}
            </Button>
            {isOrganizer && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm("Reset all settings to default values?")) {
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
                    })
                    onClose()
                  }
                }}
              >
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
