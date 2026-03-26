"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Search, X, UserPlus } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"

interface User {
  id: string
  name: string
  rating: number | null
  country: string | null
}

interface UserSearchAutocompleteProps {
  onSelectUser: (user: User) => void
  placeholder?: string
}

export function UserSearchAutocomplete({
  onSelectUser,
  placeholder,
}: UserSearchAutocompleteProps) {
  const { t } = useI18n()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<User[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
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
    const searchUsers = async () => {
      if (query.length < 2) {
        setResults([])
        return
      }

      setIsSearching(true)
      const supabase = createClient()

      const { data, error } = await supabase
        .from("users")
        .select("id, name, rating, country")
        .ilike("name", `%${query}%`)
        .limit(10)

      if (!error && data) {
        setResults(data)
        setShowResults(true)
      }

      setIsSearching(false)
    }

    const debounce = setTimeout(searchUsers, 300)
    return () => clearTimeout(debounce)
  }, [query])

  const handleSelect = (user: User) => {
    onSelectUser(user)
    setQuery("")
    setResults([])
    setShowResults(false)
  }

  return (
    <div ref={searchRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder ?? t("userSearch.placeholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          className="pl-9 pr-9"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            onClick={() => {
              setQuery("")
              setResults([])
              setShowResults(false)
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {showResults && results.length > 0 && (
        <Card className="absolute z-50 w-full mt-1 p-2 max-h-64 overflow-y-auto">
          <div className="space-y-1">
            {results.map((user) => (
              <Button
                key={user.id}
                variant="ghost"
                className="w-full justify-start h-auto py-2 px-3"
                onClick={() => handleSelect(user)}
              >
                <div className="flex items-center gap-2 w-full">
                  <UserPlus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="font-medium text-sm">{user.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      {user.rating && <span>{t("userSearch.rating", { rating: user.rating })}</span>}
                      {user.country && <span>{user.country}</span>}
                    </div>
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </Card>
      )}

      {showResults && query.length >= 2 && results.length === 0 && !isSearching && (
        <Card className="absolute z-50 w-full mt-1 p-3">
          <p className="text-sm text-muted-foreground text-center">{t("userSearch.noUsersFound")}</p>
        </Card>
      )}
    </div>
  )
}
