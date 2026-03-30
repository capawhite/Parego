import type { PairingAlgorithm } from "./types"
import { allVsAllAlgorithm } from "./all-vs-all"
import { balancedStrengthAlgorithm } from "./balanced-strength"

/**
 * Registry of all available pairing algorithms
 */
export const pairingAlgorithms: Record<string, PairingAlgorithm> = {
  [allVsAllAlgorithm.id]: allVsAllAlgorithm,
  [balancedStrengthAlgorithm.id]: balancedStrengthAlgorithm,
}

/**
 * Get algorithm by ID
 */
export function getPairingAlgorithm(algorithmId: string): PairingAlgorithm {
  const algorithm = pairingAlgorithms[algorithmId]

  if (!algorithm) {
    console.warn(`[v0] Unknown algorithm: ${algorithmId}, falling back to all-vs-all`)
    return allVsAllAlgorithm
  }

  return algorithm
}

// Re-export types
export type { PairingAlgorithm } from "./types"
