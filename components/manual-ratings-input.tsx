"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useI18n } from "@/components/i18n-provider"
import type { FideRatingField } from "@/lib/fide/rating"
import { cn } from "@/lib/utils"

export type ManualRatingsState = {
  standard: string
  rapid: string
  blitz: string
}

type ManualRatingsInputProps = {
  value: ManualRatingsState
  onChange: (next: ManualRatingsState) => void
  /** When set, only these fields are shown (e.g. gaps on a linked FIDE profile). */
  visibleFields?: FideRatingField[]
  disabled?: boolean
  className?: string
}

function sanitizeRatingInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 4)
}

export function ManualRatingsInput({
  value,
  onChange,
  visibleFields,
  disabled = false,
  className,
}: ManualRatingsInputProps) {
  const { t } = useI18n()

  const allFields: { key: FideRatingField; label: string; id: string }[] = [
    { key: "standard", label: t("profile.classicalRatingLabel"), id: "rating-classical" },
    { key: "rapid", label: t("profile.rapidRatingLabel"), id: "rating-rapid" },
    { key: "blitz", label: t("profile.blitzRatingLabel"), id: "rating-blitz" },
  ]

  const fields = visibleFields ? allFields.filter((f) => visibleFields.includes(f.key)) : allFields
  const isPartial = visibleFields != null && visibleFields.length < 3
  const hint = isPartial ? t("profile.ratingsMissingFideHint") : t("profile.ratingsHint")

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          "grid gap-3",
          fields.length === 1 ? "grid-cols-1" : fields.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3",
        )}
      >
        {fields.map(({ key, label, id }) => (
          <div key={key} className="grid gap-1.5">
            <Label htmlFor={id} className="text-xs font-medium">
              {label}
            </Label>
            <Input
              id={id}
              type="number"
              inputMode="numeric"
              placeholder={t("profile.ratingPlaceholder")}
              min={100}
              max={3000}
              value={value[key]}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  ...value,
                  [key]: sanitizeRatingInput(e.target.value),
                })
              }
              className="h-11"
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}
