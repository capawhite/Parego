"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { geocodeLocation } from "@/lib/geocode"
import { SIMPLE_LEVELS, type RatingBandValue } from "@/lib/rating-bands"
import { AvatarPicker } from "@/components/avatar-picker"
import { uploadAvatar, updateProfileAvatarUrl, removeAvatar } from "@/lib/avatar-upload"
import { toast } from "sonner"
import Link from "next/link"
import { Home } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"

export default function ProfilePage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [ratingBand, setRatingBand] = useState<RatingBandValue | "">("")
  const [rating, setRating] = useState("")
  const [country, setCountry] = useState("")
  const [city, setCity] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isInActiveTournament, setIsInActiveTournament] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const { t } = useI18n()

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth/login")
        return
      }
      setUserId(user.id)

      const { data: profile } = await supabase.from("users").select("*").eq("id", user.id).single()

      if (profile) {
        setName(profile.name || "")
        setEmail(profile.email || "")
        const band = profile.rating_band as string | null
        if (band === "beginner" || band === "intermediate" || band === "advanced") {
          setRatingBand(band as RatingBandValue)
        } else if (band === "around_1500") {
          setRatingBand("intermediate" as RatingBandValue)
        } else if (band === "around_2000" || band === "over_2000") {
          setRatingBand("advanced" as RatingBandValue)
        } else if (band) {
          setRatingBand("beginner" as RatingBandValue)
        } else {
          setRatingBand("")
        }
        setRating(profile.rating?.toString() || "")
        setCountry(profile.country || "")
        setCity(profile.city || "")
        setAvatarUrl(profile.avatar_url || null)
      }

      const { data: activeTournament } = await supabase.rpc("is_user_in_active_tournament", { user_id: user.id })
      setIsInActiveTournament(!!activeTournament)
    }

    loadProfile()
  }, [router, supabase])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { latitude, longitude } = await geocodeLocation(city, country)
      if (process.env.NODE_ENV === "development")
        console.log("[v0] Profile update: Geocoded coordinates:", { latitude, longitude })

      const { error: updateError } = await supabase
        .from("users")
        .update({
          name,
          email: email || null,
          rating_band: ratingBand || null,
          rating: rating ? Number.parseInt(rating, 10) : null,
          country: country || null,
          city: city || null,
          latitude,
          longitude,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

      if (updateError) throw updateError
      setSuccess(true)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : t("profile.errorGeneric"))
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  const handleAvatarSelect = async (file: File) => {
    if (!userId) return
    setAvatarUploading(true)
    const result = await uploadAvatar(userId, file)
    setAvatarUploading(false)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    setAvatarUrl(result.url)
    const updateResult = await updateProfileAvatarUrl(userId, result.url)
    if (updateResult.error) toast.error(updateResult.error)
    else toast.success(t("profile.photoUpdated"))
  }

  const handleAvatarClear = async () => {
    if (!userId) return
    setAvatarUploading(true)
    const result = await removeAvatar(userId)
    setAvatarUploading(false)
    if (result.error) toast.error(result.error)
    else {
      setAvatarUrl(null)
      toast.success(t("profile.photoRemoved"))
    }
  }

  return (
    <div className="flex min-h-svh w-full flex-col items-center p-4 sm:p-6">
      <div className="mb-4 w-full max-w-sm">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <Home className="h-4 w-4" />
          {t("profile.home")}
        </Link>
      </div>
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t("profile.title")}</CardTitle>
            <CardDescription>{t("profile.saveProfile")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile}>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col items-center gap-2">
                  <Label>{t("profile.photoLabel")}</Label>
                  <AvatarPicker
                    value={avatarUrl}
                    onSelect={handleAvatarSelect}
                    onClear={handleAvatarClear}
                    disabled={avatarUploading}
                    size="lg"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">{t("profile.nameLabel")}</Label>
                  <Input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">{t("profile.emailLabel")}</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>{t("profile.strengthLabel")}</Label>
                  <RadioGroup
                    value={ratingBand}
                    onValueChange={(v) => setRatingBand(v as RatingBandValue)}
                    className="flex flex-col gap-2"
                  >
                    {SIMPLE_LEVELS.map((level) => (
                      <label
                        key={level.value}
                        className="flex items-center gap-3 rounded-lg border p-2 cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                      >
                        <RadioGroupItem value={level.value} id={`profile-band-${level.value}`} />
                        <span className="text-sm">{t(level.labelKey)}</span>
                      </label>
                    ))}
                  </RadioGroup>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rating">
                    {t("profile.ratingLabel")}
                    {isInActiveTournament && (
                      <span className="ml-2 text-xs text-amber-500">
                        {t("profile.ratingActiveNote")}
                      </span>
                    )}
                  </Label>
                  <Input
                    id="rating"
                    type="number"
                    placeholder={t("profile.ratingPlaceholder")}
                    min={100}
                    max={3000}
                    value={rating}
                    disabled={isInActiveTournament}
                    onChange={(e) => setRating(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="country">{t("profile.countryLabel")}</Label>
                  <Input
                    id="country"
                    type="text"
                    placeholder={t("profile.countryPlaceholder")}
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="city">{t("profile.cityLabel")}</Label>
                  <Input
                    id="city"
                    type="text"
                    placeholder={t("profile.cityPlaceholder")}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                {success && <p className="text-sm text-green-500">{t("profile.success")}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? t("profile.updating") : t("profile.updateButton")}
                </Button>
                <Button type="button" variant="outline" className="w-full bg-transparent" onClick={handleLogout}>
                  {t("profile.logoutButton")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
