"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { submitMatchResultImpl, type SubmitResultResponse } from "@/lib/submit-match-result"
import type { ResultType } from "@/lib/result-utils"

export type { SubmitResultResponse }

/**
 * Server action: submit a match result (used when action resolution works).
 */
export async function submitMatchResult(
  matchId: string,
  result: ResultType,
  confirmed: boolean,
  playerId?: string,
): Promise<SubmitResultResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const res = await submitMatchResultImpl(matchId, result, confirmed, {
    playerId,
    userId: user?.id,
  })
  if (res.success) revalidatePath(`/tournament/${(res.match as any)?.tournament_id}`)
  return res
}
