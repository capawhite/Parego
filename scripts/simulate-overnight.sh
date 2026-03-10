#!/usr/bin/env bash
# Overnight stress-test runner for Parego.
# Runs 5 passes of 100 tournaments each, with a 5-minute cooldown between passes.
# Total: ~500 tournaments, ~2.5 hrs, well within Supabase free-tier limits.
# Results are written to scripts/overnight-results.log

cd "$(dirname "$0")/.." || exit 1

LOG="scripts/overnight-results.log"
PASSES=5
TOURNAMENTS_PER_PASS=100

echo "════════════════════════════════════════════════════════════" | tee "$LOG"
echo "  Parego Overnight Stress Test — started $(date)" | tee -a "$LOG"
echo "  ${PASSES} passes × ${TOURNAMENTS_PER_PASS} tournaments = $((PASSES * TOURNAMENTS_PER_PASS)) total" | tee -a "$LOG"
echo "════════════════════════════════════════════════════════════" | tee -a "$LOG"

PASS_FAIL=0
PASS_PASS=0

for i in $(seq 1 $PASSES); do
  echo "" | tee -a "$LOG"
  echo "──── PASS $i / $PASSES  [$(date +%H:%M:%S)] ────────────────────────────" | tee -a "$LOG"

  # Run the sim with overridden tournament count via env var, capture output
  TOTAL_TOURNAMENTS=$TOURNAMENTS_PER_PASS npx tsx scripts/simulate-tournaments.ts 2>&1 | tee -a "$LOG"
  EXIT=$?

  if [ $EXIT -eq 0 ]; then
    echo "  [Pass $i] Script exited OK" | tee -a "$LOG"
    PASS_PASS=$((PASS_PASS + 1))
  else
    echo "  [Pass $i] ⚠️  Script exited with code $EXIT" | tee -a "$LOG"
    PASS_FAIL=$((PASS_FAIL + 1))
  fi

  if [ $i -lt $PASSES ]; then
    echo "  Cooling down 5 minutes before next pass..." | tee -a "$LOG"
    sleep 300
  fi
done

echo "" | tee -a "$LOG"
echo "════════════════════════════════════════════════════════════" | tee -a "$LOG"
echo "  OVERNIGHT RUN COMPLETE — $(date)" | tee -a "$LOG"
echo "  Passes: ${PASS_PASS} OK  ${PASS_FAIL} failed" | tee -a "$LOG"
echo "  Full results saved to: $LOG" | tee -a "$LOG"
echo "════════════════════════════════════════════════════════════" | tee -a "$LOG"
