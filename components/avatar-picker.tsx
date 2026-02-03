"use client"

import * as React from "react"
import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Camera, ImagePlus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"

const MAX_SIZE_PX = 512
const MAX_FILE_BYTES = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]

/** Posterize levels (fewer = more cartoon/avatar-like, less recognizable). */
const POSTERIZE_LEVELS = 5
/** Light blur radius for smoother avatar look. */
const SMOOTH_RADIUS = 1

export interface AvatarPickerProps {
  /** Current avatar URL (from profile). */
  value?: string | null
  /** Callback when user selects a new image (File). Caller uploads and sets URL. */
  onSelect?: (file: File) => void
  /** Callback when user clears the avatar. */
  onClear?: () => void
  /** Optional selected file not yet uploaded (for preview during signup). */
  selectedFile?: File | null
  /** Disabled state. */
  disabled?: boolean
  /** Size of the avatar circle. */
  size?: "sm" | "md" | "lg"
  /** If true, apply stylize (posterize + smooth) so the avatar is less photo-like; good for privacy. */
  stylizeForPrivacy?: boolean
  className?: string
}

/** Posterize: reduce each channel to N levels for a more illustrated look. */
function posterize(data: ImageData, levels: number): void {
  const lut = new Uint8Array(256)
  const step = 255 / (levels - 1)
  for (let i = 0; i < 256; i++) lut[i] = Math.round(i / step) * step
  const d = data.data
  for (let i = 0; i < d.length; i += 4) {
    d[i] = lut[d[i]]
    d[i + 1] = lut[d[i + 1]]
    d[i + 2] = lut[d[i + 2]]
  }
}

/** Simple box blur on ImageData (radius 1 = 3x3). */
function boxBlur(data: ImageData, w: number, h: number, radius: number): void {
  if (radius < 1) return
  const d = data.data
  const out = new Uint8ClampedArray(d.length)
  const size = (radius * 2 + 1) ** 2
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = Math.max(0, Math.min(h - 1, y + dy))
          const nx = Math.max(0, Math.min(w - 1, x + dx))
          const i = (ny * w + nx) * 4
          r += d[i]; g += d[i + 1]; b += d[i + 2]; a += d[i + 3]; n++
        }
      }
      const o = (y * w + x) * 4
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = a / n
    }
  }
  for (let i = 0; i < d.length; i++) d[i] = out[i]
}

/** Resize image, optionally apply stylize (posterize + smooth) for avatar/privacy. */
async function processImage(file: File, stylize: boolean): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = document.createElement("img")
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const w = img.naturalWidth
      const h = img.naturalHeight
      let width = w
      let height = h
      if (width > MAX_SIZE_PX || height > MAX_SIZE_PX) {
        if (width > height) {
          height = Math.round((height * MAX_SIZE_PX) / width)
          width = MAX_SIZE_PX
        } else {
          width = Math.round((width * MAX_SIZE_PX) / height)
          height = MAX_SIZE_PX
        }
      }
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        resolve(file)
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      if (stylize) {
        const imageData = ctx.getImageData(0, 0, width, height)
        posterize(imageData, POSTERIZE_LEVELS)
        boxBlur(imageData, width, height, SMOOTH_RADIUS)
        ctx.putImageData(imageData, 0, 0)
      }
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
            return
          }
          const out = new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), {
            type: "image/webp",
            lastModified: Date.now(),
          })
          resolve(out)
        },
        "image/webp",
        0.88,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Failed to load image"))
    }
    img.src = url
  })
}

export function AvatarPicker({
  value,
  onSelect,
  onClear,
  selectedFile,
  disabled,
  size = "lg",
  stylizeForPrivacy = true,
  className,
}: AvatarPickerProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const [objectUrl, setObjectUrl] = React.useState<string | null>(null)
  const [stylize, setStylize] = React.useState(stylizeForPrivacy)

  React.useEffect(() => {
    if (selectedFile != null) {
      const url = URL.createObjectURL(selectedFile)
      setObjectUrl(url)
      return () => {
        URL.revokeObjectURL(url)
        setObjectUrl(null)
      }
    }
    setObjectUrl(null)
    return undefined
  }, [selectedFile])

  const previewUrl = objectUrl ?? (value && !selectedFile ? value : null)

  const sizeClasses = {
    sm: "size-16",
    md: "size-24",
    lg: "size-28",
  }

  const handleFile = async (file: File | null) => {
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      onSelect?.(file) // still pass through; server/upload can reject
      return
    }
    try {
      const processed = await processImage(file, stylize)
      onSelect?.(processed)
    } catch {
      onSelect?.(file)
    }
  }

  const handleCameraClick = () => {
    cameraInputRef.current?.click()
  }

  const handleGalleryClick = () => {
    galleryInputRef.current?.click()
  }

  const hasImage = !!previewUrl || (selectedFile != null && selectedFile !== undefined)

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="sr-only"
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ""
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ""
        }}
      />

      <Avatar
        className={cn(
          sizeClasses[size],
          "ring-2 ring-muted",
        )}
      >
        {previewUrl ? (
          <AvatarImage src={previewUrl} alt="Your avatar" />
        ) : (
          <AvatarFallback className="text-muted-foreground">?</AvatarFallback>
        )}
      </Avatar>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={handleCameraClick}
          className="gap-2"
        >
          <Camera className="h-4 w-4" />
          Take photo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={handleGalleryClick}
          className="gap-2"
        >
          <ImagePlus className="h-4 w-4" />
          Choose photo
        </Button>
        {hasImage && onClear && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={onClear}
            className="gap-2 text-muted-foreground"
          >
            <X className="h-4 w-4" />
            Remove
          </Button>
        )}
      </div>
      <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground max-w-[280px]">
        <Checkbox
          checked={stylize}
          onCheckedChange={(v) => setStylize(v === true)}
          disabled={disabled}
        />
        <span>Avatar-style (recommended for privacy — makes the photo less recognizable)</span>
      </label>
      <p className="text-xs text-muted-foreground text-center max-w-[260px]">
        Optional. Use camera or pick from your photos. We’ll resize and optionally stylize for your profile.
      </p>
    </div>
  )
}
