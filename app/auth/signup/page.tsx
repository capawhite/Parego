"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { signUp } from "./actions"

export default function SignUpPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [rating, setRating] = useState("")
  const [country, setCountry] = useState("")
  const [city, setCity] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isDetectingLocation, setIsDetectingLocation] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const detectLocation = async () => {
      try {
        console.log("[v0] Detecting user location...")
        const response = await fetch("https://ipapi.co/json/")
        const data = await response.json()

        console.log("[v0] Location detected:", data)

        if (data.country_name) {
          setCountry(data.country_name)
        }
        if (data.city) {
          setCity(data.city)
        }
      } catch (error) {
        console.log("[v0] Location detection failed, using manual entry", error)
      } finally {
        setIsDetectingLocation(false)
      }
    }

    detectLocation()
  }, [])

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (!email.trim()) {
      setError("Email is required to create an account")
      setIsLoading(false)
      return
    }

    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters")
      setIsLoading(false)
      return
    }

    const result = await signUp({
      email: email.trim(),
      password: password,
      name,
      rating: rating ? Number.parseInt(rating) : undefined,
      country: country || undefined,
      city: city || undefined,
    })

    if (result.error) {
      setError(result.error)
      setIsLoading(false)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } else {
      setSuccess(true)
      setIsLoading(false)
      setTimeout(() => {
        router.push("/auth/login")
      }, 2000)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Account created!</CardTitle>
              <CardDescription>Your account has been successfully created</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Redirecting you to login...</p>
              <Button onClick={() => router.push("/auth/login")} className="w-full">
                Go to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Sign up</CardTitle>
            <CardDescription>Create your tournament account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignUp}>
              <div className="flex flex-col gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Your name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email *</Label>
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
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    minLength={6}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rating">
                    Rating <span className="text-xs text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="rating"
                    type="number"
                    placeholder="1500"
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="country">
                    Country <span className="text-xs text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="country"
                    type="text"
                    placeholder={isDetectingLocation ? "Detecting..." : "USA"}
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    disabled={isDetectingLocation}
                  />
                  {country && !isDetectingLocation && (
                    <p className="text-xs text-muted-foreground">Auto-detected. You can change this.</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="city">
                    City <span className="text-xs text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="city"
                    type="text"
                    placeholder={isDetectingLocation ? "Detecting..." : "New York"}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={isDetectingLocation}
                  />
                  {city && !isDetectingLocation && (
                    <p className="text-xs text-muted-foreground">Auto-detected. You can change this.</p>
                  )}
                </div>
                {error && (
                  <div className="rounded-md bg-red-50 p-3 border border-red-200">
                    <p className="text-sm text-red-600">{error}</p>
                    {error.includes("already registered") && (
                      <Link
                        href="/auth/login"
                        className="text-sm text-red-700 underline underline-offset-4 mt-2 inline-block font-medium"
                      >
                        Go to Login →
                      </Link>
                    )}
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Creating account..." : "Sign up"}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm">
                Already have an account?{" "}
                <Link href="/auth/login" className="underline underline-offset-4">
                  Login
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
