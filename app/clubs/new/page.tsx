"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { createClub } from "@/lib/database/club-db"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export default function CreateClubPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [city, setCity] = useState("")
  const [country, setCountry] = useState("")
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/auth/login")
        return
      }
      setReady(true)
    })
  }, [router])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    const result = await createClub({
      name: name.trim(),
      description: description.trim() || undefined,
      city: city.trim() || undefined,
      country: country.trim() || undefined,
    })
    setBusy(false)
    if (!result.ok || !result.club) {
      toast.error(result.error || t("common.errorGeneric"))
      return
    }
    toast.success(t("clubs.createdToast"))
    router.push(`/club/${result.club.slug}`)
  }

  if (!ready) {
    return (
      <main className="min-h-svh flex items-center justify-center text-muted-foreground">
        {t("common.loading")}
      </main>
    )
  }

  return (
    <main className="min-h-svh bg-background p-4 sm:p-6">
      <form onSubmit={onSubmit} className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" asChild>
            <Link href="/clubs">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">{t("clubs.createTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("clubs.createSubtitle")}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="club-name">{t("clubs.nameLabel")}</Label>
          <Input
            id="club-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("clubs.namePlaceholder")}
            required
            minLength={2}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="club-desc">{t("clubs.descriptionLabel")}</Label>
          <textarea
            id="club-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("clubs.descriptionPlaceholder")}
            rows={3}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="club-city">{t("clubs.cityLabel")}</Label>
            <Input id="club-city" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="club-country">{t("clubs.countryLabel")}</Label>
            <Input id="club-country" value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={busy || name.trim().length < 2}>
          {busy ? t("common.loading") : t("clubs.createSubmit")}
        </Button>
      </form>
    </main>
  )
}
