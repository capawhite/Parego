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

export type ConversionTrigger = "repeat_play" | "result_rankings" | "rated_game"

const TRIGGER_MESSAGES: Record<ConversionTrigger, { title: string; description: string }> = {
  repeat_play: {
    title: "You've played here before",
    description: "Create an account to save your history and ratings.",
  },
  result_rankings: {
    title: "This result affects rankings",
    description: "Create an account to keep your record.",
  },
  rated_game: {
    title: "You're about to play a rated game",
    description: "Create an account to track your rating.",
  },
}

interface ConversionPromptProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  triggerKey: ConversionTrigger
}

export function ConversionPrompt({ open, onOpenChange, triggerKey }: ConversionPromptProps) {
  const { title, description } = TRIGGER_MESSAGES[triggerKey]

  const handleMaybeLater = () => {
    setConversionPromptDismissed(triggerKey)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleMaybeLater}>
            Maybe later
          </Button>
          <Button asChild>
            <Link href="/auth/signup" onClick={handleMaybeLater}>
              Create account
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
