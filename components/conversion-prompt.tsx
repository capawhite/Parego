"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { setConversionPromptDismissed } from "@/lib/guest-session-history"
import { useI18n } from "@/components/i18n-provider"

export type ConversionTrigger = "repeat_play" | "result_rankings" | "rated_game"

interface ConversionPromptProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  triggerKey: ConversionTrigger
}

export function ConversionPrompt({ open, onOpenChange, triggerKey }: ConversionPromptProps) {
  const { t } = useI18n()

  const titleKey =
    triggerKey === "repeat_play"
      ? "conversionPrompt.repeat_play_title"
      : triggerKey === "result_rankings"
        ? "conversionPrompt.result_rankings_title"
        : "conversionPrompt.rated_game_title"

  const descriptionKey =
    triggerKey === "repeat_play"
      ? "conversionPrompt.repeat_play_description"
      : triggerKey === "result_rankings"
        ? "conversionPrompt.result_rankings_description"
        : "conversionPrompt.rated_game_description"

  const handleMaybeLater = () => {
    setConversionPromptDismissed(triggerKey)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(titleKey)}</DialogTitle>
          <DialogDescription>{t(descriptionKey)}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleMaybeLater}>
            {t("conversionPrompt.maybeLater")}
          </Button>
          <Button asChild>
            <Link href="/auth/signup" onClick={handleMaybeLater}>
              {t("conversionPrompt.createAccount")}
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
