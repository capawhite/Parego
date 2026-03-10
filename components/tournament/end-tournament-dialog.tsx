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
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End Tournament</DialogTitle>
            <DialogDescription>
              {pendingMatchCount > 0
                ? `There are ${pendingMatchCount} active matches. How would you like to proceed?`
                : "Are you sure you want to end the tournament?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button variant="destructive" onClick={onEndImmediately} className="w-full">
              End Immediately (Ignore Active Matches)
            </Button>
            {pendingMatchCount > 0 && (
              <Button variant="default" onClick={onWaitForResults} className="w-full">
                Wait for Final Results
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {waitingForFinalResults && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-yellow-500 text-black px-4 py-2 rounded-lg shadow-lg">
          Waiting for final results... No new pairings will be created.
        </div>
      )}
    </>
  )
}
