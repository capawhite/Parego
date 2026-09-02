"use client"

import { Badge } from "@/components/ui/badge"
import { Trophy } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import type { FideRatings } from "@/lib/fide/types"
import { cn } from "@/lib/utils"

type FideRatingsDisplayProps = {
  name: string
  fideId: number
  fideTitle?: string | null
  federation?: string | null
  ratings: FideRatings
  className?: string
}

function RatingStat({
  label,
  value,
  prominent = false,
}: {
  label: string
  value: number | null
  prominent?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border bg-background px-2 py-2 text-center",
        prominent && "border-primary/30 bg-primary/5 py-3",
      )}
    >
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn("font-semibold tabular-nums", prominent ? "text-xl text-primary" : "text-base")}>
        {value != null ? value : "—"}
      </span>
    </div>
  )
}

export function FideRatingsDisplay({
  name,
  fideId,
  fideTitle,
  federation,
  ratings,
  className,
}: FideRatingsDisplayProps) {
  const { t } = useI18n()

  return (
    <div className={cn("rounded-xl border-2 border-primary/20 bg-primary/5 p-4 space-y-3", className)}>
      <div className="flex items-start gap-2 min-w-0">
        <Trophy className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-base truncate">{name}</span>
            {fideTitle && (
              <Badge variant="secondary" className="text-xs font-semibold">
                {fideTitle}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("fide.linkedMeta", { id: fideId, federation: federation ?? "—" })}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <RatingStat label={t("fide.classicalShort")} value={ratings.standard} prominent />
        <RatingStat label={t("fide.rapidShort")} value={ratings.rapid} prominent />
        <RatingStat label={t("fide.blitzShort")} value={ratings.blitz} prominent />
      </div>
    </div>
  )
}
