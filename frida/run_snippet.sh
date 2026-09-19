#!/bin/bash
# usage: run_snippet.sh <snippet.js> [adb-serial]   -- pushes snippet into the app sandbox, waits for the loader, prints new log lines
SNIP="$1"; SER="${2:-R9XY70501QK}"
HERE="$(cd "$(dirname "$0")/../.." && pwd)"
export PATH="$PATH:$HERE/Arquivo extra/ferramentas_re/android_sdk/platform-tools"
ADB="adb -s $SER"
PKG=com.ludia.jurassicpark
BEFORE=$($ADB shell run-as $PKG cat //data/data/$PKG/dyn_log.txt 2>/dev/null | wc -l)
TMP="$(mktemp)"; cp "$SNIP" "$TMP"; echo "// nonce $(date +%s%N)" >> "$TMP"
$ADB push "$TMP" //data/local/tmp/dyn.js >/dev/null; rm -f "$TMP"
$ADB shell "run-as $PKG cp //data/local/tmp/dyn.js //data/data/$PKG/dyn.js"
sleep 5
$ADB shell run-as $PKG cat //data/data/$PKG/dyn_log.txt 2>/dev/null | tail -n +$((BEFORE+1))
