import { describe, it, expect } from "vitest"
import { beginMatchResultRecording, releaseMatchResultRecording } from "@/lib/match-result-recording"

describe("match-result-recording", () => {
  it("allows first begin only once per id", () => {
    const s = new Set<string>()
    expect(beginMatchResultRecording("m1", s)).toBe(true)
    expect(beginMatchResultRecording("m1", s)).toBe(false)
  })

  it("release allows begin again", () => {
    const s = new Set<string>()
    beginMatchResultRecording("m1", s)
    releaseMatchResultRecording("m1", s)
    expect(beginMatchResultRecording("m1", s)).toBe(true)
  })
})
