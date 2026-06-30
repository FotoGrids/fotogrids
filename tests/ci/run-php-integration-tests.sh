#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
plugin_root="$(cd "${script_dir}/../.." && pwd)"

require_php_tests="${FOTOGRIDS_REQUIRE_PHP_TESTS:-0}"

if ! command -v php >/dev/null 2>&1; then
    if [[ "${require_php_tests}" == "1" ]]; then
        echo "ERROR: php binary not found, but FOTOGRIDS_REQUIRE_PHP_TESTS=1."
        exit 1
    fi

    echo "WARN: php binary not found; skipping PHP integration tests."
    exit 0
fi

tests=(
    "${plugin_root}/tests/integration/CatalogFieldStatesEndpointTest.php"
    "${plugin_root}/tests/integration/HookFiringOrderTest.php"
    "${plugin_root}/tests/integration/PreviewEndpointTest.php"
    "${plugin_root}/tests/integration/PublicRenderParityTest.php"
    "${plugin_root}/tests/integration/LicenseStateMatrixTest.php"
    "${plugin_root}/tests/integration/TemplateConfigValidityTest.php"
)

for test_file in "${tests[@]}"; do
    if [[ ! -f "${test_file}" ]]; then
        echo "ERROR: Missing PHP integration test file: ${test_file}"
        exit 1
    fi

    echo "Running ${test_file##*/}..."
    php "${test_file}"
done

echo "OK: PHP integration tests passed."
