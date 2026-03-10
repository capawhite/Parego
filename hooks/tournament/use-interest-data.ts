"use client"

import { useState, useEffect } from "react"
import {
  getInterestCount,
  getInterestedUsers,
  getUserInterested,
  type InterestedUser,
} from "@/lib/database/tournament-db"
import { toggleInterest } from "@/app/actions/express-interest"
import { toast } from "sonner"

export interface InterestDataResult {
  interestCount: number
  interestedUsers: InterestedUser[]
  userInterested: boolean
  togglingInterest: boolean
  handleToggleInterest: () => Promise<void>
}

export function useInterestData(
  tournamentId: string | null,
  isOrganizer: boolean,
  currentUserId: string | null,
): InterestDataResult {
  const [interestCount, setInterestCount] = useState(0)
  const [interestedUsers, setInterestedUsers] = useState<InterestedUser[]>([])
  const [userInterested, setUserInterested] = useState(false)
  const [togglingInterest, setTogglingInterest] = useState(false)

  useEffect(() => {
    if (!tournamentId) return
    let cancelled = false
    Promise.all([
      getInterestCount(tournamentId),
      isOrganizer ? getInterestedUsers(tournamentId) : Promise.resolve([]),
      currentUserId ? getUserInterested(tournamentId, currentUserId) : Promise.resolve(false),
    ]).then(([count, users, interested]) => {
      if (!cancelled) {
        setInterestCount(count)
        setInterestedUsers(users)
        setUserInterested(interested)
      }
    })
    return () => {
      cancelled = true
    }
  }, [tournamentId, isOrganizer, currentUserId])

  const handleToggleInterest = async () => {
    if (!tournamentId) return
    setTogglingInterest(true)
    try {
      const result = await toggleInterest(tournamentId)
      if (!result.ok) {
        toast.error(result.error ?? "Could not update interest")
        return
      }
      setInterestCount(result.count)
      setUserInterested(result.interested)
      if (isOrganizer) {
        const users = await getInterestedUsers(tournamentId)
        setInterestedUsers(users)
      }
    } finally {
      setTogglingInterest(false)
    }
  }

  return {
    interestCount,
    interestedUsers,
    userInterested,
    togglingInterest,
    handleToggleInterest,
  }
}
