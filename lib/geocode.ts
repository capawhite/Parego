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

    console.log("[v0] No geocoding results found for:", query)
    return { latitude: null, longitude: null }
  } catch (error) {
    console.error("[v0] Geocoding error:", error)
    return { latitude: null, longitude: null }
  }
}

/**
 * Get user coordinates from browser geolocation API
 */
export function getBrowserLocation(): Promise<{
  latitude: number
  longitude: number
} | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      (error) => {
        console.log("[v0] Browser geolocation denied or failed:", error.message)
        resolve(null)
      },
      {
        timeout: 10000,
        maximumAge: 300000, // Cache for 5 minutes
      },
    )
  })
}
