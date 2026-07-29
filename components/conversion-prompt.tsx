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

export type ConversionTrigger = "repeat_play" | "result_rankings" | "rated_game" | "end_event"

interface ConversionPromptProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  triggerKey: ConversionTrigger
  /** When true, secondary dismiss is de-emphasized (end of event). */
  strong?: boolean
}

export function ConversionPrompt({ open, onOpenChange, triggerKey, strong = false }: ConversionPromptProps) {
  const { t } = useI18n()

  const titleKey = `conversionPrompt.${triggerKey}_title`
  const descriptionKey = `conversionPrompt.${triggerKey}_description`
  const signupHref = `/auth/signup?from=conversion&skipRating=1`

  const handleMaybeLater = () => {
    setConversionPromptDismissed(triggerKey)
    onOpenChange(false)
  }

  const isStrong = strong || triggerKey === "end_event"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md" onPointerDownOutside={(e) => {
        if (isStrong) e.preventDefault()
      }} onEscapeKeyDown={(e) => {
        if (isStrong) e.preventDefault()
      }}>
        <DialogHeader>
          <DialogTitle>{t(titleKey)}</DialogTitle>
          <DialogDescription>{t(descriptionKey)}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button asChild className="w-full">
            <Link href={signupHref} onClick={handleMaybeLater}>
              {t("conversionPrompt.createAccount")}
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/auth/login?from=conversion" onClick={handleMaybeLater}>
              {t("conversionPrompt.signIn")}
            </Link>
          </Button>
          <Button
            variant="ghost"
            className={`w-full ${isStrong ? "text-muted-foreground" : ""}`}
            onClick={handleMaybeLater}
          >
            {isStrong ? t("conversionPrompt.continueWithoutSaving") : t("conversionPrompt.maybeLater")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
