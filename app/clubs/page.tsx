"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Loader2, Plus, Search, Users } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { listFollowedClubs, searchClubs, type Club } from "@/lib/database/club-db"
import { createClient } from "@/lib/supabase/client"

export default function ClubsIndexPage() {
  const { t } = useI18n()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Club[]>([])
  const [followed, setFollowed] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!cancelled) setSignedIn(Boolean(user))
      const [all, fol] = await Promise.all([
        searchClubs("", 30),
        user ? listFollowedClubs(20) : Promise.resolve([]),
      ])
      if (cancelled) return
      setResults(all)
      setFollowed(fol)
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const handle = setTimeout(() => {
      void (async () => {
        setSearching(true)
        const data = await searchClubs(query, 30)
        setResults(data)
        setSearching(false)
      })()
    }, 250)
    return () => clearTimeout(handle)
  }, [query])

  return (
    <main className="min-h-svh bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Button variant="ghost" size="sm" className="-ml-2" asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t("common.back")}
              </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">{t("clubs.title")}</h1>
            <p className="text-sm text-muted-foreground max-w-prose">{t("clubs.subtitle")}</p>
          </div>
          {signedIn && (
            <Button asChild className="shrink-0">
              <Link href="/clubs/new">
                <Plus className="h-4 w-4 mr-2" />
                {t("clubs.create")}
              </Link>
            </Button>
          )}
        </div>

        {followed.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{t("clubs.followingTitle")}</h2>
            <ul className="space-y-2">
              {followed.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/club/${c.slug}`}
                    className="flex items-center gap-3 rounded-lg border px-4 py-3 hover:border-primary/40 transition-colors"
                  >
                    <Users className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{c.name}</p>
                      {(c.city || c.country) && (
                        <p className="text-xs text-muted-foreground truncate">
                          {[c.city, c.country].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t("clubs.browseTitle")}</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t("clubs.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {loading || searching ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("clubs.empty")}</p>
          ) : (
            <ul className="space-y-2">
              {results.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/club/${c.slug}`}
                    className="flex items-center gap-3 rounded-lg border px-4 py-3 hover:border-primary/40 transition-colors"
                  >
                    <Users className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{c.name}</p>
                      {(c.city || c.country) && (
                        <p className="text-xs text-muted-foreground truncate">
                          {[c.city, c.country].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
