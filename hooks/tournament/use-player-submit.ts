"use client"

import { useCallback } from "react"
import type { ResultType } from "@/lib/result-utils"
import type { SubmitResultResponse } from "@/lib/submit-match-result"

/**
 * Player dual-submit via API. Scoring completion is server-owned.
 */
export function usePlayerSubmit() {
  const submitResult = useCallback(
    async (
      matchId: string,
      result: ResultType,
      confirmed: boolean,
    ): Promise<SubmitResultResponse> => {
      const res = await fetch("/api/tournament/match/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, result, confirmed }),
      })
      return (await res.json()) as SubmitResultResponse
    },
    [],
  )

  return { submitResult }
}
