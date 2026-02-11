"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { signUp, checkEmailAvailable } from "./actions"
import { RATING_BANDS, type RatingBandValue } from "@/lib/rating-bands"
import { ChevronLeft, ChevronRight, Loader2, Home } from "lucide-react"
import { AvatarPicker } from "@/components/avatar-picker"
import { uploadAvatar, updateProfileAvatarUrl } from "@/lib/avatar-upload"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { getGuestSessionHistory, type GuestSessionEntry } from "@/lib/guest-session-history"
import { claimGuestHistory } from "@/app/actions/claim-guest-history"
import { Checkbox } from "@/components/ui/checkbox"

const TOTAL_STEPS = 7

export default function SignUpPage() {
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [ratingBand, setRatingBand] = useState<RatingBandValue | "">("")
  const [ratingPrecise, setRatingPrecise] = useState("")
  const [country, setCountry] = useState("")
  const [city, setCity] = useState("")
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [emailStatus, setEmailStatus] = useState<"idle" | "checking" | "available" | "taken">("idle")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isDetectingLocation, setIsDetectingLocation] = useState(true)
  const [guestHistory, setGuestHistory] = useState<GuestSessionEntry[]>([])
  const [claimedPlayerIds, setClaimedPlayerIds] = useState<Set<string>>(new Set())
  const router = useRouter()

  useEffect(() => {
    const detectLocation = async () => {
      try {
        const response = await fetch("https://ipapi.co/json/")
        const data = await response.json()
        if (data.country_name) setCountry(data.country_name)
        if (data.city) setCity(data.city)
      } catch {
        // use manual entry
      } finally {
        setIsDetectingLocation(false)
      }
    }
    detectLocation()
  }, [])

  useEffect(() => {
    setGuestHistory(getGuestSessionHistory())
  }, [])

  const goNext = () => {
    setError(null)
    if (step < TOTAL_STEPS) setStep((s) => s + 1)
  }

  const handleEmailBlur = async () => {
    const trimmed = email.trim()
    if (!trimmed || !trimmed.includes("@")) {
      setEmailStatus("idle")
      return
    }
    setEmailStatus("checking")
    const result = await checkEmailAvailable(trimmed)
    setEmailStatus(result.available ? "available" : "taken")
  }

  const goBack = () => {
    setError(null)
    if (step > 1) setStep((s) => s - 1)
  }

  const canProceed = () => {
    switch (step) {
      case 1:
        return name.trim().length > 0
      case 2:
        return ratingBand !== ""
      case 3:
        return true // avatar optional
      case 4:
        return email.trim().length > 0 && emailStatus !== "taken"
      case 5:
        return password.length >= 6
      case 6:
        return true // location optional
      case 7:
        return true // claim optional
      default:
        return false
    }
  }

  const handleSubmit = async () => {
    if (isLoading) return
    setIsLoading(true)
    setError(null)
    const preciseNum = ratingPrecise.trim() ? parseInt(ratingPrecise.trim(), 10) : undefined
    const result = await signUp({
      email: email.trim(),
      password,
      name: name.trim(),
      ratingBand: ratingBand || undefined,
      rating: preciseNum != null && !isNaN(preciseNum) ? preciseNum : undefined,
      country: country || undefined,
      city: city || undefined,
    })
    if (result.error) {
      setIsLoading(false)
      setError(result.error)
      return
    }
    if (result.userId && avatarFile) {
      const uploadResult = await uploadAvatar(result.userId, avatarFile)
      if ("error" in uploadResult) {
        toast.warning(
          "Account created! Your photo couldn't be saved (storage not set up). You can add one in Profile later.",
        )
      } else {
        await updateProfileAvatarUrl(result.userId, uploadResult.url)
      }
    }
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (!signInError && claimedPlayerIds.size > 0) {
      const claimResult = await claimGuestHistory([...claimedPlayerIds])
      if (claimResult.success && (claimResult.claimedCount ?? 0) > 0) {
        toast.success(`Linked ${claimResult.claimedCount} past tournament(s) to your account`)
      } else if (!claimResult.success && claimResult.error) {
        toast.error(claimResult.error)
      }
    }
    setIsLoading(false)
    if (!signInError) {
      router.push("/")
      return
    }
    if (signInError.message?.toLowerCase().includes("confirm")) {
      toast.info("Check your email to confirm your account, then log in.")
    }
    setSuccess(true)
    setTimeout(() => router.push("/auth/login"), 2000)
  }

  const handleNextOrSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (step < TOTAL_STEPS) goNext()
    else handleSubmit()
  }

  if (success) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center p-6 bg-gradient-to-b from-background to-primary/5">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <span className="text-2xl text-primary">✓</span>
          </div>
          <h1 className="text-2xl font-bold">Account created</h1>
          <p className="text-muted-foreground">Redirecting you to login...</p>
          <Button onClick={() => router.push("/auth/login")} variant="outline" className="w-full max-w-xs mx-auto">
            Go to Login
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-svh flex flex-col bg-gradient-to-b from-background to-primary/5">
      <div className="w-full px-4 pt-6">
        <div className="max-w-md mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Home className="h-4 w-4" />
            Home
          </Link>
        </div>
      </div>
      {/* Progress */}
      <div className="w-full px-4 pt-2 pb-4">
        <div className="max-w-md mx-auto flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            {step} of {TOTAL_STEPS}
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <form onSubmit={handleNextOrSubmit} className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Step 1: Name */}
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in duration-200">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">What should we call you?</h2>
                <p className="text-sm text-muted-foreground">Your display name for tournaments</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name" className="sr-only">
                  Name
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 text-base"
                />
              </div>
            </div>
          )}

          {/* Step 2: Strength (funny options + optional exact) */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">How would you describe your strength?</h2>
                <p className="text-sm text-muted-foreground">Helps us pair you with similar players</p>
              </div>
              <RadioGroup
                value={ratingBand}
                onValueChange={(v) => setRatingBand(v as RatingBandValue)}
                className="flex flex-col gap-2"
              >
                {RATING_BANDS.map((band) => (
                  <label
                    key={band.value}
                    className="flex items-center gap-3 rounded-xl border-2 border-muted bg-card p-4 cursor-pointer transition-all hover:border-primary/30 hover:bg-primary/5 has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                  >
                    <RadioGroupItem value={band.value} id={`signup-band-${band.value}`} className="sr-only" />
                    <span className="text-sm font-medium">{band.label}</span>
                  </label>
                ))}
              </RadioGroup>
              <div className="space-y-2 pt-2">
                <label htmlFor="ratingPrecise" className="text-sm text-muted-foreground">
                  Or enter your exact rating (optional)
                </label>
                <Input
                  id="ratingPrecise"
                  type="number"
                  placeholder="e.g. 1847"
                  min={100}
                  max={3000}
                  value={ratingPrecise}
                  onChange={(e) => setRatingPrecise(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="h-12 text-base"
                />
              </div>
            </div>
          )}

          {/* Step 3: Avatar (optional) */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Add a photo?</h2>
                <p className="text-sm text-muted-foreground">Optional — helps others recognize you at tournaments</p>
              </div>
              <AvatarPicker
                selectedFile={avatarFile}
                onSelect={setAvatarFile}
                onClear={() => setAvatarFile(null)}
                size="lg"
              />
              <Button type="button" variant="ghost" className="w-full text-muted-foreground" onClick={goNext}>
                Skip
              </Button>
            </div>
          )}

          {/* Step 4: Email */}
          {step === 4 && (
            <div className="space-y-8 animate-in fade-in duration-200">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Email</h2>
                <p className="text-sm text-muted-foreground">We’ll use this to sign you in</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="sr-only">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoFocus
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setEmailStatus("idle")
                  }}
                  onBlur={handleEmailBlur}
                  className="h-12 text-base"
                />
                {emailStatus === "checking" && (
                  <p className="text-sm text-muted-foreground">Checking...</p>
                )}
                {emailStatus === "available" && (
                  <p className="text-sm text-green-600 dark:text-green-400">Email available</p>
                )}
                {emailStatus === "taken" && (
                  <p className="text-sm text-destructive">
                    This email is already registered.{" "}
                    <Link href="/auth/login" className="underline">
                      Log in
                    </Link>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Password */}
          {step === 5 && (
            <div className="space-y-8 animate-in fade-in duration-200">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Password</h2>
                <p className="text-sm text-muted-foreground">At least 6 characters</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="sr-only">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  minLength={6}
                  placeholder="••••••••"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 text-base"
                />
              </div>
            </div>
          )}

          {/* Step 6: Location */}
          {step === 6 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Where are you?</h2>
                <p className="text-sm text-muted-foreground">Optional — helps show nearby tournaments</p>
              </div>
              <div className="space-y-3">
                <Input
                  type="text"
                  placeholder={isDetectingLocation ? "Detecting..." : "Country"}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  disabled={isDetectingLocation}
                  className="h-12 text-base"
                />
                <Input
                  type="text"
                  placeholder={isDetectingLocation ? "..." : "City"}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={isDetectingLocation}
                  className="h-12 text-base"
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={goNext}
                  disabled={isLoading}
                >
                  Skip
                </Button>
              </div>
            </div>
          )}

          {/* Step 7: Claim past play */}
          {step === 7 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Have you played before?</h2>
                <p className="text-sm text-muted-foreground">
                  Link past tournament play from this device to your new account.
                </p>
              </div>
              {guestHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No past play to claim on this device.</p>
              ) : (
                <div className="space-y-2">
                  {guestHistory.map((entry) => (
                    <label
                      key={`${entry.tournamentId}-${entry.playerId}`}
                      className="flex items-center gap-3 rounded-xl border-2 border-muted bg-card p-4 cursor-pointer transition-all hover:border-primary/30 hover:bg-primary/5 has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                    >
                      <Checkbox
                        checked={claimedPlayerIds.has(entry.playerId)}
                        onCheckedChange={(checked) => {
                          setClaimedPlayerIds((prev) => {
                            const next = new Set(prev)
                            if (checked) next.add(entry.playerId)
                            else next.delete(entry.playerId)
                            return next
                          })
                        }}
                      />
                      <span className="text-sm font-medium">
                        {entry.displayName} — tournament {entry.tournamentId}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive">{error}</p>
              {error.includes("already registered") && (
                <Link href="/auth/login" className="text-sm text-destructive underline mt-2 inline-block font-medium">
                  Go to Login →
                </Link>
              )}
            </div>
          )}

          {/* Nav */}
          <div className="mt-10 flex items-center justify-between gap-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={goBack}
              disabled={step === 1}
              className="h-12 w-12 rounded-full shrink-0"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              type="submit"
              disabled={!canProceed() || (step === TOTAL_STEPS && isLoading)}
              className="flex-1 h-12 rounded-full font-medium max-w-[200px]"
            >
              {step === TOTAL_STEPS ? (
                isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Create account"
                )
              ) : (
                <>
                  Next
                  <ChevronRight className="h-5 w-5 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      <p className="text-center text-sm text-muted-foreground pb-8">
        Already have an account?{" "}
        <Link href="/auth/login" className="underline underline-offset-4 font-medium">
          Log in
        </Link>
      </p>
    </div>
  )
}
