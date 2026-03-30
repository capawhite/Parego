/**
 * Geocode a city and country to latitude/longitude coordinates
 * Uses a simple free geocoding service with fallback
 */
export async function geocodeLocation(
  city?: string,
  country?: string,
): Promise<{
  latitude: number | null
  longitude: number | null
}> {
  // Return null if no location provided
  if (!city && !country) {
    return { latitude: null, longitude: null }
  }

  try {
    // Build query string
    const query = [city, country].filter(Boolean).join(", ")

    // Use nominatim (OpenStreetMap) free geocoding service
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      {
        headers: {
          "User-Agent": "Parego-Tournament-App",
        },
      },
    )

    if (!response.ok) {
      console.error("[v0] Geocoding API error:", response.status)
      return { latitude: null, longitude: null }
    }

    const data = await response.json()

    if (data && data.length > 0 && data[0].lat && data[0].lon) {
      return {
        latitude: Number.parseFloat(data[0].lat),
        longitude: Number.parseFloat(data[0].lon),
      }
    }

    if (process.env.NODE_ENV === "development") console.log("[v0] No geocoding results found for:", query)
    return { latitude: null, longitude: null }
  } catch (error) {
    console.error("[v0] Geocoding error:", error)
    return { latitude: null, longitude: null }
  }
}

