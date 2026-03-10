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
import { ChevronLeft, ChevronRight, Loader2, Home, CheckCircle } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { claimGuestHistory } from "@/app/actions/claim-guest-history"
import { getGuestSessionHistory, clearGuestSessionHistory } from "@/lib/guest-session-history"

const TOTAL_STEPS = 3

export default function SignUpPage() {
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [emailStatus, setEmailStatus] = useState<"idle" | "checking" | "available" | "taken">("idle")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

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
      default:
        return false
    }
  }

  const handleSubmit = async () => {
    if (isLoading) return
    setIsLoading(true)
    setError(null)
    const result = await signUp({
      email: email.trim(),
      password,
      name: name.trim(),
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
          toast.success(
            `${claim.claimedCount} past ${claim.claimedCount === 1 ? "game" : "games"} linked to your account.`,
          )
        }
      }
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
      <div className="min-h-svh flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <CheckCircle className="h-8 w-8 text-primary" />
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
    <div className="min-h-svh flex flex-col">
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

          {/* Step 2: Email */}
          {step === 2 && (
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

          {/* Step 3: Password */}
          {step === 3 && (
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
