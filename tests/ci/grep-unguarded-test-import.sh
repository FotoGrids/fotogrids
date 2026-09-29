#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
plugin_root="$(cd "${script_dir}/../.." && pwd)"

# Specs take `test` and `expect` from tests/e2e/support/test.ts, which brackets
# every test with the console-error and PHP-notice guards. Importing them from
# @playwright/test instead silently opts that spec out. Type-only imports from
# @playwright/test are fine - they carry no runtime.
offenders="$(
    grep -rn --include='*.spec.ts' "from '@playwright/test'" \
        "${plugin_root}/tests/e2e" 2>/dev/null \
    | grep -v 'import type' || true
)"

if [ -n "${offenders}" ]; then
    echo "Specs must import test/expect from ./support/test, not @playwright/test:"
    echo "${offenders}"
    exit 1
fi

echo "OK: every spec uses the guarded test module."
