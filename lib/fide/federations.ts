export type FideFederation = {
  code: string
  name: string
  geocodeName: string
}

/** Official and common FIDE member federation codes (3-letter). */
export const FIDE_FEDERATIONS: readonly FideFederation[] = [
  { code: "AFG", name: "Afghanistan", geocodeName: "Afghanistan" },
  { code: "ALB", name: "Albania", geocodeName: "Albania" },
  { code: "ALG", name: "Algeria", geocodeName: "Algeria" },
  { code: "AND", name: "Andorra", geocodeName: "Andorra" },
  { code: "ANG", name: "Angola", geocodeName: "Angola" },
  { code: "ANT", name: "Antigua and Barbuda", geocodeName: "Antigua and Barbuda" },
  { code: "ARG", name: "Argentina", geocodeName: "Argentina" },
  { code: "ARM", name: "Armenia", geocodeName: "Armenia" },
  { code: "ARU", name: "Aruba", geocodeName: "Aruba" },
  { code: "AUS", name: "Australia", geocodeName: "Australia" },
  { code: "AUT", name: "Austria", geocodeName: "Austria" },
  { code: "AZE", name: "Azerbaijan", geocodeName: "Azerbaijan" },
  { code: "BAH", name: "Bahamas", geocodeName: "Bahamas" },
  { code: "BAN", name: "Bangladesh", geocodeName: "Bangladesh" },
  { code: "BAR", name: "Barbados", geocodeName: "Barbados" },
  { code: "BDI", name: "Burundi", geocodeName: "Burundi" },
  { code: "BEL", name: "Belgium", geocodeName: "Belgium" },
  { code: "BER", name: "Bermuda", geocodeName: "Bermuda" },
  { code: "BHU", name: "Bhutan", geocodeName: "Bhutan" },
  { code: "BIH", name: "Bosnia and Herzegovina", geocodeName: "Bosnia and Herzegovina" },
  { code: "BIZ", name: "Belize", geocodeName: "Belize" },
  { code: "BLR", name: "Belarus", geocodeName: "Belarus" },
  { code: "BOL", name: "Bolivia", geocodeName: "Bolivia" },
  { code: "BRA", name: "Brazil", geocodeName: "Brazil" },
  { code: "BRB", name: "British Virgin Islands", geocodeName: "British Virgin Islands" },
  { code: "BRU", name: "Brunei", geocodeName: "Brunei" },
  { code: "BUL", name: "Bulgaria", geocodeName: "Bulgaria" },
  { code: "CAN", name: "Canada", geocodeName: "Canada" },
  { code: "CHI", name: "Chile", geocodeName: "Chile" },
  { code: "CHN", name: "China", geocodeName: "China" },
  { code: "CIV", name: "Côte d'Ivoire", geocodeName: "Côte d'Ivoire" },
  { code: "CMR", name: "Cameroon", geocodeName: "Cameroon" },
  { code: "COD", name: "DR Congo", geocodeName: "Democratic Republic of the Congo" },
  { code: "COL", name: "Colombia", geocodeName: "Colombia" },
  { code: "COM", name: "Comoros", geocodeName: "Comoros" },
  { code: "CPV", name: "Cape Verde", geocodeName: "Cape Verde" },
  { code: "CRC", name: "Costa Rica", geocodeName: "Costa Rica" },
  { code: "CRO", name: "Croatia", geocodeName: "Croatia" },
  { code: "CUB", name: "Cuba", geocodeName: "Cuba" },
  { code: "CYP", name: "Cyprus", geocodeName: "Cyprus" },
  { code: "CZE", name: "Czech Republic", geocodeName: "Czech Republic" },
  { code: "DEN", name: "Denmark", geocodeName: "Denmark" },
  { code: "DJI", name: "Djibouti", geocodeName: "Djibouti" },
  { code: "DOM", name: "Dominican Republic", geocodeName: "Dominican Republic" },
  { code: "ECU", name: "Ecuador", geocodeName: "Ecuador" },
  { code: "EGY", name: "Egypt", geocodeName: "Egypt" },
  { code: "ENG", name: "England", geocodeName: "England" },
  { code: "ESA", name: "El Salvador", geocodeName: "El Salvador" },
  { code: "ESP", name: "Spain", geocodeName: "Spain" },
  { code: "EST", name: "Estonia", geocodeName: "Estonia" },
  { code: "ETH", name: "Ethiopia", geocodeName: "Ethiopia" },
  { code: "FAI", name: "Faroe Islands", geocodeName: "Faroe Islands" },
  { code: "FIJ", name: "Fiji", geocodeName: "Fiji" },
  { code: "FIN", name: "Finland", geocodeName: "Finland" },
  { code: "FRA", name: "France", geocodeName: "France" },
  { code: "GAB", name: "Gabon", geocodeName: "Gabon" },
  { code: "GAM", name: "Gambia", geocodeName: "Gambia" },
  { code: "GCI", name: "Guernsey", geocodeName: "Guernsey" },
  { code: "GEO", name: "Georgia", geocodeName: "Georgia" },
  { code: "GER", name: "Germany", geocodeName: "Germany" },
  { code: "GHA", name: "Ghana", geocodeName: "Ghana" },
  { code: "GRE", name: "Greece", geocodeName: "Greece" },
  { code: "GUA", name: "Guatemala", geocodeName: "Guatemala" },
  { code: "GUY", name: "Guyana", geocodeName: "Guyana" },
  { code: "HAI", name: "Haiti", geocodeName: "Haiti" },
  { code: "HKG", name: "Hong Kong", geocodeName: "Hong Kong" },
  { code: "HON", name: "Honduras", geocodeName: "Honduras" },
  { code: "HUN", name: "Hungary", geocodeName: "Hungary" },
  { code: "INA", name: "Indonesia", geocodeName: "Indonesia" },
  { code: "IND", name: "India", geocodeName: "India" },
  { code: "IOM", name: "Isle of Man", geocodeName: "Isle of Man" },
  { code: "IRI", name: "Iran", geocodeName: "Iran" },
  { code: "IRL", name: "Ireland", geocodeName: "Ireland" },
  { code: "IRQ", name: "Iraq", geocodeName: "Iraq" },
  { code: "ISL", name: "Iceland", geocodeName: "Iceland" },
  { code: "ISR", name: "Israel", geocodeName: "Israel" },
  { code: "ISV", name: "US Virgin Islands", geocodeName: "United States Virgin Islands" },
  { code: "ITA", name: "Italy", geocodeName: "Italy" },
  { code: "JAM", name: "Jamaica", geocodeName: "Jamaica" },
  { code: "JCI", name: "Jersey", geocodeName: "Jersey" },
  { code: "JOR", name: "Jordan", geocodeName: "Jordan" },
  { code: "JPN", name: "Japan", geocodeName: "Japan" },
  { code: "KAZ", name: "Kazakhstan", geocodeName: "Kazakhstan" },
  { code: "KEN", name: "Kenya", geocodeName: "Kenya" },
  { code: "KGZ", name: "Kyrgyzstan", geocodeName: "Kyrgyzstan" },
  { code: "KOR", name: "South Korea", geocodeName: "South Korea" },
  { code: "KOS", name: "Kosovo", geocodeName: "Kosovo" },
  { code: "KSA", name: "Saudi Arabia", geocodeName: "Saudi Arabia" },
  { code: "KUW", name: "Kuwait", geocodeName: "Kuwait" },
  { code: "LAO", name: "Laos", geocodeName: "Laos" },
  { code: "LAT", name: "Latvia", geocodeName: "Latvia" },
  { code: "LBA", name: "Libya", geocodeName: "Libya" },
  { code: "LBN", name: "Lebanon", geocodeName: "Lebanon" },
  { code: "LBR", name: "Liberia", geocodeName: "Liberia" },
  { code: "LCA", name: "Saint Lucia", geocodeName: "Saint Lucia" },
  { code: "LES", name: "Lesotho", geocodeName: "Lesotho" },
  { code: "LIE", name: "Liechtenstein", geocodeName: "Liechtenstein" },
  { code: "LTU", name: "Lithuania", geocodeName: "Lithuania" },
  { code: "LUX", name: "Luxembourg", geocodeName: "Luxembourg" },
  { code: "MAC", name: "Macau", geocodeName: "Macau" },
  { code: "MAD", name: "Madagascar", geocodeName: "Madagascar" },
  { code: "MAR", name: "Morocco", geocodeName: "Morocco" },
  { code: "MAS", name: "Malaysia", geocodeName: "Malaysia" },
  { code: "MAW", name: "Malawi", geocodeName: "Malawi" },
  { code: "MDA", name: "Moldova", geocodeName: "Moldova" },
  { code: "MDV", name: "Maldives", geocodeName: "Maldives" },
  { code: "MEX", name: "Mexico", geocodeName: "Mexico" },
  { code: "MGL", name: "Mongolia", geocodeName: "Mongolia" },
  { code: "MKD", name: "North Macedonia", geocodeName: "North Macedonia" },
  { code: "MLI", name: "Mali", geocodeName: "Mali" },
  { code: "MLT", name: "Malta", geocodeName: "Malta" },
  { code: "MNC", name: "Monaco", geocodeName: "Monaco" },
  { code: "MNE", name: "Montenegro", geocodeName: "Montenegro" },
  { code: "MOZ", name: "Mozambique", geocodeName: "Mozambique" },
  { code: "MRI", name: "Mauritius", geocodeName: "Mauritius" },
  { code: "MTN", name: "Mauritania", geocodeName: "Mauritania" },
  { code: "MYA", name: "Myanmar", geocodeName: "Myanmar" },
  { code: "NAM", name: "Namibia", geocodeName: "Namibia" },
  { code: "NED", name: "Netherlands", geocodeName: "Netherlands" },
  { code: "NEP", name: "Nepal", geocodeName: "Nepal" },
  { code: "NGR", name: "Nigeria", geocodeName: "Nigeria" },
  { code: "NIG", name: "Niger", geocodeName: "Niger" },
  { code: "NOR", name: "Norway", geocodeName: "Norway" },
  { code: "NZL", name: "New Zealand", geocodeName: "New Zealand" },
  { code: "OMA", name: "Oman", geocodeName: "Oman" },
  { code: "PAK", name: "Pakistan", geocodeName: "Pakistan" },
  { code: "PAN", name: "Panama", geocodeName: "Panama" },
  { code: "PAR", name: "Paraguay", geocodeName: "Paraguay" },
  { code: "PER", name: "Peru", geocodeName: "Peru" },
  { code: "PHI", name: "Philippines", geocodeName: "Philippines" },
  { code: "PLE", name: "Palestine", geocodeName: "Palestine" },
  { code: "PNG", name: "Papua New Guinea", geocodeName: "Papua New Guinea" },
  { code: "POL", name: "Poland", geocodeName: "Poland" },
  { code: "POR", name: "Portugal", geocodeName: "Portugal" },
  { code: "PUR", name: "Puerto Rico", geocodeName: "Puerto Rico" },
  { code: "QAT", name: "Qatar", geocodeName: "Qatar" },
  { code: "ROU", name: "Romania", geocodeName: "Romania" },
  { code: "RSA", name: "South Africa", geocodeName: "South Africa" },
  { code: "RUS", name: "Russia", geocodeName: "Russia" },
  { code: "RWA", name: "Rwanda", geocodeName: "Rwanda" },
  { code: "SCO", name: "Scotland", geocodeName: "Scotland" },
  { code: "SEN", name: "Senegal", geocodeName: "Senegal" },
  { code: "SEY", name: "Seychelles", geocodeName: "Seychelles" },
  { code: "SGP", name: "Singapore", geocodeName: "Singapore" },
  { code: "SKN", name: "Saint Kitts and Nevis", geocodeName: "Saint Kitts and Nevis" },
  { code: "SLE", name: "Sierra Leone", geocodeName: "Sierra Leone" },
  { code: "SLO", name: "Slovenia", geocodeName: "Slovenia" },
  { code: "SMR", name: "San Marino", geocodeName: "San Marino" },
  { code: "SOL", name: "Solomon Islands", geocodeName: "Solomon Islands" },
  { code: "SRB", name: "Serbia", geocodeName: "Serbia" },
  { code: "SRI", name: "Sri Lanka", geocodeName: "Sri Lanka" },
  { code: "STP", name: "São Tomé and Príncipe", geocodeName: "São Tomé and Príncipe" },
  { code: "SUD", name: "Sudan", geocodeName: "Sudan" },
  { code: "SUI", name: "Switzerland", geocodeName: "Switzerland" },
  { code: "SUR", name: "Suriname", geocodeName: "Suriname" },
  { code: "SVK", name: "Slovakia", geocodeName: "Slovakia" },
  { code: "SWE", name: "Sweden", geocodeName: "Sweden" },
  { code: "SWZ", name: "Eswatini", geocodeName: "Eswatini" },
  { code: "SYR", name: "Syria", geocodeName: "Syria" },
  { code: "TAN", name: "Tanzania", geocodeName: "Tanzania" },
  { code: "THA", name: "Thailand", geocodeName: "Thailand" },
  { code: "TJK", name: "Tajikistan", geocodeName: "Tajikistan" },
  { code: "TKM", name: "Turkmenistan", geocodeName: "Turkmenistan" },
  { code: "TOG", name: "Togo", geocodeName: "Togo" },
  { code: "TPE", name: "Chinese Taipei", geocodeName: "Taiwan" },
  { code: "TTO", name: "Trinidad and Tobago", geocodeName: "Trinidad and Tobago" },
  { code: "TUN", name: "Tunisia", geocodeName: "Tunisia" },
  { code: "TUR", name: "Turkey", geocodeName: "Turkey" },
  { code: "UAE", name: "United Arab Emirates", geocodeName: "United Arab Emirates" },
  { code: "UGA", name: "Uganda", geocodeName: "Uganda" },
  { code: "UKR", name: "Ukraine", geocodeName: "Ukraine" },
  { code: "URU", name: "Uruguay", geocodeName: "Uruguay" },
  { code: "USA", name: "United States", geocodeName: "United States" },
  { code: "UZB", name: "Uzbekistan", geocodeName: "Uzbekistan" },
  { code: "VEN", name: "Venezuela", geocodeName: "Venezuela" },
  { code: "VIE", name: "Vietnam", geocodeName: "Vietnam" },
  { code: "VIN", name: "Saint Vincent and the Grenadines", geocodeName: "Saint Vincent and the Grenadines" },
  { code: "WLS", name: "Wales", geocodeName: "Wales" },
  { code: "YEM", name: "Yemen", geocodeName: "Yemen" },
  { code: "ZAM", name: "Zambia", geocodeName: "Zambia" },
  { code: "ZIM", name: "Zimbabwe", geocodeName: "Zimbabwe" },
] as const

const FEDERATION_BY_CODE = new Map(FIDE_FEDERATIONS.map((f) => [f.code, f]))

export function normalizeFederationCode(input: string | null | undefined): string | null {
  if (!input) return null
  const code = input.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(code)) return null
  return code
}

export function isValidFederationCode(code: string | null | undefined): boolean {
  const normalized = normalizeFederationCode(code)
  return normalized != null && FEDERATION_BY_CODE.has(normalized)
}

export function getFederation(code: string | null | undefined): FideFederation | null {
  const normalized = normalizeFederationCode(code)
  if (!normalized) return null
  return FEDERATION_BY_CODE.get(normalized) ?? null
}

export function federationLabel(code: string | null | undefined): string {
  const fed = getFederation(code)
  if (!fed) return code?.trim() || "—"
  return `${fed.code} — ${fed.name}`
}

export function federationGeocodeName(code: string | null | undefined): string | null {
  return getFederation(code)?.geocodeName ?? null
}

/** For backfill: if country stored a FIDE code, return federation + geographic name. */
export function splitLegacyCountryField(country: string | null | undefined): {
  federation: string | null
  country: string | null
} {
  if (!country?.trim()) return { federation: null, country: null }
  const trimmed = country.trim()
  const normalized = normalizeFederationCode(trimmed)
  if (normalized && FEDERATION_BY_CODE.has(normalized)) {
    return {
      federation: normalized,
      country: federationGeocodeName(normalized),
    }
  }
  return { federation: null, country: trimmed }
}
