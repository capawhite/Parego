import { DEFAULT_SETTINGS, type TournamentSettings } from "@/lib/types"

/**
 * Parse and validate tournament settings from a DB row, filling in defaults
 * for any missing or invalid fields.
 */
export function parseTournamentSettings(raw: { settings?: unknown }): TournamentSettings {
  const s = raw.settings as Record<string, unknown> | undefined
  if (!s || typeof s !== "object") return { ...DEFAULT_SETTINGS }

  const colorOk = (v: unknown): v is TournamentSettings["colorBalancePriority"] =>
    v === "low" || v === "medium" || v === "high"
  const strictOk = (v: unknown): v is TournamentSettings["scoreMatchingStrictness"] =>
    v === "loose" || v === "normal" || v === "strict"
  const t1PresetOk = (v: unknown): v is NonNullable<TournamentSettings["t1CapPreset"]> =>
    v === "fast" || v === "balanced" || v === "strict"

  return {
    winPoints: typeof s.winPoints === "number" ? s.winPoints : DEFAULT_SETTINGS.winPoints,
    drawPoints: typeof s.drawPoints === "number" ? s.drawPoints : DEFAULT_SETTINGS.drawPoints,
    lossPoints: typeof s.lossPoints === "number" ? s.lossPoints : DEFAULT_SETTINGS.lossPoints,
    streakEnabled: typeof s.streakEnabled === "boolean" ? s.streakEnabled : DEFAULT_SETTINGS.streakEnabled,
    streakMultiplier: typeof s.streakMultiplier === "number" ? s.streakMultiplier : DEFAULT_SETTINGS.streakMultiplier,
    allowSelfPause: typeof s.allowSelfPause === "boolean" ? s.allowSelfPause : DEFAULT_SETTINGS.allowSelfPause,
    allowLateJoin: typeof s.allowLateJoin === "boolean" ? s.allowLateJoin : DEFAULT_SETTINGS.allowLateJoin,
    minGamesBeforePause:
      typeof s.minGamesBeforePause === "number" ? s.minGamesBeforePause : DEFAULT_SETTINGS.minGamesBeforePause,
    avoidRecentRematches:
      typeof s.avoidRecentRematches === "number" ? s.avoidRecentRematches : DEFAULT_SETTINGS.avoidRecentRematches,
    colorBalancePriority: colorOk(s.colorBalancePriority) ? s.colorBalancePriority : DEFAULT_SETTINGS.colorBalancePriority,
    scoreMatchingStrictness: strictOk(s.scoreMatchingStrictness)
      ? s.scoreMatchingStrictness
      : DEFAULT_SETTINGS.scoreMatchingStrictness,
    tableCount: typeof s.tableCount === "number" ? s.tableCount : DEFAULT_SETTINGS.tableCount,
    autoEndAtCompletion:
      typeof s.autoEndAtCompletion === "boolean" ? s.autoEndAtCompletion : DEFAULT_SETTINGS.autoEndAtCompletion,
    completionThreshold:
      typeof s.completionThreshold === "number" ? s.completionThreshold : DEFAULT_SETTINGS.completionThreshold,
    pairingAlgorithm: typeof s.pairingAlgorithm === "string" ? s.pairingAlgorithm : DEFAULT_SETTINGS.pairingAlgorithm,
    allowRematchToReduceWait:
      typeof s.allowRematchToReduceWait === "boolean"
        ? s.allowRematchToReduceWait
        : DEFAULT_SETTINGS.allowRematchToReduceWait,
    baseTimeMinutes: typeof s.baseTimeMinutes === "number" ? s.baseTimeMinutes : DEFAULT_SETTINGS.baseTimeMinutes,
    incrementSeconds: typeof s.incrementSeconds === "number" ? s.incrementSeconds : DEFAULT_SETTINGS.incrementSeconds,
    minIdlePlayersBeforePairing:
      typeof s.minIdlePlayersBeforePairing === "number" && s.minIdlePlayersBeforePairing > 0
        ? s.minIdlePlayersBeforePairing
        : undefined,
    pairingStabilizationMs:
      typeof s.pairingStabilizationMs === "number" && s.pairingStabilizationMs > 0
        ? s.pairingStabilizationMs
        : undefined,
    t1CapPreset: t1PresetOk(s.t1CapPreset) ? s.t1CapPreset : DEFAULT_SETTINGS.t1CapPreset,
  }
}
