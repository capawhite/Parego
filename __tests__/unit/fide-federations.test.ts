import { describe, it, expect } from "vitest"
import {
  federationGeocodeName,
  federationLabel,
  isValidFederationCode,
  normalizeFederationCode,
  splitLegacyCountryField,
} from "@/lib/fide/federations"
import { isKnownCountryName, normalizeCountryName } from "@/lib/geo/countries"

describe("FIDE federations", () => {
  it("normalizes and validates codes", () => {
    expect(normalizeFederationCode(" esp ")).toBe("ESP")
    expect(isValidFederationCode("ESP")).toBe(true)
    expect(isValidFederationCode("Spain")).toBe(false)
    expect(isValidFederationCode("ZZZ")).toBe(false)
  })

  it("formats labels and geocode names", () => {
    expect(federationLabel("ESP")).toBe("ESP — Spain")
    expect(federationGeocodeName("ENG")).toBe("England")
    expect(federationGeocodeName("USA")).toBe("United States")
  })

  it("splits legacy country field when value is a FIDE code", () => {
    expect(splitLegacyCountryField("ESP")).toEqual({
      federation: "ESP",
      country: "Spain",
    })
    expect(splitLegacyCountryField("Madrid")).toEqual({
      federation: null,
      country: "Madrid",
    })
  })
})

describe("geographic countries", () => {
  it("normalizes known country names case-insensitively", () => {
    expect(normalizeCountryName("spain")).toBe("Spain")
    expect(isKnownCountryName("Spain")).toBe(true)
    expect(isKnownCountryName("Not A Real Place")).toBe(false)
    expect(isKnownCountryName("")).toBe(true)
  })
})
