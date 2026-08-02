"use client"

import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Locale } from "@/lib/i18n"

const LOCALES: Locale[] = ["en", "es", "fr"]

const LABELS: Record<Locale, string> = {
  en: "EN",
  es: "ES",
  fr: "FR",
}

type LanguageSwitcherProps = {
  className?: string
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { locale, setLocale } = useI18n()

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md bg-muted/60 p-0.5 ring-1 ring-border/60",
        className,
      )}
      role="group"
      aria-label="Language"
    >
      {LOCALES.map((code) => (
        <Button
          key={code}
          type="button"
          size="sm"
          variant={locale === code ? "default" : "ghost"}
          className="h-7 min-w-8 px-2 text-xs font-semibold"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
        >
          {LABELS[code]}
        </Button>
      ))}
    </div>
  )
}
