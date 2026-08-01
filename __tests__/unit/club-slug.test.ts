import { describe, expect, it } from "vitest"
import { clubSlugFromName } from "@/lib/database/club-db"

describe("clubSlugFromName", () => {
  it("slugifies club names", () => {
    expect(clubSlugFromName("Madrid Chess Club")).toBe("madrid-chess-club")
  })

  it("falls back when name is empty-ish", () => {
    expect(clubSlugFromName("!!").startsWith("club-")).toBe(true)
  })
})
