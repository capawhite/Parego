import { describe, expect, it } from "vitest"

/**
 * Mirrors join-tournament joinability check (kept pure for unit coverage).
 */
function isJoinableStatus(status: string, allowLateJoin: boolean): boolean {
  if (status === "setup") return true
  if (status === "active" && allowLateJoin) return true
  return false
}

describe("join tournament joinability", () => {
  it("allows setup always", () => {
    expect(isJoinableStatus("setup", false)).toBe(true)
    expect(isJoinableStatus("setup", true)).toBe(true)
  })

  it("allows active only when late join enabled", () => {
    expect(isJoinableStatus("active", true)).toBe(true)
    expect(isJoinableStatus("active", false)).toBe(false)
  })

  it("rejects completed", () => {
    expect(isJoinableStatus("completed", true)).toBe(false)
  })
})
