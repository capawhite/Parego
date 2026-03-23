import type { SubmitErrorCode } from "@/lib/submit-error-codes"

/** Prefer translated `submitErrors.<code>`; fall back to server `error` or translated `fallbackPath`. */
export function messageForSubmitResponse(
  t: (path: string, params?: Record<string, string | number>) => string,
  response: { error?: string; errorCode?: string },
  fallbackPath: string,
  fallbackParams?: Record<string, string | number>,
): string {
  const code = response.errorCode as SubmitErrorCode | undefined
  if (code) {
    const key = `submitErrors.${code}`
    const msg = t(key)
    if (msg !== key) return msg
  }
  return response.error ?? t(fallbackPath, fallbackParams)
}
