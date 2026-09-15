#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
plugin_root="$(cd "${script_dir}/../.." && pwd)"

registry="${plugin_root}/src/includes/catalog/catalog-strings.php"
generator="${plugin_root}/scripts/generate-catalog-strings.php"

if [[ ! -f "${registry}" ]]; then
    echo "ERROR: ${registry#"${plugin_root}/"} is missing."
    echo "Run: php scripts/generate-catalog-strings.php"
    exit 1
fi

# The catalog vocabulary lives in JSON, where the string extractor cannot see
# it. The registry is what puts it in the .pot, so a catalog edit that skips
# the regeneration ships untranslatable strings.
backup="$(mktemp)"
cp "${registry}" "${backup}"
restore() { mv "${backup}" "${registry}"; }
trap restore EXIT

php "${generator}" > /dev/null

if ! diff -q "${backup}" "${registry}" > /dev/null; then
    echo "ERROR: the catalog string registry is out of date."
    echo "The settings catalog JSON has strings the registry does not carry,"
    echo "so they never reach fotogrids.pot and cannot be translated."
    echo
    echo "Run: php scripts/generate-catalog-strings.php"
    echo
    diff "${backup}" "${registry}" | head -40 || true
    exit 1
fi

echo "OK: Catalog string registry matches the settings catalog."
