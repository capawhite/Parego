"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { QrCode, Copy, Check, Share2 } from "lucide-react"
import { useState } from "react"
import { generateQRCode } from "@/lib/qr-utils"

interface QRShareDialogProps {
  tournamentId: string
  tournamentName: string
}

export function QRShareDialog({ tournamentId, tournamentName }: QRShareDialogProps) {
  const [copied, setCopied] = useState(false)

  const joinUrl =
    typeof window !== "undefined" ? `${window.location.origin}/join/${tournamentId}` : `/join/${tournamentId}`

  const qrCodeUrl = generateQRCode(joinUrl)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: tournamentName,
          text: `Join ${tournamentName} chess tournament!`,
          url: joinUrl,
        })
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Share failed:", err)
        }
      }
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="bg-transparent">
          <QrCode className="h-4 w-4 mr-2" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Tournament</DialogTitle>
          <DialogDescription>Let players join by scanning the QR code or using the link below.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {/* QR Code */}
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <img src={qrCodeUrl || "/placeholder.svg"} alt="Tournament QR Code" className="w-48 h-48" />
          </div>

          {/* Tournament Code */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Tournament Code</p>
            <p className="text-3xl font-mono font-bold tracking-widest">{tournamentId}</p>
          </div>

          {/* Link and actions */}
          <div className="w-full space-y-2">
            <div className="flex gap-2">
              <div className="flex-1 p-2 bg-muted rounded text-sm font-mono truncate">{joinUrl}</div>
              <Button variant="outline" size="icon" onClick={handleCopy} className="bg-transparent flex-shrink-0">
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            {typeof navigator !== "undefined" && navigator.share && (
              <Button variant="outline" className="w-full bg-transparent" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" />
                Share via...
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
