import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Service-role (or anon fallback in non-production) client for privileged writes.
 * Prefer this over inlining createClient in each route.
 */
export function createAdminClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!supabaseUrl) return null

  const isProduction = process.env.NODE_ENV === "production"
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (isProduction && !serviceRole) return null

  const adminKey = serviceRole || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!adminKey) return null

  return createClient(supabaseUrl, adminKey)
}

export function adminClientMissingReason(): string {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    return "NEXT_PUBLIC_SUPABASE_URL is missing"
  }
  if (process.env.NODE_ENV === "production" && !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return "SUPABASE_SERVICE_ROLE_KEY is required in production"
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    return "No Supabase API key available"
  }
  return "Admin client unavailable"
}
