"use client"

import { useMemo, useState } from "react"
import { format, addDays, nextSaturday, setHours, setMinutes, startOfDay, isSameDay } from "date-fns"
import { CalendarIcon, Clock, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"

/** Value stored as local `YYYY-MM-DDTHH:mm` (same as former datetime-local). */
function toLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function parseLocalValue(value: string): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => h)
const MINUTE_OPTIONS = [0, 15, 30, 45]

type StartTimePickerProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  id?: string
}

export function StartTimePicker({ value, onChange, disabled, id }: StartTimePickerProps) {
  const { t, locale } = useI18n()
  const [open, setOpen] = useState(false)
  const selected = useMemo(() => parseLocalValue(value), [value])

  const displayLabel = selected
    ? new Intl.DateTimeFormat(locale === "es" ? "es" : locale === "fr" ? "fr" : "en", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(selected)
    : t("create.startTimePick")

  const applyDateKeepingTime = (day: Date) => {
    const base = selected ?? setMinutes(setHours(startOfDay(day), 19), 0)
    const next = setMinutes(
      setHours(startOfDay(day), base.getHours()),
      Math.round(base.getMinutes() / 15) * 15,
    )
    onChange(toLocalValue(next))
  }

  const applyQuick = (day: Date, hour: number, minute = 0) => {
    onChange(toLocalValue(setMinutes(setHours(startOfDay(day), hour), minute)))
    setOpen(false)
  }

  const hour = selected?.getHours() ?? 19
  const minute = selected ? Math.round(selected.getMinutes() / 15) * 15 % 60 : 0

  const setTimePart = (nextHour: number, nextMinute: number) => {
    const day = selected ? startOfDay(selected) : startOfDay(new Date())
    onChange(toLocalValue(setMinutes(setHours(day, nextHour), nextMinute)))
  }

  const today = startOfDay(new Date())
  const tomorrow = addDays(today, 1)
  const weekend = nextSaturday(today)

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal min-h-11",
              !selected && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">{displayLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3 space-y-3" align="start">
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" size="sm" variant="secondary" className="h-8" onClick={() => applyQuick(today, 19)}>
              {t("create.startTimeTodayEve")}
            </Button>
            <Button type="button" size="sm" variant="secondary" className="h-8" onClick={() => applyQuick(tomorrow, 19)}>
              {t("create.startTimeTomorrowEve")}
            </Button>
            <Button type="button" size="sm" variant="secondary" className="h-8" onClick={() => applyQuick(weekend, 15)}>
              {t("create.startTimeWeekend")}
            </Button>
          </div>

          <Calendar
            mode="single"
            selected={selected ?? undefined}
            onSelect={(day) => {
              if (day) applyDateKeepingTime(day)
            }}
            disabled={{ before: today }}
          />

          <div className="flex items-end gap-2 border-t pt-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {t("create.startTimeTimeLabel")}
              </Label>
              <div className="flex gap-2">
                <Select
                  value={String(hour)}
                  onValueChange={(v) => setTimePart(Number(v), minute)}
                  disabled={disabled}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOUR_OPTIONS.map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {String(h).padStart(2, "0")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String(minute)}
                  onValueChange={(v) => setTimePart(hour, Number(v))}
                  disabled={disabled}
                >
                  <SelectTrigger className="w-[88px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MINUTE_OPTIONS.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {String(m).padStart(2, "0")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="button" size="sm" className="shrink-0" onClick={() => setOpen(false)}>
              {t("create.startTimeDone")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {selected && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground truncate">
            {isSameDay(selected, today)
              ? t("create.startTimeSummaryToday", { time: format(selected, "HH:mm") })
              : t("create.startTimeSummary", { when: displayLabel })}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 text-muted-foreground"
            disabled={disabled}
            onClick={() => onChange("")}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            {t("create.startTimeClear")}
          </Button>
        </div>
      )}
    </div>
  )
}
