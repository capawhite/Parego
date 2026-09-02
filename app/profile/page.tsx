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
import { FidePlayerSearch, type FidePlayerSelection } from "@/components/fide-player-search"
import { ManualRatingsInput, type ManualRatingsState } from "@/components/manual-ratings-input"
import {
  fideRatingToBand,
  fideSelectionToDbFields,
  manualRatingsToDbFields,
  mergeDisplayRatings,
  missingFideRatingFields,
  pickFideRating,
  ratingsFromInputs,
} from "@/lib/fide/rating"

export default function ProfilePage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [ratingBand, setRatingBand] = useState<RatingBandValue | "">("")
  const [manualRatings, setManualRatings] = useState<ManualRatingsState>({
    standard: "",
    rapid: "",
    blitz: "",
  })
  const [country, setCountry] = useState("")
  const [city, setCity] = useState("")
  const [fideSelection, setFideSelection] = useState<FidePlayerSelection | null>(null)
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
        const legacyRating = profile.rating?.toString() || ""
        if (profile.fide_id) {
          const fideRatings = {
            standard: profile.fide_standard ?? null,
            rapid: profile.fide_rapid ?? null,
            blitz: profile.fide_blitz ?? null,
          }
          setManualRatings({
            standard: fideRatings.standard == null ? legacyRating : "",
            rapid: fideRatings.rapid == null ? "" : "",
            blitz: fideRatings.blitz == null ? "" : "",
          })
          setFideSelection({
            fideId: profile.fide_id,
            fideTitle: profile.fide_title ?? null,
            name: profile.name || `FIDE ${profile.fide_id}`,
            federation: profile.country ?? null,
            ratings: fideRatings,
            rating: profile.rating ?? null,
          })
        } else {
          setManualRatings({
            standard: profile.fide_standard?.toString() || legacyRating || "",
            rapid: profile.fide_rapid?.toString() || "",
            blitz: profile.fide_blitz?.toString() || "",
          })
          setFideSelection(null)
        }
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

      const parsedManualRatings = ratingsFromInputs(
        manualRatings.standard,
        manualRatings.rapid,
        manualRatings.blitz,
      )

      let fideFields
      let profileRating: number | null

      if (fideSelection) {
        fideFields = fideSelectionToDbFields(fideSelection)
        // Self-reported classical when FIDE has no standard rating (users.rating).
        const manualClassical =
          fideSelection.ratings.standard == null ? parsedManualRatings.standard : null
        profileRating =
          manualClassical ??
          pickFideRating({
            standard: fideSelection.ratings.standard,
            rapid: fideSelection.ratings.rapid ?? parsedManualRatings.rapid,
            blitz: fideSelection.ratings.blitz ?? parsedManualRatings.blitz,
          })
        // Fill rapid/blitz gaps from manual entry when not on FIDE profile.
        if (fideFields.fide_rapid == null) fideFields.fide_rapid = parsedManualRatings.rapid
        if (fideFields.fide_blitz == null) fideFields.fide_blitz = parsedManualRatings.blitz
      } else {
        fideFields = {
          fide_id: null as number | null,
          fide_title: null as string | null,
          ...manualRatingsToDbFields(parsedManualRatings),
        }
        profileRating = pickFideRating(parsedManualRatings)
      }

      const { error: updateError } = await supabase
        .from("users")
        .update({
          name,
          email: email || null,
          rating_band: ratingBand || null,
          rating: profileRating,
          country: country || null,
          city: city || null,
          ...fideFields,
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

  const parsedManualForDisplay = ratingsFromInputs(
    manualRatings.standard,
    manualRatings.rapid,
    manualRatings.blitz,
  )
  const missingFromFide = fideSelection ? missingFideRatingFields(fideSelection.ratings) : []
  const showManualRatings = !fideSelection || missingFromFide.length > 0
  const displayRatings = fideSelection
    ? mergeDisplayRatings(fideSelection.ratings, parsedManualForDisplay)
    : undefined

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
      <div className="mb-4 w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <Home className="h-4 w-4" />
          {t("profile.home")}
        </Link>
      </div>
      <div className="w-full max-w-md">
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
                  <Label>{t("fide.profileLabel")}</Label>
                  <p className="text-xs text-muted-foreground">{t("fide.profileHint")}</p>
                  <FidePlayerSearch
                    variant="prominent"
                    selected={fideSelection}
                    displayRatings={displayRatings}
                    disabled={isInActiveTournament}
                    onSelect={(player) => {
                      setFideSelection(player)
                      setManualRatings((prev) => ({
                        standard: player.ratings.standard == null ? prev.standard : "",
                        rapid: player.ratings.rapid == null ? prev.rapid : "",
                        blitz: player.ratings.blitz == null ? prev.blitz : "",
                      }))
                      if (!isInActiveTournament && player.rating != null) {
                        setRatingBand(fideRatingToBand(player.rating))
                      }
                      if (player.federation) setCountry(player.federation)
                    }}
                    onClear={() => {
                      if (fideSelection) {
                        const manualClassical =
                          fideSelection.ratings.standard == null ? manualRatings.standard : ""
                        setManualRatings({
                          standard: manualClassical || fideSelection.ratings.standard?.toString() || "",
                          rapid: fideSelection.ratings.rapid?.toString() ?? "",
                          blitz: fideSelection.ratings.blitz?.toString() ?? "",
                        })
                      }
                      setFideSelection(null)
                    }}
                  />
                </div>
                {showManualRatings && (
                  <div className="grid gap-2">
                    <Label>
                      {fideSelection ? t("profile.ratingsAddMissingLabel") : t("profile.ratingsLabel")}
                      {isInActiveTournament && (
                        <span className="ml-2 text-xs text-amber-500">{t("profile.ratingActiveNote")}</span>
                      )}
                    </Label>
                    <ManualRatingsInput
                      value={manualRatings}
                      onChange={setManualRatings}
                      visibleFields={fideSelection ? missingFromFide : undefined}
                      disabled={isInActiveTournament}
                    />
                  </div>
                )}
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
