"use server"

import { createClient } from "@/lib/supabase/server"
import { geocodeLocation } from "@/lib/geocode"

/** Check if email is available for signup (call when user enters email). */
export async function checkEmailAvailable(email: string): Promise<{ available: boolean; error?: string }> {
  const trimmed = email?.trim()
  if (!trimmed) return { available: false }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("check_email_available", { p_email: trimmed })
  if (error) return { available: false, error: error.message }
  return { available: data === true }
}

export async function signUp(formData: {
  email: string
  password: string
  name: string
  ratingBand?: string
  rating?: number
  country?: string
  city?: string
}) {
  if (process.env.NODE_ENV === "development") console.log("[v0] Server: Starting signup process...")

  const supabase = await createClient()

  const { email, password, name, ratingBand, rating, country, city } = formData

  if (process.env.NODE_ENV === "development") console.log("[v0] Server: Signing up with email:", email)

  const { latitude, longitude } = await geocodeLocation(city, country)
  if (process.env.NODE_ENV === "development")
    console.log("[v0] Server: Geocoded coordinates:", { latitude, longitude })

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: email,
    password: password,
    options: {
      emailRedirectTo:
        process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}`,
      data: {
        name,
        rating: rating ?? null,
        country: country || null,
        city: city || null,
        latitude,
        longitude,
        email: email,
      },
    },
  })

  if (authError || !authData.user) {
    console.error("[v0] Server: Auth signup error:", authError)
    if (authError?.message?.includes("User already registered") || authError?.message?.includes("already exists")) {
      return {
        error: "This email is already registered. Please log in or use a different email.",
        code: "user_already_exists",
      }
    }
    return { error: authError?.message || "Failed to create account" }
  }

  if (process.env.NODE_ENV === "development")
    console.log("[v0] Server: Auth signup successful, user ID:", authData.user.id)

  // Wait a moment for the trigger to complete
  await new Promise((resolve) => setTimeout(resolve, 500))

  const { error: updateError } = await supabase
    .from("users")
    .update({
      latitude,
      longitude,
      rating_band: ratingBand || null,
      rating: rating ?? null,
    })
    .eq("id", authData.user.id)

  if (updateError) {
    console.error("[v0] Server: Failed to update coordinates:", updateError)
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id")
    .eq("id", authData.user.id)
    .single()

  if (profileError || !profile) {
    console.error("[v0] Server: Profile verification failed:", profileError)
    return { error: "Profile creation failed. Please try logging in or contact support." }
  }

  if (process.env.NODE_ENV === "development")
    console.log("[v0] Server: Profile created successfully with coordinates")

  return { success: true, userId: authData.user.id }
}
