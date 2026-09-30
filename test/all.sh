#!/usr/bin/env bash
# Full verification for NEONSWARM. Usage: bash test/all.sh
set -u
cd "$(dirname "$0")/.."
fail=0

echo "=== 1/5 syntax (all modules + tests) ==="
for f in js/*.js test/*.js; do node --check "$f" || { echo "SYNTAX FAIL $f"; fail=1; }; done
[ $fail -eq 0 ] && echo "all files parse"

echo
echo "=== 2/5 orientation regression ==="
node test/orientation.js >/tmp/ns-orient.log 2>&1 && tail -2 /tmp/ns-orient.log || { echo FAIL; fail=1; }

echo
echo "=== 3/5 content + global passives (30 weapons, 40 passives) ==="
node test/content.js >/tmp/ns-content.log 2>&1 && tail -2 /tmp/ns-content.log || { tail -30 /tmp/ns-content.log; fail=1; }

echo
echo "=== 4/5 smoke (long-running bot sim) ==="
node test/smoke.js >/tmp/ns-smoke.log 2>&1 && tail -1 /tmp/ns-smoke.log || { tail -20 /tmp/ns-smoke.log; fail=1; }

echo
echo "=== 5/5 real browser (Chromium) ==="
node test/make-browsercheck.js >/dev/null
# The server is fully detached (setsid + all fds redirected). A background job
# that inherits stdout keeps the caller's pipe open, which makes the whole
# script look like it hung after it already finished.
PORT=8899
setsid python3 -m http.server $PORT >/dev/null 2>&1 </dev/null &
SRV=$!
trap 'kill -TERM -$SRV 2>/dev/null; kill $SRV 2>/dev/null' EXIT INT TERM
sleep 2
OUT=$(timeout 200 chromium --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
      --virtual-time-budget=45000 --dump-dom "http://127.0.0.1:$PORT/_browsercheck.html" 2>/dev/null \
      | sed -n '/browsercheck-log/,/<\/div>/p' | sed 's/<[^>]*>//g')
echo "$OUT" | grep -E "^(PASS|FAIL|RESULT)" | tail -4
if echo "$OUT" | grep -qE "RESULT [0-9]+ passed, 0 failed"; then :; else echo "$OUT" | grep "^FAIL"; fail=1; fi

echo
echo "=========================================="
[ $fail -eq 0 ] && echo "ALL SUITES GREEN" || echo "SOME SUITES FAILED"
exit $fail
