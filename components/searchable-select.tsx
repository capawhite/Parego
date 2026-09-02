"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Check, ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils"

export type SearchableSelectOption = {
  value: string
  label: string
}

type SearchableSelectProps = {
  value: string
  onChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  emptyMessage?: string
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  className,
  id,
  emptyMessage = "No matches",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const selectedLabel = useMemo(() => {
    if (!value) return null
    return options.find((o) => o.value === value)?.label ?? value
  }, [options, value])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    )
  }, [options, query])

  return (
    <div className={cn("relative", className)}>
      <Button
        type="button"
        id={id}
        variant="outline"
        disabled={disabled}
        className={cn(
          "w-full justify-between h-11 font-normal",
          !selectedLabel && "text-muted-foreground",
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate">{selectedLabel ?? placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {value && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-9 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
          onClick={(e) => {
            e.stopPropagation()
            onChange("")
            setQuery("")
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}

      {open && !disabled && (
        <Card className="absolute z-50 w-full mt-1 p-2 shadow-lg">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="h-9 mb-2"
            autoFocus
          />
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-2">{emptyMessage}</p>
            ) : (
              filtered.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant="ghost"
                  className="w-full justify-start h-auto py-2 px-2 text-sm font-normal"
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                    setQuery("")
                  }}
                >
                  <span className="truncate flex-1 text-left">{option.label}</span>
                  {value === option.value && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </Button>
              ))
            )}
          </div>
        </Card>
      )}

      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 cursor-default"
          aria-label="Close"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  )
}
