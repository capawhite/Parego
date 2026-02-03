import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Trophy, Home } from "lucide-react"
import Link from "next/link"

export default function TournamentNotFound() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Trophy className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Tournament Not Found</h1>
            <p className="text-muted-foreground mt-2">
              The tournament you're looking for doesn't exist or has been removed.
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Link href="/">
              <Button className="w-full">
                <Home className="h-4 w-4 mr-2" />
                Go to Homepage
              </Button>
            </Link>
            <Link href="/nearby">
              <Button variant="outline" className="w-full">
                Find Nearby Tournaments
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
