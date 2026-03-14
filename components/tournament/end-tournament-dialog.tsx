"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useI18n } from "@/components/i18n-provider"

interface EndTournamentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pendingMatchCount: number
  onEndImmediately: () => void
  onWaitForResults: () => void
  waitingForFinalResults: boolean
}

export function EndTournamentDialog({
  open,
  onOpenChange,
  pendingMatchCount,
  onEndImmediately,
  onWaitForResults,
  waitingForFinalResults,
}: EndTournamentDialogProps) {
  const { t } = useI18n()

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("arena.endTournamentTitle")}</DialogTitle>
            <DialogDescription>
              {pendingMatchCount > 0
                ? t("arena.endTournamentWithPending", { count: pendingMatchCount })
                : t("arena.endTournamentConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button variant="destructive" onClick={onEndImmediately} className="w-full">
              {t("arena.endImmediately")}
            </Button>
            {pendingMatchCount > 0 && (
              <Button variant="default" onClick={onWaitForResults} className="w-full">
                {t("arena.waitForResults")}
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {waitingForFinalResults && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-yellow-500 text-black px-4 py-2 rounded-lg shadow-lg">
          {t("arena.waitingForResultsBanner")}
        </div>
      )}
    </>
  )
}
