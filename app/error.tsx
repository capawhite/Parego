"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/components/i18n-provider"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useI18n()

  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-xl font-semibold">{t("common.errorGeneric")}</h2>
      <p className="text-sm text-muted-foreground max-w-md">{t("common.unexpectedError")}</p>
      <div className="flex gap-2">
        <Button type="button" onClick={() => reset()}>
          {t("common.tryAgain")}
        </Button>
        <Button type="button" variant="outline" onClick={() => (window.location.href = "/")}>
          {t("home.homeLink")}
        </Button>
      </div>
    </div>
  )
}
