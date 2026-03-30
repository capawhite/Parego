import enMessages from "@/localization/messages.en.json"
import esMessages from "@/localization/messages.es.json"

export type Locale = "en" | "es"

const ALL_MESSAGES = {
  en: enMessages,
  es: esMessages,
} as const

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return Object.keys(params).reduce((result, key) => {
    const value = params[key]
    return result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value))
  }, template)
}

export function translate(
  locale: Locale,
  path: string,
  params?: Record<string, string | number>,
): string {
  const messages = ALL_MESSAGES[locale] ?? ALL_MESSAGES.en
  const segments = path.split(".")

  let current: any = messages
  for (const segment of segments) {
    if (current && typeof current === "object" && segment in current) {
      current = current[segment]
    } else {
      return path
    }
  }

  if (typeof current !== "string") {
    return path
  }

  return interpolate(current, params)
}

