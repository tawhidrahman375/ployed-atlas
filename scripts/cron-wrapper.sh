#!/usr/bin/env bash
# Wraps `npm run morning` / `npm run evening` so cron's own outcome — not
# just each agent's individual logAgentRun() call inside atlas.ts — lands in
# Supabase's agent_logs table, under agent="Cron". Without this, a crash
# before any agent runs (env misconfig, tsx failing to start, an uncaught
# exception in atlas.ts's own setup) is invisible anywhere outside this
# box's local logs/*.log files, which nothing off the VPS can read.
#
# Crontab usage (replaces the old direct `npm run morning`/`evening` line):
#   0 8 * * * cd /root/ployed-atlas && bash scripts/cron-wrapper.sh morning
#   0 20 * * * cd /root/ployed-atlas && bash scripts/cron-wrapper.sh evening
set -uo pipefail
cd "$(dirname "$0")/.."

BLOCK="${1:?usage: cron-wrapper.sh morning|evening}"
LOG_FILE="logs/${BLOCK}.log"
mkdir -p logs

# cron's shell doesn't source .env the way `npm run` does via dotenv — load
# it here too so SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are available for
# the curl call below regardless of how the run itself goes.
set -a
# shellcheck disable=SC1091
[ -f .env ] && source .env
set +a

START=$(date +%s)
npm run "$BLOCK" >>"$LOG_FILE" 2>&1
EXIT=$?
DURATION=$(( $(date +%s) - START ))

STATUS="completed"
[ "$EXIT" -ne 0 ] && STATUS="FAILED (exit ${EXIT})"

if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  curl -sS -o /dev/null --max-time 10 -X POST "${SUPABASE_URL}/rest/v1/agent_logs" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "{\"agent\":\"Cron\",\"session_type\":\"${BLOCK}\",\"summary\":\"${STATUS} in ${DURATION}s — see logs/${BLOCK}.log on the VPS for full output\",\"actions_taken\":{\"exit_code\":${EXIT},\"duration_seconds\":${DURATION}}}"
else
  echo "cron-wrapper: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set, skipping Supabase log" >&2
fi

exit "$EXIT"
