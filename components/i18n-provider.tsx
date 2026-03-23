"use client"

import type React from "react"
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import type { Locale } from "@/lib/i18n"
import { translate } from "@/lib/i18n"

type I18nContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (path: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined)

const LOCALE_STORAGE_KEY = "parego.locale"

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "en"

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  if (stored === "en" || stored === "es") return stored

  const browser = window.navigator.language.toLowerCase()
  if (browser.startsWith("es")) return "es"

  return "en"
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => "en")

  useEffect(() => {
    setLocaleState(getInitialLocale())
  }, [])

  useEffect(() => {
    if (typeof document === "undefined") return
    document.documentElement.lang = locale === "es" ? "es" : "en"
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next)
    }
  }, [])

  const t = useCallback(
    (path: string, params?: Record<string, string | number>) => translate(locale, path, params),
    [locale],
  )

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider")
  }
  return ctx
}

