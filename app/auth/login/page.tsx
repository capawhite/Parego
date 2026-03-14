"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Home } from "lucide-react"
import { toast } from "sonner"
import { claimGuestHistory } from "@/app/actions/claim-guest-history"
import { getGuestSessionHistory, clearGuestSessionHistory } from "@/lib/guest-session-history"
import { useI18n } from "@/components/i18n-provider"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { t } = useI18n()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      if (process.env.NODE_ENV === "development") console.log("[v0] Attempting login...")
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error

      if (process.env.NODE_ENV === "development") console.log("[v0] Login successful, redirecting...")

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

      // Use window.location.href for full page reload to establish session
      window.location.href = "/"
    } catch (error: unknown) {
      console.error("[v0] Login error:", error)
      setError(error instanceof Error ? error.message : t("auth.loginErrorGeneric"))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full flex-col items-center p-4">
      <div className="mb-4 w-full max-w-sm">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <Home className="h-4 w-4" />
          {t("home.homeLink")}
        </Link>
      </div>
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t("auth.loginTitle")}</CardTitle>
            <CardDescription>{t("auth.loginDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin}>
              <div className="flex flex-col gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">{t("auth.loginEmailLabel")}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">{t("auth.loginPasswordLabel")}</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? t("common.loading") : t("auth.loginSubmit")}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm">
                {t("auth.noAccount")}{" "}
                <Link href="/auth/signup" className="underline underline-offset-4">
                  {t("auth.goToSignup")}
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
