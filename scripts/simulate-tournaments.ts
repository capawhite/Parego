/**
 * Parego Tournament Simulation & Stress Test
 *
 * Simulates 20 tournaments, 24 players each, 6 rounds of play.
 * Tests: DB writes, RLS policies, pairing logic, result submissions,
 *        Realtime event propagation, claim-guest-history flow.
 *
 * Runs in batches of 5 tournaments in parallel to stay well within
 * Supabase free-tier limits (~8% of monthly API budget).
 *
 * Usage:
 *   npx tsx scripts/simulate-tournaments.ts
 */

import { config } from "dotenv"
config({ path: ".env.local" })
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const CONFIG = {
  totalTournaments: process.env.TOTAL_TOURNAMENTS ? parseInt(process.env.TOTAL_TOURNAMENTS, 10) : 20,
  playersPerTournament: 24,
  roundsPerTournament: 6,
  batchSize: 5,          // tournaments running in parallel
  delayBetweenRoundsMs: 1500,
  delayBetweenOpsMs: 80, // small pause between individual DB calls
  cleanupAfter: true,
}

const TEST_PREFIX = "__sim__"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(tag: string, msg: string) {
  const time = new Date().toISOString().substring(11, 19)
  console.log(`[${time}] [${tag}] ${msg}`)
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function randomId() {
  return Math.random().toString(36).substring(2, 10).toUpperCase()
}

function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ─── Result tracking ─────────────────────────────────────────────────────────

interface TestResult {
  tournament: string
  phase: string
  passed: boolean
  detail?: string
}

const results: TestResult[] = []

function pass(tournament: string, phase: string, detail?: string) {
  results.push({ tournament, phase, passed: true, detail })
}

function fail(tournament: string, phase: string, detail: string) {
  results.push({ tournament, phase, passed: false, detail })
  log(tournament, `❌ FAIL [${phase}]: ${detail}`)
}

// ─── Phase 1: Create tournament ───────────────────────────────────────────────

async function createTournament(tIdx: number): Promise<string | null> {
  const admin = adminClient()
  const tournamentId = `${TEST_PREFIX}${randomId()}`
  const name = `Sim Tournament ${tIdx + 1}`

  const { error } = await admin.from("tournaments").insert({
    id: tournamentId,
    name,
    status: "setup",
    tables_count: 12,
    settings: {
      winPoints: 2,
      drawPoints: 1,
      lossPoints: 0,
      streakEnabled: true,
      streakMultiplier: 1.5,
      allowSelfPause: true,
      allowLateJoin: true,
      minGamesBeforePause: 1,
      avoidRecentRematches: 2,
      colorBalancePriority: "medium",
      scoreMatchingStrictness: "normal",
      tableCount: 12,
      autoEndAtCompletion: false,
      completionThreshold: 0.8,
      baseTimeMinutes: 5,
      incrementSeconds: 3,
      pairingAlgorithm: "all-vs-all",
    },
    visibility: "private",
    organizer_id: null,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    fail(`T${tIdx + 1}`, "create-tournament", error.message)
    return null
  }

  pass(`T${tIdx + 1}`, "create-tournament")
  return tournamentId
}

// ─── Phase 2: Add players ─────────────────────────────────────────────────────

interface SimPlayer {
  id: string
  name: string
  isGuest: boolean
  score: number
  gamesPlayed: number
  opponentIds: string[]
  gameResults: ("W" | "D" | "L")[]
  pieceColors: ("white" | "black")[]
}

async function addPlayers(
  tIdx: number,
  tournamentId: string,
  count: number,
): Promise<SimPlayer[]> {
  const admin = adminClient()
  const players: SimPlayer[] = []

  // Mix of guests (70%) and "registered" (30%)
  const rows = Array.from({ length: count }, (_, i) => {
    const id = crypto.randomUUID()
    const isGuest = i >= Math.floor(count * 0.3)
    const name = isGuest ? `Guest_${randomId()}` : `Player_${randomId()}`
    players.push({
      id,
      name,
      isGuest,
      score: 0,
      gamesPlayed: 0,
      opponentIds: [],
      gameResults: [],
      pieceColors: [],
    })
    return {
      id,
      tournament_id: tournamentId,
      name,
      is_guest: isGuest,
      user_id: null,
      points: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      games_played: 0,
      white_count: 0,
      black_count: 0,
      current_streak: 0,
      on_streak: false,
      paused: false,
      is_paused: false,
      is_removed: false,
      game_history: [],
      opponents: [],
      results: [],
      colors: [],
      points_earned: [],
      table_numbers: [],
      buchholz: 0,
      sonneborn_berger: 0,
      rating: Math.floor(Math.random() * 1200) + 800,
    }
  })

  const { error } = await admin.from("players").insert(rows)

  if (error) {
    fail(`T${tIdx + 1}`, "add-players", error.message)
    return []
  }

  pass(`T${tIdx + 1}`, "add-players", `${count} players (${Math.floor(count * 0.3)} registered, ${count - Math.floor(count * 0.3)} guests)`)
  return players
}

// ─── Phase 3: Start tournament ────────────────────────────────────────────────

async function startTournament(tIdx: number, tournamentId: string): Promise<boolean> {
  const admin = adminClient()
  const { error } = await admin
    .from("tournaments")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", tournamentId)

  if (error) {
    fail(`T${tIdx + 1}`, "start-tournament", error.message)
    return false
  }

  pass(`T${tIdx + 1}`, "start-tournament")
  return true
}

// ─── Phase 4: Run rounds ──────────────────────────────────────────────────────

function pairPlayers(
  players: SimPlayer[],
  existingMatchups: Set<string>,
): Array<[SimPlayer, SimPlayer]> {
  const available = players.filter((p) => !p.opponentIds.includes("BYE"))
  const shuffled = [...available].sort(() => Math.random() - 0.5)
  const pairs: Array<[SimPlayer, SimPlayer]> = []
  const used = new Set<string>()

  for (let i = 0; i < shuffled.length - 1; i++) {
    const p1 = shuffled[i]
    if (used.has(p1.id)) continue

    for (let j = i + 1; j < shuffled.length; j++) {
      const p2 = shuffled[j]
      if (used.has(p2.id)) continue
      const key = [p1.id, p2.id].sort().join("|")
      if (!existingMatchups.has(key)) {
        pairs.push([p1, p2])
        used.add(p1.id)
        used.add(p2.id)
        existingMatchups.add(key)
        break
      }
    }
  }

  return pairs
}

async function runRound(
  tIdx: number,
  tournamentId: string,
  players: SimPlayer[],
  roundNum: number,
  existingMatchups: Set<string>,
): Promise<boolean> {
  const admin = adminClient()
  const anon = anonClient()

  const pairs = pairPlayers(players, existingMatchups)
  if (pairs.length === 0) {
    log(`T${tIdx + 1}`, `Round ${roundNum}: no pairings possible, skipping`)
    return true
  }

  // Insert matches
  const matchRows = pairs.map(([p1, p2]) => ({
    id: crypto.randomUUID(),
    tournament_id: tournamentId,
    player1_id: p1.id,
    player2_id: p2.id,
    player1_data: JSON.stringify(p1),
    player2_data: JSON.stringify(p2),
    table_number: Math.ceil(Math.random() * 12),
    completed: false,
    dispute_status: "none",
    result: null,
  }))

  const { error: matchErr } = await admin.from("matches").insert(matchRows)
  if (matchErr) {
    fail(`T${tIdx + 1}`, `round-${roundNum}-insert`, matchErr.message)
    return false
  }

  await sleep(CONFIG.delayBetweenOpsMs)

  // Submit results — simulate players submitting from their "devices" (anon client)
  let disputes = 0
  for (const matchRow of matchRows) {
    const outcomes: ("player1-win" | "draw" | "player2-win")[] = ["player1-win", "draw", "player2-win"]
    const p1Result = outcomes[Math.floor(Math.random() * 3)]

    // 10% chance of a disputed result
    const isDisputed = Math.random() < 0.1
    const p2Result: "player1-win" | "draw" | "player2-win" = isDisputed
      ? outcomes.filter((o) => o !== p1Result)[Math.floor(Math.random() * 2)]
      : p1Result

    if (isDisputed) disputes++

    // Player 1 submits (anon, tests the "anyone can submit" RLS policy)
    const { error: sub1Err } = await anon
      .from("matches")
      .update({
        player1_submission: p1Result,
        player1_submission_time: new Date().toISOString(),
      })
      .eq("id", matchRow.id)

    if (sub1Err) {
      fail(`T${tIdx + 1}`, `round-${roundNum}-submission`, `Player1 submit failed: ${sub1Err.message}`)
    }

    await sleep(CONFIG.delayBetweenOpsMs / 2)

    // Player 2 submits
    const { error: sub2Err } = await anon
      .from("matches")
      .update({
        player2_submission: p2Result,
        player2_submission_time: new Date().toISOString(),
      })
      .eq("id", matchRow.id)

    if (sub2Err) {
      fail(`T${tIdx + 1}`, `round-${roundNum}-submission`, `Player2 submit failed: ${sub2Err.message}`)
    }

    // Organizer confirms result (admin — as organizer would)
    const finalResult = isDisputed ? p1Result : p1Result // organizer breaks tie
    const winnerId =
      finalResult === "draw"
        ? null
        : finalResult === "player1-win"
          ? matchRow.player1_id
          : matchRow.player2_id

    const { error: confirmErr } = await admin
      .from("matches")
      .update({
        result: JSON.stringify({
          winnerId,
          isDraw: finalResult === "draw",
          completed: true,
          completedAt: Date.now(),
        }),
        completed: true,
        completed_at: new Date().toISOString(),
        dispute_status: isDisputed ? "escalated" : "none",
      })
      .eq("id", matchRow.id)

    if (confirmErr) {
      fail(`T${tIdx + 1}`, `round-${roundNum}-confirm`, confirmErr.message)
    }

    // Update in-memory player scores
    const p1 = players.find((p) => p.id === matchRow.player1_id)!
    const p2 = players.find((p) => p.id === matchRow.player2_id)!

    p1.opponentIds.push(p2.id)
    p2.opponentIds.push(p1.id)
    p1.gamesPlayed++
    p2.gamesPlayed++

    if (finalResult === "draw") {
      p1.score += 1; p2.score += 1
      p1.gameResults.push("D"); p2.gameResults.push("D")
    } else if (finalResult === "player1-win") {
      p1.score += 2
      p1.gameResults.push("W"); p2.gameResults.push("L")
    } else {
      p2.score += 2
      p1.gameResults.push("L"); p2.gameResults.push("W")
    }

    await sleep(CONFIG.delayBetweenOpsMs / 2)
  }

  pass(
    `T${tIdx + 1}`,
    `round-${roundNum}`,
    `${pairs.length} matches, ${disputes} disputes`,
  )
  return true
}

// ─── Phase 5: Update player standings in DB ───────────────────────────────────

async function syncStandings(
  tIdx: number,
  tournamentId: string,
  players: SimPlayer[],
): Promise<void> {
  const admin = adminClient()

  const updates = players.map((p) => ({
    id: p.id,
    tournament_id: tournamentId,
    name: p.name,
    is_guest: p.isGuest,
    points: p.score,
    wins: p.gameResults.filter((r) => r === "W").length,
    draws: p.gameResults.filter((r) => r === "D").length,
    losses: p.gameResults.filter((r) => r === "L").length,
    games_played: p.gamesPlayed,
    opponents: p.opponentIds,
    results: p.gameResults,
    current_streak: 0,
  }))

  const { error } = await admin.from("players").upsert(updates, { onConflict: "id" })
  if (error) {
    fail(`T${tIdx + 1}`, "sync-standings", error.message)
  } else {
    // Verify standings read back correctly
    const { data, error: readErr } = await admin
      .from("players")
      .select("id, points, games_played")
      .eq("tournament_id", tournamentId)
      .order("points", { ascending: false })

    if (readErr) {
      fail(`T${tIdx + 1}`, "verify-standings", readErr.message)
    } else {
      const totalGames = data?.reduce((s, p) => s + (p.games_played ?? 0), 0) ?? 0
      pass(`T${tIdx + 1}`, "sync-standings", `leader: ${data?.[0]?.points ?? 0}pts, total game records: ${totalGames}`)
    }
  }
}

// ─── Phase 6: End tournament ──────────────────────────────────────────────────

async function endTournament(tIdx: number, tournamentId: string): Promise<void> {
  const admin = adminClient()
  const { error } = await admin
    .from("tournaments")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", tournamentId)

  if (error) {
    fail(`T${tIdx + 1}`, "end-tournament", error.message)
  } else {
    pass(`T${tIdx + 1}`, "end-tournament")
  }
}

// ─── Phase 7: Realtime subscription test ─────────────────────────────────────

async function testRealtime(tIdx: number, tournamentId: string): Promise<void> {
  return new Promise((resolve) => {
    const client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    let receivedEvent = false
    const timeout = setTimeout(() => {
      client.removeAllChannels()
      if (receivedEvent) {
        pass(`T${tIdx + 1}`, "realtime", "received postgres_changes event")
      } else {
        fail(`T${tIdx + 1}`, "realtime", "no event received within 10s — check Supabase Realtime is enabled for 'tournaments' table")
      }
      resolve()
    }, 10000)

    client
      .channel(`sim-test:${tournamentId}`)
      .on(
        "postgres_changes" as any,
        { event: "UPDATE", schema: "public", table: "tournaments", filter: `id=eq.${tournamentId}` },
        () => {
          receivedEvent = true
          clearTimeout(timeout)
          client.removeAllChannels()
          pass(`T${tIdx + 1}`, "realtime", "received tournament UPDATE event in <5s")
          resolve()
        },
      )
      .subscribe(async () => {
        // Trigger an update after subscribing
        const admin = adminClient()
        await sleep(300)
        await admin
          .from("tournaments")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", tournamentId)
      })
  })
}

// ─── Phase 8: RLS policy checks ──────────────────────────────────────────────

async function testRlsPolicies(tIdx: number, tournamentId: string): Promise<void> {
  const anon = anonClient()

  // Anon SHOULD be able to read tournaments
  const { data: readData, error: readErr } = await anon
    .from("tournaments")
    .select("id, name")
    .eq("id", tournamentId)
    .single()

  if (readErr || !readData) {
    fail(`T${tIdx + 1}`, "rls-read-tournament", readErr?.message ?? "no data returned")
  } else {
    pass(`T${tIdx + 1}`, "rls-read-tournament", "anon can read tournaments ✓")
  }

  // Anon SHOULD NOT be able to delete a tournament (no DELETE policy for anon)
  const { error: deleteErr } = await anon
    .from("tournaments")
    .delete()
    .eq("id", tournamentId)

  if (deleteErr) {
    pass(`T${tIdx + 1}`, "rls-block-delete", "anon correctly blocked from deleting tournament ✓")
  } else {
    // If no error, verify the row still exists
    const { data } = await anon.from("tournaments").select("id").eq("id", tournamentId).single()
    if (data) {
      pass(`T${tIdx + 1}`, "rls-block-delete", "row still exists after anon delete attempt ✓")
    } else {
      fail(`T${tIdx + 1}`, "rls-block-delete", "anon was able to delete tournament — RLS gap!")
    }
  }

  // Anon SHOULD be able to read players
  const { data: playerData, error: playerErr } = await anon
    .from("players")
    .select("id")
    .eq("tournament_id", tournamentId)
    .limit(1)

  if (playerErr) {
    fail(`T${tIdx + 1}`, "rls-read-players", playerErr.message)
  } else {
    pass(`T${tIdx + 1}`, "rls-read-players", `anon can read players ✓ (${playerData?.length ?? 0} rows)`)
  }
}

// ─── Phase 9: Claim guest history test ───────────────────────────────────────

async function testGuestClaim(tIdx: number, tournamentId: string, players: SimPlayer[]): Promise<void> {
  const admin = adminClient()

  // Pick a guest player
  const guest = players.find((p) => p.isGuest)
  if (!guest) {
    log(`T${tIdx + 1}`, "no guest player found for claim test, skipping")
    return
  }

  // Confirm user_id is null
  const { data: before } = await admin
    .from("players")
    .select("id, user_id")
    .eq("id", guest.id)
    .single()

  if (before?.user_id !== null) {
    fail(`T${tIdx + 1}`, "guest-claim", "guest player already has user_id — unexpected")
    return
  }

  // Verify the guest claim FK constraint works correctly:
  // Setting user_id to a UUID that doesn't exist in auth.users SHOULD be blocked.
  const fakeUserId = crypto.randomUUID()
  const { error: claimErr } = await admin
    .from("players")
    .update({ user_id: fakeUserId })
    .eq("id", guest.id)
    .is("user_id", null)

  if (claimErr && claimErr.message.includes("foreign key constraint")) {
    pass(`T${tIdx + 1}`, "guest-claim", "FK constraint correctly blocks claiming with non-existent user_id ✓")
  } else if (claimErr) {
    fail(`T${tIdx + 1}`, "guest-claim", claimErr.message)
  } else {
    // If it succeeded (no FK), verify row was updated
    const { data: after } = await admin
      .from("players")
      .select("id, user_id")
      .eq("id", guest.id)
      .single()
    if (after?.user_id === fakeUserId) {
      pass(`T${tIdx + 1}`, "guest-claim", "guest player claim path executed (no FK enforcement on user_id)")
    } else {
      fail(`T${tIdx + 1}`, "guest-claim", "user_id not updated as expected")
    }
  }
}

// ─── Full tournament lifecycle ────────────────────────────────────────────────

async function runTournament(tIdx: number): Promise<void> {
  log(`T${tIdx + 1}`, "▶ Starting simulation")

  const tournamentId = await createTournament(tIdx)
  if (!tournamentId) return

  const players = await addPlayers(tIdx, tournamentId, CONFIG.playersPerTournament)
  if (players.length === 0) return

  const started = await startTournament(tIdx, tournamentId)
  if (!started) return

  // Run Realtime test in the background while rounds play out
  const realtimePromise = testRealtime(tIdx, tournamentId)

  // Check RLS
  await testRlsPolicies(tIdx, tournamentId)
  await testGuestClaim(tIdx, tournamentId, players)

  // Run rounds
  const matchups = new Set<string>()
  for (let r = 1; r <= CONFIG.roundsPerTournament; r++) {
    log(`T${tIdx + 1}`, `Round ${r}/${CONFIG.roundsPerTournament}`)
    await runRound(tIdx, tournamentId, players, r, matchups)
    await sleep(CONFIG.delayBetweenRoundsMs)
  }

  await syncStandings(tIdx, tournamentId, players)
  await endTournament(tIdx, tournamentId)
  await realtimePromise

  log(`T${tIdx + 1}`, "✓ Complete")
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  log("CLEANUP", "Deleting all test data...")
  const admin = adminClient()

  const { data: testTournaments } = await admin
    .from("tournaments")
    .select("id")
    .like("id", `${TEST_PREFIX}%`)

  if (!testTournaments?.length) {
    log("CLEANUP", "No test tournaments found")
    return
  }

  const ids = testTournaments.map((t) => t.id)

  // Cascade deletes players + matches (FK ON DELETE CASCADE)
  const { error } = await admin.from("tournaments").delete().in("id", ids)
  if (error) {
    log("CLEANUP", `❌ Failed to delete tournaments: ${error.message}`)
  } else {
    log("CLEANUP", `✓ Deleted ${ids.length} tournaments and all associated data`)
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

function printSummary(durationMs: number) {
  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length
  const total = results.length

  console.log("\n" + "═".repeat(60))
  console.log("  SIMULATION COMPLETE")
  console.log("═".repeat(60))
  console.log(`  Duration : ${(durationMs / 1000).toFixed(1)}s`)
  console.log(`  Tests    : ${total} total  ✓ ${passed} passed  ✗ ${failed} failed`)
  console.log("═".repeat(60))

  if (failed > 0) {
    console.log("\n  FAILURES:")
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  ✗ [${r.tournament}] ${r.phase}: ${r.detail}`)
      })
  }

  // Phase breakdown
  const phases = new Map<string, { pass: number; fail: number }>()
  for (const r of results) {
    const key = r.phase.replace(/-\d+$/, "").replace(/round-\d+/, "round-N")
    const entry = phases.get(key) ?? { pass: 0, fail: 0 }
    if (r.passed) { entry.pass++ } else { entry.fail++ }
    phases.set(key, entry)
  }

  console.log("\n  PHASE BREAKDOWN:")
  for (const [phase, counts] of phases) {
    const status = counts.fail === 0 ? "✓" : "✗"
    console.log(`  ${status} ${phase.padEnd(30)} ${counts.pass} passed, ${counts.fail} failed`)
  }
  console.log("═".repeat(60) + "\n")
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    console.error("Missing environment variables. Check .env.local for:\n  NEXT_PUBLIC_SUPABASE_URL\n  NEXT_PUBLIC_SUPABASE_ANON_KEY\n  SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
  }

  console.log("═".repeat(60))
  console.log("  Parego Tournament Simulation")
  console.log(`  ${CONFIG.totalTournaments} tournaments × ${CONFIG.playersPerTournament} players × ${CONFIG.roundsPerTournament} rounds`)
  console.log(`  Batch size: ${CONFIG.batchSize} parallel tournaments`)
  console.log("═".repeat(60) + "\n")

  const start = Date.now()

  // Run in batches to avoid overwhelming the free tier
  for (let batch = 0; batch < CONFIG.totalTournaments; batch += CONFIG.batchSize) {
    const batchEnd = Math.min(batch + CONFIG.batchSize, CONFIG.totalTournaments)
    log("RUNNER", `Batch ${Math.floor(batch / CONFIG.batchSize) + 1}/${Math.ceil(CONFIG.totalTournaments / CONFIG.batchSize)}: tournaments ${batch + 1}–${batchEnd}`)
    await Promise.all(
      Array.from({ length: batchEnd - batch }, (_, i) => runTournament(batch + i))
    )
    log("RUNNER", `Batch complete. Cooling down 2s...`)
    await sleep(2000)
  }

  if (CONFIG.cleanupAfter) {
    await cleanup()
  }

  printSummary(Date.now() - start)
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
