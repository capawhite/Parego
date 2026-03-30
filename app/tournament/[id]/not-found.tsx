"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Trophy, Home } from "lucide-react"
import Link from "next/link"
import { useI18n } from "@/components/i18n-provider"

export default function TournamentNotFound() {
  const { t } = useI18n()

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Trophy className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("notFound.title")}</h1>
            <p className="text-muted-foreground mt-2">{t("notFound.description")}</p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Link href="/">
              <Button className="w-full">
                <Home className="h-4 w-4 mr-2" />
                {t("notFound.goHome")}
              </Button>
            </Link>
            <Link href="/nearby">
              <Button variant="outline" className="w-full">
                {t("notFound.findNearby")}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
