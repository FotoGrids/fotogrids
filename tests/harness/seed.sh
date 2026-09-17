#!/usr/bin/env bash
#
# Seed the fixture sets into whichever site boot.sh last booted.
#
#   ./tests/harness/seed.sh                  build anything missing or outdated
#   ./tests/harness/seed.sh reset            truncate first, then build everything
#   ./tests/harness/seed.sh only=F-exif      one set
#   ./tests/harness/seed.sh force            rebuild even if current
#
# Exists because the wp-cli shim runs from inside the WordPress install, so a
# relative path to seed.php resolves against the wrong directory.

set -euo pipefail

HARNESS_DIR=$(cd -- "$(dirname -- "$0")" && pwd -P)
ENV_FILE="$HARNESS_DIR/.env"

[ -f "$ENV_FILE" ] || {
  echo "error: no $ENV_FILE - run ./tests/harness/boot.sh first" >&2
  exit 1
}

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

exec "$WP_CLI" eval-file "$HARNESS_DIR/seed.php" \
  "out=$HARNESS_DIR/.state/fixtures.json" "$@"
