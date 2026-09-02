"use client"

import { useMemo } from "react"
import { SearchableSelect } from "@/components/searchable-select"
import { FIDE_FEDERATIONS, federationLabel } from "@/lib/fide/federations"
import { useI18n } from "@/components/i18n-provider"
import { cn } from "@/lib/utils"

type FederationSelectProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  id?: string
}

export function FederationSelect({ value, onChange, disabled, className, id }: FederationSelectProps) {
  const { t } = useI18n()

  const options = useMemo(
    () =>
      FIDE_FEDERATIONS.map((f) => ({
        value: f.code,
        label: `${f.code} — ${f.name}`,
      })),
    [],
  )

  return (
    <div className={cn("space-y-1.5", className)}>
      <SearchableSelect
        id={id}
        value={value}
        onChange={onChange}
        options={options}
        placeholder={t("profile.federationPlaceholder")}
        disabled={disabled}
        emptyMessage={t("profile.federationNoResults")}
      />
      {value && !options.some((o) => o.value === value) && (
        <p className="text-xs text-muted-foreground">{federationLabel(value)}</p>
      )}
      <p className="text-xs text-muted-foreground">{t("profile.federationHint")}</p>
    </div>
  )
}
