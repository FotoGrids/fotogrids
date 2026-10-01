#!/usr/bin/env bash
# Run the lifecycle scenarios, each against a WordPress of its own.
#
#   ./tests/lifecycle/run.sh              every scenario
#   ./tests/lifecycle/run.sh life-01      one, by filename prefix
#
# Needs a booted harness (tests/harness/boot.sh), whose downloaded WordPress and
# wp-cli it reuses, and the same database it was given.

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
STATE="${FG_HARNESS_STATE:-$ROOT/tests/harness/.state}"

export FG_WP_SOURCE="$STATE/wp"
export FG_WP_CLI="$STATE/wp-cli.phar"
export FG_SCRATCH_ROOT="${FG_SCRATCH_ROOT:-${TMPDIR:-/tmp}/fg-lifecycle}"

[ -f "$FG_WP_SOURCE/wp-settings.php" ] || {
	echo "No WordPress at $FG_WP_SOURCE. Run tests/harness/boot.sh first." >&2
	exit 1
}

export FG_DB_USER="${FG_DB_USER:-root}"
export FG_DB_PASS="${FG_DB_PASS:-}"

if [ -n "${FG_DB_SOCKET:-}" ]; then
	export FG_MYSQL_ARGS="--socket=$FG_DB_SOCKET -u $FG_DB_USER"
	export FG_DB_HOST_ARG="localhost:$FG_DB_SOCKET"
else
	host="${FG_DB_HOST:-127.0.0.1}"
	port="${FG_DB_PORT:-3306}"
	export FG_MYSQL_ARGS="--host=$host --port=$port -u $FG_DB_USER"
	export FG_DB_HOST_ARG="$host:$port"
fi
[ -n "$FG_DB_PASS" ] && export FG_MYSQL_ARGS="$FG_MYSQL_ARGS --password=$FG_DB_PASS"

mkdir -p "$FG_SCRATCH_ROOT"

filter="${1:-}"
failures=0
ran=0

for scenario in "$HERE"/scenarios/*.sh; do
	name="$(basename "$scenario" .sh)"
	[ -n "$filter" ] && case "$name" in *"$filter"*) ;; *) continue ;; esac

	echo "==> $name"
	started=$(date +%s)

	# A subshell, so one scenario's variables and failures cannot reach another.
	( set -uo pipefail; . "$HERE/lib.sh"; . "$scenario"; exit "$FG_LIFECYCLE_FAILURES" )
	status=$?

	ran=$(( ran + 1 ))
	[ "$status" -ne 0 ] && failures=$(( failures + 1 ))
	echo "    ($(( $(date +%s) - started ))s)"
done

echo
if [ "$ran" -eq 0 ]; then
	echo "No scenario matched '${filter}'." >&2
	exit 1
fi

if [ "$failures" -ne 0 ]; then
	echo "$failures of $ran scenarios failed."
	exit 1
fi

echo "$ran scenarios passed."
