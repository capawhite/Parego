/** Set `localStorage.setItem("paregoDebugArenaPairing", "1")` in the browser console, then reload. */
function isArenaPairingDebugEnabled(): boolean {
  if (typeof window === "undefined") return process.env.NODE_ENV === "development"
  try {
    return (
      process.env.NODE_ENV === "development" || localStorage.getItem("paregoDebugArenaPairing") === "1"
    )
  } catch {
    return process.env.NODE_ENV === "development"
  }
}

export function logArenaPairing(label: string, data?: Record<string, unknown>): void {
  if (!isArenaPairingDebugEnabled()) return
  if (data !== undefined) console.info(`[Arena pairing] ${label}`, data)
  else console.info(`[Arena pairing] ${label}`)
}
