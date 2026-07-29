"use client"

import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { generateQRCode } from "@/lib/qr-utils"
import { useI18n } from "@/components/i18n-provider"
import { toast } from "sonner"
import { Share2 } from "lucide-react"

interface TournamentShareDialogProps {
  tournamentId: string
  tournamentName: string
  /** Compact header trigger */
  triggerClassName?: string
}

export function TournamentShareDialog({
  tournamentId,
  tournamentName,
  triggerClassName,
}: TournamentShareDialogProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [canNativeShare, setCanNativeShare] = useState(false)

  useEffect(() => {
    setCanNativeShare(typeof navigator.share === "function")
  }, [])

  const joinUrl = useMemo(() => {
    if (typeof window === "undefined") return ""
    return `${window.location.origin}/j/${tournamentId}`
  }, [tournamentId])

  const qrSrc = joinUrl ? generateQRCode(joinUrl) : ""

  const handleCopy = async () => {
    if (!joinUrl) return
    try {
      await navigator.clipboard.writeText(joinUrl)
      toast.success(t("common.linkCopied"))
    } catch {
      toast.error(t("common.linkCopied"))
    }
  }

  const handleNativeShare = async () => {
    if (!joinUrl || typeof navigator.share !== "function") return
    try {
      await navigator.share({
        title: tournamentName,
        text: t("qrShare.shareText", { tournament: tournamentName }),
        url: joinUrl,
      })
    } catch {
      // User cancelled or share unavailable — ignore
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" className={triggerClassName ?? "shrink-0 h-9 gap-1.5"}>
          <Share2 className="h-4 w-4" />
          <span className="hidden sm:inline">{t("qrShare.shareButton")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("qrShare.title")}</DialogTitle>
          <DialogDescription>{t("qrShare.description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <div className="bg-white p-2 rounded-lg border border-border">
            {qrSrc ? (
              <Image
                src={qrSrc}
                alt={t("qrShare.qrAlt")}
                width={200}
                height={200}
                className="h-[200px] w-[200px]"
                unoptimized
              />
            ) : (
              <div className="h-[200px] w-[200px] animate-pulse rounded bg-muted" aria-hidden />
            )}
          </div>
          <div className="w-full space-y-1.5">
            <p className="text-xs text-muted-foreground">{t("qrShare.tournamentCode")}</p>
            <p className="font-mono font-semibold text-sm tracking-wide">{tournamentId}</p>
          </div>
          <div className="flex w-full gap-2">
            <Input value={joinUrl} readOnly className="font-mono text-xs h-9" />
            <Button type="button" variant="outline" className="shrink-0 h-9" onClick={() => void handleCopy()}>
              {t("arena.copy")}
            </Button>
          </div>
          {canNativeShare && (
            <Button type="button" className="w-full" onClick={() => void handleNativeShare()}>
              {t("qrShare.shareVia")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
