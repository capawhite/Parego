#!/usr/bin/env node
/**
 * Render cron start command: hit Parego pair-active endpoint.
 *
 * Env:
 *   PAREGO_APP_URL          e.g. https://parego.onrender.com
 *   PAIRING_CRON_SECRET     shared secret (Bearer token)
 */

const base = (process.env.PAREGO_APP_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "")
const secret = process.env.PAIRING_CRON_SECRET?.trim()

async function main() {
  if (!base) {
    console.error("[cron-pair-active] PAREGO_APP_URL is not set")
    process.exit(1)
  }
  if (!secret) {
    console.error("[cron-pair-active] PAIRING_CRON_SECRET is not set")
    process.exit(1)
  }

  const url = `${base}/api/cron/pair-active`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
  })
  const text = await res.text()
  console.log(`[cron-pair-active] ${res.status} ${text.slice(0, 500)}`)
  if (!res.ok) process.exit(1)
}

main().catch((err) => {
  console.error("[cron-pair-active] failed:", err)
  process.exit(1)
})
