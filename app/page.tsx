"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Zap, MapPin, Hash, User, LogOut, Plus } from "lucide-react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

export default function Home() {
  const router = useRouter()
  const [joinCode, setJoinCode] = useState("")
  const [showCodeInput, setShowCodeInput] = useState(false)

  const [user, setUser] = useState<{ id: string; name: string } | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function checkAuth() {
      try {
        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError) {
          if (authError.message.includes("User from sub claim") || authError.message.includes("user_not_found")) {
            await supabase.auth.signOut()
            setUser(null)
            setLoadingAuth(false)
            return
          }
        }

        if (authUser) {
          const userName = authUser.user_metadata?.name
          if (userName) {
            setUser({ id: authUser.id, name: userName })
          } else {
            const { data: profile } = await supabase.from("users").select("name").eq("id", authUser.id).maybeSingle()
            if (profile?.name) {
              setUser({ id: authUser.id, name: profile.name })
            }
          }
        }
      } catch (error) {
        console.error("[v0] Error checking auth:", error)
        await supabase.auth.signOut()
        setUser(null)
      } finally {
        setLoadingAuth(false)
      }
    }

    checkAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const userName = session.user.user_metadata?.name
        if (userName) {
          setUser({ id: session.user.id, name: userName })
        }
        setLoadingAuth(false)
      } else {
        setUser(null)
        setLoadingAuth(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    router.refresh()
  }

  const handleJoinWithCode = () => {
    if (!joinCode.trim()) return
    const code = joinCode.trim().toUpperCase()
    router.push(`/join/${code}`)
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-20 right-10 w-96 h-96 bg-accent-foreground/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
      </div>

      {/* Auth buttons - top right */}
      <div className="absolute top-4 right-4 flex gap-2 z-10">
        {loadingAuth ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : user ? (
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/profile">
                <User className="h-4 w-4 mr-2" />
                {user.name}
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/auth/login">
                <User className="h-4 w-4 mr-2" />
                Login
              </Link>
            </Button>
            <Button variant="default" size="sm" asChild className="bg-primary hover:bg-primary/90">
              <Link href="/auth/signup">Sign Up</Link>
            </Button>
          </>
        )}
      </div>

      <div className="w-full max-w-md space-y-8 relative z-10">
        {/* Header with enhanced branding */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Zap
              className="h-16 w-16 text-primary animate-float drop-shadow-lg"
              strokeWidth={2.5}
              fill="currentColor"
            />
          </div>
          <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent">
            Parego
          </h1>
          <p className="text-xl font-semibold text-primary tracking-wide">Pair. Play. Go.</p>
          <p className="text-sm text-muted-foreground">Over-the-board tournament pairing made simple</p>
        </div>

        {/* Main action buttons with enhanced styling */}
        <div className="space-y-4">
          {/* Join with Code */}
          <Card className="overflow-hidden border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-lg">
            <CardContent className="p-0">
              {showCodeInput ? (
                <div className="p-4 space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter tournament code"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleJoinWithCode()
                        if (e.key === "Escape") {
                          setShowCodeInput(false)
                          setJoinCode("")
                        }
                      }}
                      className="text-center text-lg font-mono tracking-widest uppercase border-primary/50 focus:border-primary"
                      maxLength={8}
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 bg-transparent"
                      onClick={() => {
                        setShowCodeInput(false)
                        setJoinCode("")
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-primary hover:bg-primary/90"
                      onClick={handleJoinWithCode}
                      disabled={!joinCode.trim()}
                    >
                      Join
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full h-24 text-lg justify-start px-6 hover:bg-primary/5 rounded-none group"
                  onClick={() => setShowCodeInput(true)}
                >
                  <Hash
                    className="h-8 w-8 mr-4 text-primary group-hover:scale-110 transition-transform"
                    strokeWidth={2.5}
                  />
                  <div className="text-left">
                    <div className="font-bold text-lg">Join with Code</div>
                    <div className="text-sm text-muted-foreground font-normal">Enter code or scan QR</div>
                  </div>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Find Nearby */}
          <Card className="overflow-hidden border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-lg">
            <CardContent className="p-0">
              <Button
                variant="ghost"
                className="w-full h-24 text-lg justify-start px-6 hover:bg-primary/5 rounded-none group"
                onClick={() => router.push("/nearby")}
              >
                <MapPin
                  className="h-8 w-8 mr-4 text-primary group-hover:scale-110 transition-transform"
                  strokeWidth={2.5}
                />
                <div className="text-left">
                  <div className="font-bold text-lg">Find Nearby</div>
                  <div className="text-sm text-muted-foreground font-normal">Discover local tournaments</div>
                </div>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Organizer section - only for logged in users */}
        {user && (
          <div className="pt-4 border-t">
            <Button
              variant="outline"
              className="w-full bg-transparent border-2 hover:border-primary hover:bg-primary/5 font-semibold"
              onClick={() => router.push("/create")}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Tournament
            </Button>
          </div>
        )}

        {/* Not logged in - show sign up prompt */}
        {!loadingAuth && !user && (
          <div className="text-center pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-3">Track your progress and organize tournaments</p>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="border-2 hover:border-primary hover:bg-primary/5 bg-transparent"
            >
              <Link href="/auth/signup">Sign Up</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}
