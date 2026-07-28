import { describe, expect, it } from "vitest"
import { formatDurationClock } from "@/lib/tournament/format-duration"

describe("formatDurationClock", () => {
  it("formats minutes and seconds", () => {
    expect(formatDurationClock(0)).toBe("0:00")
    expect(formatDurationClock(65_000)).toBe("1:05")
    expect(formatDurationClock(3_600_000)).toBe("60:00")
  })
})
