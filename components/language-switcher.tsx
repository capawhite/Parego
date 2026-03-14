"use client"

import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n()

  return (
    <div className="fixed bottom-4 right-4 z-40 flex items-center gap-1 rounded-full bg-background/80 px-2 py-1 shadow-sm ring-1 ring-border backdrop-blur">
      <Button
        type="button"
        size="sm"
        variant={locale === "en" ? "default" : "ghost"}
        className="h-7 px-2 text-xs"
        onClick={() => setLocale("en")}
      >
        EN
      </Button>
      <Button
        type="button"
        size="sm"
        variant={locale === "es" ? "default" : "ghost"}
        className="h-7 px-2 text-xs"
        onClick={() => setLocale("es")}
      >
        ES
      </Button>
    </div>
  )
}

