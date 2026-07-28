/**
 * Safe Sentry helpers — no-ops when DSN is unset / SDK not initialized.
 */
import * as Sentry from "@sentry/nextjs"

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() && !process.env.SENTRY_DSN?.trim()) return
  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(context)
    }
    Sentry.captureException(error)
  })
}

export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "error",
  context?: Record<string, unknown>,
): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() && !process.env.SENTRY_DSN?.trim()) return
  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(context)
    }
    Sentry.captureMessage(message, level)
  })
}
