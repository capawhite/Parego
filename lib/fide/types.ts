export type FidePlayerTitle = "GM" | "IM" | "FM" | "CM" | "WGM" | "WIM" | "WFM" | "WCM" | string

export type FideRatings = {
  standard: number | null
  rapid: number | null
  blitz: number | null
}

export type FidePlayer = {
  id: number
  name: string
  federation: string | null
  year: number | null
  title: FidePlayerTitle | null
  standard: number | null
  rapid: number | null
  blitz: number | null
  inactive?: boolean
}
