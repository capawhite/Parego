"use client"

import { useMemo } from "react"
import { SearchableSelect } from "@/components/searchable-select"
import { GEOGRAPHIC_COUNTRIES } from "@/lib/geo/countries"
import { useI18n } from "@/components/i18n-provider"
import { cn } from "@/lib/utils"

type CountrySelectProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  id?: string
}

export function CountrySelect({ value, onChange, disabled, className, id }: CountrySelectProps) {
  const { t } = useI18n()

  const options = useMemo(
    () => GEOGRAPHIC_COUNTRIES.map((name) => ({ value: name, label: name })),
    [],
  )

  return (
    <div className={cn("space-y-1.5", className)}>
      <SearchableSelect
        id={id}
        value={value}
        onChange={onChange}
        options={options}
        placeholder={t("profile.countryPlaceholder")}
        disabled={disabled}
        emptyMessage={t("profile.countryNoResults")}
      />
      <p className="text-xs text-muted-foreground">{t("profile.countryHint")}</p>
    </div>
  )
}
