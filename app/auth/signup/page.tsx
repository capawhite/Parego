"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { signUp, checkEmailAvailable } from "./actions"
import { ChevronLeft, ChevronRight, Loader2, Home, CheckCircle } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { claimGuestHistory } from "@/app/actions/claim-guest-history"
import { getGuestSessionHistory, clearGuestSessionHistory } from "@/lib/guest-session-history"
import { useI18n } from "@/components/i18n-provider"
import { SIMPLE_LEVELS, type SimpleLevelValue } from "@/lib/rating-bands"

const TOTAL_STEPS = 4

export default function SignUpPage() {
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [ratingBand, setRatingBand] = useState<SimpleLevelValue | "">("")
  const [rating, setRating] = useState("")
  const [emailStatus, setEmailStatus] = useState<"idle" | "checking" | "available" | "taken">("idle")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { t } = useI18n()

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
        return email.trim().length > 0 && emailStatus !== "taken"
      case 3:
        return password.length >= 6
      case 4:
        return ratingBand !== ""
      default:
        return false
    }
  }

  const handleSubmit = async () => {
    if (isLoading) return
    setIsLoading(true)
    setError(null)
    const ratingNum = rating.trim() ? parseInt(rating.trim(), 10) : undefined
    const result = await signUp({
      email: email.trim(),
      password,
      name: name.trim(),
      ratingBand: ratingBand || undefined,
      rating: ratingNum != null && !isNaN(ratingNum) ? ratingNum : undefined,
    })
    if (result.error) {
      setIsLoading(false)
      setError(result.error)
      return
    }
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setIsLoading(false)
    if (!signInError) {
      // Silently claim any guest history from this device
      const guestSessions = getGuestSessionHistory()
      if (guestSessions.length > 0) {
        const playerIds = guestSessions.map((s) => s.playerId)
        const claim = await claimGuestHistory(playerIds)
        clearGuestSessionHistory()
        if (claim.success && claim.claimedCount && claim.claimedCount > 0) {
          const key = claim.claimedCount === 1 ? "auth.loginClaimSingle" : "auth.loginClaimMultiple"
          toast.success(t(key, { count: claim.claimedCount }))
        }
      }
      router.push("/")
      return
    }
    if (signInError.message?.toLowerCase().includes("confirm")) {
      toast.info(t("auth.signupConfirmEmail"))
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
      <div className="min-h-svh flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <CheckCircle className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">{t("auth.signupSuccessTitle")}</h1>
          <p className="text-muted-foreground">{t("auth.signupSuccessSubtitle")}</p>
          <Button onClick={() => router.push("/auth/login")} variant="outline" className="w-full max-w-xs mx-auto">
            {t("auth.signupSuccessButton")}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-svh flex flex-col">
      <div className="w-full px-4 pt-6">
        <div className="max-w-md mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Home className="h-4 w-4" />
            {t("home.homeLink")}
          </Link>
        </div>
      </div>
      {/* Progress */}
      <div className="w-full px-4 pt-2 pb-4">
        <div className="max-w-md mx-auto flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            {t("auth.stepOf", { step, total: TOTAL_STEPS })}
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
                <h2 className="text-xl font-semibold">{t("auth.stepNameTitle")}</h2>
                <p className="text-sm text-muted-foreground">{t("auth.stepNameSubtitle")}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name" className="sr-only">
                  {t("auth.signupNameLabel")}
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder={t("auth.namePlaceholder")}
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 text-base"
                />
              </div>
            </div>
          )}

          {/* Step 2: Email */}
          {step === 2 && (
            <div className="space-y-8 animate-in fade-in duration-200">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">{t("auth.stepEmailTitle")}</h2>
                <p className="text-sm text-muted-foreground">{t("auth.stepEmailSubtitle")}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="sr-only">
                  {t("auth.signupEmailLabel")}
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("auth.emailPlaceholder")}
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
                  <p className="text-sm text-muted-foreground">{t("auth.checkingEmail")}</p>
                )}
                {emailStatus === "available" && (
                  <p className="text-sm text-green-600 dark:text-green-400">{t("auth.emailAvailable")}</p>
                )}
                {emailStatus === "taken" && (
                  <p className="text-sm text-destructive">
                    {t("auth.emailTakenLogin")}{" "}
                    <Link href="/auth/login" className="underline">
                      {t("auth.goToLogin")}
                    </Link>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Password */}
          {step === 3 && (
            <div className="space-y-8 animate-in fade-in duration-200">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">{t("auth.stepPasswordTitle")}</h2>
                <p className="text-sm text-muted-foreground">{t("auth.stepPasswordSubtitle")}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="sr-only">
                  {t("auth.signupPasswordLabel")}
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

          {/* Step 4: Level + optional rating */}
          {step === 4 && (
            <div className="space-y-8 animate-in fade-in duration-200">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">{t("auth.stepLevelTitle")}</h2>
                <p className="text-sm text-muted-foreground">{t("auth.stepLevelSubtitle")}</p>
              </div>
              <div className="space-y-4">
                <RadioGroup
                  value={ratingBand}
                  onValueChange={(v) => setRatingBand(v as SimpleLevelValue)}
                  className="flex flex-col gap-2"
                >
                  {SIMPLE_LEVELS.map((level) => (
                    <label
                      key={level.value}
                      className="flex items-center gap-3 rounded-lg border p-3 min-h-[48px] cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5 touch-manipulation"
                    >
                      <RadioGroupItem value={level.value} id={`level-${level.value}`} />
                      <span className="text-sm">{t(level.labelKey)}</span>
                    </label>
                  ))}
                </RadioGroup>
                <div className="space-y-2">
                  <Label htmlFor="rating-optional" className="text-sm font-medium">
                    {t("auth.ratingOptionalLabel")}
                  </Label>
                  <Input
                    id="rating-optional"
                    type="number"
                    placeholder={t("auth.ratingOptionalPlaceholder")}
                    min={100}
                    max={3000}
                    value={rating}
                    onChange={(e) => setRating(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    className="h-11"
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive">{error}</p>
              {error.includes("already registered") && (
                <Link href="/auth/login" className="text-sm text-destructive underline mt-2 inline-block font-medium">
                  {t("auth.errorGoToLogin")}
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
                  t("auth.createAccountButton")
                )
              ) : (
                <>
                  {t("auth.nextButton")}
                  <ChevronRight className="h-5 w-5 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      <p className="text-center text-sm text-muted-foreground pb-8">
        {t("auth.alreadyHaveAccount")}{" "}
        <Link href="/auth/login" className="underline underline-offset-4 font-medium">
          {t("auth.goToLogin")}
        </Link>
      </p>
    </div>
  )
}
