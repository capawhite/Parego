"use client"

import { createClient } from "@/lib/supabase/client"

const BUCKET = "avatars"
const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]

export async function uploadAvatar(userId: string, file: File): Promise<{ url: string } | { error: string }> {
  if (file.size > MAX_SIZE_BYTES) {
    return { error: "Image must be under 2MB" }
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: "Please use a JPEG, PNG, or WebP image" }
  }

  const supabase = createClient()
  const ext = file.name.replace(/^.*\./, "") || "webp"
  const path = `${userId}/avatar.${ext}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  })

  if (uploadError) {
    return { error: uploadError.message }
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: publicUrl }
}

export async function updateProfileAvatarUrl(userId: string, avatarUrl: string | null): Promise<{ error?: string }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("users")
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq("id", userId)
  return error ? { error: error.message } : {}
}

export async function removeAvatar(userId: string): Promise<{ error?: string }> {
  const supabase = createClient()
  const { error: deleteError } = await supabase.storage.from(BUCKET).remove([`${userId}/avatar.webp`, `${userId}/avatar.jpg`, `${userId}/avatar.png`])
  if (deleteError) {
    // Continue to clear profile even if file delete fails (e.g. no file)
  }
  return updateProfileAvatarUrl(userId, null)
}
