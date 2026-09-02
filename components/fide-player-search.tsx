"use client"

import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, X, Trophy } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import type { FidePlayer, FideRatings } from "@/lib/fide/types"
import { extractFideRatings, formatFideRatingsSummary, pickFideRating } from "@/lib/fide/rating"
import { FideRatingsDisplay } from "@/components/fide-ratings-display"
import { cn } from "@/lib/utils"

export type { FideRatings }

export type FidePlayerSelection = {
  fideId: number
  fideTitle: string | null
  name: string
  federation: string | null
  ratings: FideRatings
  /** Default pairing rating (standard preferred). */
  rating: number | null
}

interface FidePlayerSearchProps {
  onSelect: (player: FidePlayerSelection) => void
  onClear?: () => void
  selected?: FidePlayerSelection | null
  className?: string
  disabled?: boolean
  /** Larger linked-player card with rating stats (profile page). */
  variant?: "default" | "prominent"
  /** Merged ratings for display (e.g. FIDE rapid/blitz + self-reported classical). */
  displayRatings?: FideRatings
}

function toSelection(player: FidePlayer): FidePlayerSelection {
  const ratings = extractFideRatings(player)
  return {
    fideId: player.id,
    fideTitle: player.title,
    name: player.name,
    federation: player.federation,
    ratings,
    rating: pickFideRating(player),
  }
}

export function FidePlayerSearch({
  onSelect,
  onClear,
  selected,
  className,
  disabled = false,
  variant = "default",
  displayRatings,
}: FidePlayerSearchProps) {
  const { t } = useI18n()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<FidePlayer[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (disabled || selected) {
      setResults([])
      return
    }

    const search = async () => {
      if (query.length < 2) {
        setResults([])
        setSearchError(null)
        return
      }

      setIsSearching(true)
      setSearchError(null)
      try {
        const response = await fetch(`/api/fide/search?q=${encodeURIComponent(query)}`)
        const data = await response.json()
        if (!response.ok) {
          setResults([])
          setSearchError(data.error ?? t("fide.searchError"))
          return
        }
        setResults(data.players ?? [])
        setShowResults(true)
      } catch {
        setResults([])
        setSearchError(t("fide.searchError"))
      } finally {
        setIsSearching(false)
      }
    }

    const debounce = setTimeout(search, 300)
    return () => clearTimeout(debounce)
  }, [query, disabled, selected, t])

  const handleSelect = (player: FidePlayer) => {
    onSelect(toSelection(player))
    setQuery("")
    setResults([])
    setShowResults(false)
  }

  if (selected) {
    if (variant === "prominent") {
      return (
        <div className={cn("space-y-2", className)}>
          <FideRatingsDisplay
            name={selected.name}
            fideId={selected.fideId}
            fideTitle={selected.fideTitle}
            federation={selected.federation}
            ratings={displayRatings ?? selected.ratings}
          />
          {onClear && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={onClear}
              disabled={disabled}
            >
              {t("fide.unlink")}
            </Button>
          )}
        </div>
      )
    }

    return (
      <div className={cn("rounded-lg border bg-muted/40 p-3", className)}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Trophy className="h-4 w-4 text-primary shrink-0" />
              <span className="font-medium text-sm truncate">{selected.name}</span>
              {selected.fideTitle && (
                <Badge variant="secondary" className="text-xs">
                  {selected.fideTitle}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("fide.linkedSummary", {
                id: selected.fideId,
                federation: selected.federation ?? "—",
                ratings: formatFideRatingsSummary(displayRatings ?? selected.ratings, {
                  standard: t("fide.classicalShort"),
                  rapid: t("fide.rapidShort"),
                  blitz: t("fide.blitzShort"),
                }),
              })}
            </p>
          </div>
          {onClear && (
            <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0" onClick={onClear} disabled={disabled}>
              {t("fide.unlink")}
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div ref={searchRef} className={cn("space-y-2 relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder={t("fide.searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          disabled={disabled}
          className="pl-9 pr-9"
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            onClick={() => {
              setQuery("")
              setResults([])
              setShowResults(false)
              setSearchError(null)
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {searchError && <p className="text-xs text-destructive">{searchError}</p>}

      {showResults && results.length > 0 && (
        <Card className="absolute z-50 w-full max-w-md mt-1 p-2 max-h-64 overflow-y-auto shadow-lg">
          <div className="space-y-1">
            {results.map((player) => {
              const ratings = extractFideRatings(player)
              const ratingsLine = formatFideRatingsSummary(ratings, {
                standard: t("fide.classicalShort"),
                rapid: t("fide.rapidShort"),
                blitz: t("fide.blitzShort"),
              })
              return (
                <Button
                  key={player.id}
                  type="button"
                  variant="ghost"
                  className="w-full justify-start h-auto py-2 px-3"
                  onClick={() => handleSelect(player)}
                >
                  <div className="text-left w-full min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{player.name}</span>
                      {player.title && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {player.title}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("fide.resultLine", {
                        federation: player.federation ?? "—",
                        ratings: ratingsLine,
                        id: player.id,
                      })}
                    </p>
                  </div>
                </Button>
              )
            })}
          </div>
        </Card>
      )}

      {showResults && query.length >= 2 && results.length === 0 && !isSearching && !searchError && (
        <p className="text-xs text-muted-foreground">{t("fide.noResults")}</p>
      )}
    </div>
  )
}
