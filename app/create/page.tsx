"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Trophy, MapPin, Clock, Globe, Lock } from "lucide-react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { saveTournament } from "@/lib/database/tournament-db"
import { DEFAULT_SETTINGS } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useI18n } from "@/components/i18n-provider"

export default function CreateTournamentPage() {
  const router = useRouter()
  const { t } = useI18n()

  const [tournamentName, setTournamentName] = useState("")
  const [visibility, setVisibility] = useState<"public" | "private">("public")
  const [startTime, setStartTime] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const [pairingAlgorithm, setPairingAlgorithm] = useState<string>("all-vs-all")
  const [baseTimeMinutes, setBaseTimeMinutes] = useState<number>(5)
  const [incrementSeconds, setIncrementSeconds] = useState<number>(3)

  const [user, setUser] = useState<{ id: string; name: string; city?: string; country?: string } | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)

  const [location, setLocation] = useState<{ lat: number; lon: number; city?: string; country?: string } | null>(null)
  const [detectingLocation, setDetectingLocation] = useState(true)

  // Check auth
  useEffect(() => {
    const supabase = createClient()

    async function checkAuth() {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser()

        if (!authUser) {
          router.push("/auth/login")
          return
        }

        const { data: profile } = await supabase
          .from("users")
          .select("name, city, country")
          .eq("id", authUser.id)
          .maybeSingle()

        if (profile) {
          setUser({
            id: authUser.id,
            name: profile.name || authUser.user_metadata?.name || "Unknown",
            city: profile.city,
            country: profile.country,
          })
        } else {
          setUser({
            id: authUser.id,
            name: authUser.user_metadata?.name || "Unknown",
            city: authUser.user_metadata?.city,
            country: authUser.user_metadata?.country,
          })
        }
      } catch (error) {
        console.error("[v0] Auth error:", error)
        router.push("/auth/login")
      } finally {
        setLoadingAuth(false)
      }
    }

    checkAuth()
  }, [router])

  // Auto-detect location
  useEffect(() => {
    const fetchIpLocation = async () => {
      try {
        const response = await fetch("https://ipapi.co/json/")
        if (response.ok) {
          return await response.json()
        }
      } catch {
        // IP geolocation failed, continue without it
      }
      return null
    }

    // Try browser geolocation for accurate lat/lon, fall back to IP-based
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords
          // Use IP-based for city/country (browser geolocation doesn't provide these)
          const ipData = await fetchIpLocation()
          setLocation({
            lat: latitude,
            lon: longitude,
            city: ipData?.city,
            country: ipData?.country_name,
          })
          setDetectingLocation(false)
        },
        async () => {
          // Browser geolocation denied/failed, use IP-based for everything
          const ipData = await fetchIpLocation()
          if (ipData) {
            setLocation({
              lat: ipData.latitude,
              lon: ipData.longitude,
              city: ipData.city,
              country: ipData.country_name,
            })
          }
          setDetectingLocation(false)
        },
        { enableHighAccuracy: true, timeout: 5000 },
      )
    } else {
      // No browser geolocation, use IP-based
      fetchIpLocation().then((data) => {
        if (data) {
          setLocation({
            lat: data.latitude,
            lon: data.longitude,
            city: data.city,
            country: data.country_name,
          })
        }
        setDetectingLocation(false)
      })
    }
  }, [])

  const handleCreate = async () => {
    if (!user) return
    if (!tournamentName.trim()) {
      toast.error(t("create.errorNameRequired"))
      return
    }

    if (pairingAlgorithm === "balanced-strength") {
      if (baseTimeMinutes < 1 || baseTimeMinutes > 300) {
        toast.error(t("create.errorBaseTimeRange"))
        return
      }
      if (incrementSeconds < 0 || incrementSeconds > 180) {
        toast.error(t("create.errorIncrementRange"))
        return
      }
    }

    setIsCreating(true)
    try {
      const tournamentId = Math.random().toString(36).substring(2, 8).toUpperCase()

      localStorage.setItem(
        "tournamentPlayer",
        JSON.stringify({
          tournamentId: tournamentId,
          role: "organizer",
        }),
      )

      const settings = {
        ...DEFAULT_SETTINGS,
        pairingAlgorithm,
        baseTimeMinutes,
        incrementSeconds,
      }

      await saveTournament(
        tournamentId,
        tournamentName,
        "setup",
        0,
        settings,
        location?.city || user.city,
        location?.country || user.country,
        user.id,
        location?.lat,
        location?.lon,
        visibility,
        startTime ? new Date(startTime).toISOString() : undefined,
      )

      router.push(`/tournament/${tournamentId}`)
    } catch (error) {
      console.error("[v0] Error creating tournament:", error)
      toast.error(t("create.errorCreate"))
    } finally {
      setIsCreating(false)
    }
  }

  if (loadingAuth) {
    return (
      <main className="min-h-svh bg-background flex items-center justify-center">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </main>
    )
  }

  if (!user) {
    return null // Will redirect
  }

  return (
    <main className="min-h-svh bg-background p-4 sm:p-6">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="min-h-10 min-w-10 touch-manipulation shrink-0" onClick={() => router.push("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{t("create.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("create.subtitle")}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              {t("create.detailsTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">{t("create.nameLabel")}</Label>
              <Input
                id="name"
                placeholder={t("create.namePlaceholder")}
                value={tournamentName}
                onChange={(e) => setTournamentName(e.target.value)}
                disabled={isCreating}
              />
            </div>

            {/* Visibility */}
            <div className="space-y-2">
              <Label>{t("create.visibilityLabel")}</Label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  variant={visibility === "public" ? "default" : "outline"}
                  className={`flex-1 min-h-10 touch-manipulation min-w-0 ${visibility !== "public" ? "bg-transparent" : ""}`}
                  onClick={() => setVisibility("public")}
                >
                  <Globe className="h-4 w-4 mr-2 shrink-0" />
                  {t("create.visibilityPublic")}
                </Button>
                <Button
                  type="button"
                  variant={visibility === "private" ? "default" : "outline"}
                  className={`flex-1 min-h-10 touch-manipulation min-w-0 ${visibility !== "private" ? "bg-transparent" : ""}`}
                  onClick={() => setVisibility("private")}
                >
                  <Lock className="h-4 w-4 mr-2 shrink-0" />
                  {t("create.visibilityPrivate")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {visibility === "public"
                  ? t("create.visibilityPublicHelp")
                  : t("create.visibilityPrivateHelp")}
              </p>
            </div>

            {/* Start Time (optional) */}
            <div className="space-y-2">
              <Label htmlFor="start-time" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {t("create.startTimeLabel")}
                <span className="text-xs text-muted-foreground">{t("create.startTimeOptional")}</span>
              </Label>
              <Input
                id="start-time"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={isCreating}
              />
              <p className="text-xs text-muted-foreground">
                {t("create.startTimeHelp")}
              </p>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {t("create.locationLabel")}
              </Label>
              {detectingLocation ? (
                <p className="text-sm text-muted-foreground">{t("create.locationDetecting")}</p>
              ) : location ? (
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="text-sm">
                    {location.city && location.country
                      ? `${location.city}, ${location.country}`
                      : location.country || t("create.locationDetectedFallback")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("create.locationNotAvailable")}</p>
              )}
            </div>

            {/* Pairing Algorithm */}
            <div className="space-y-2">
              <Label htmlFor="pairing-algorithm">{t("create.pairingAlgorithmLabel")}</Label>
              <Select value={pairingAlgorithm} onValueChange={setPairingAlgorithm} disabled={isCreating}>
                <SelectTrigger id="pairing-algorithm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-vs-all">{t("create.pairingAllVsAll")}</SelectItem>
                  <SelectItem value="balanced-strength">{t("create.pairingArenaBalanced")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {pairingAlgorithm === "balanced-strength"
                  ? t("create.pairingArenaBalancedDescription")
                  : t("create.pairingAllVsAllDescription")}
              </p>
            </div>

            {/* Time Control */}
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {t("create.timeControlLabel")}
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="base-time" className="text-xs text-muted-foreground">
                    {t("create.baseTimeLabel")}
                  </Label>
                  <Input
                    id="base-time"
                    type="number"
                    min="1"
                    max="300"
                    value={baseTimeMinutes}
                    onChange={(e) =>
                      setBaseTimeMinutes(Math.max(1, Math.min(300, Number.parseInt(e.target.value) || 1)))
                    }
                    disabled={isCreating}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="increment" className="text-xs text-muted-foreground">
                    {t("create.incrementLabel")}
                  </Label>
                  <Input
                    id="increment"
                    type="number"
                    min="0"
                    max="180"
                    value={incrementSeconds}
                    onChange={(e) =>
                      setIncrementSeconds(Math.max(0, Math.min(180, Number.parseInt(e.target.value) || 0)))
                    }
                    disabled={isCreating}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t("create.timeControlDefault")}</p>
            </div>

            <Button onClick={handleCreate} className="w-full" disabled={isCreating || !tournamentName.trim()}>
              {isCreating ? t("create.creating") : t("create.createButton")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
