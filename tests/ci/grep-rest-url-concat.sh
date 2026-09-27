#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
plugin_root="$(cd "${script_dir}/../.." && pwd)"

scan_targets=(
    "${plugin_root}/src/assets"
    "${plugin_root}/src/public"
    "${plugin_root}/src/includes"
)

# rest_url() is https://site/wp-json/ with pretty permalinks and
# https://site/index.php?rest_route=/ with plain ones. Client code must take
# the REST root from a localised value and append query parameters through
# URL/URLSearchParams (or an includes('?') separator); a literal /wp-json/
# base or a hand-written ?param= after a route breaks on plain permalinks.
# apiFetch paths are exempt - apiFetch rewrites the separator itself. They are
# recognised by a `path:` key on the line or by a leading slash on the route.
scan() {
    grep --recursive --line-number --extended-regexp \
        --include='*.js' --include='*.jsx' --include='*.ts' --include='*.tsx' \
        --exclude-dir=node_modules --exclude-dir=build --exclude-dir=vendor \
        --exclude-dir=freemius --exclude-dir=tests \
        "$1" "${scan_targets[@]}" \
    | grep --invert-match --extended-regexp '^[^:]+:[0-9]+:[[:space:]]*(\*|//|/\*)' \
    || true
}

literal_base="$(scan "['\"\`][^'\"\`]*/wp-json/")"
manual_query="$(
    scan "(^|[^/])fotogrids/v1/[^'\"\`[:space:]]*\?[A-Za-z_]+=" \
    | grep --invert-match --extended-regexp 'path[[:space:]]*:' \
    || true
)"

status=0

if [[ -n "${literal_base}" ]]; then
    echo "ERROR: /wp-json/ string literal used in client code."
    echo "Take the REST root from a localised value; /wp-json/ does not exist on plain permalinks."
    echo
    echo "${literal_base}"
    echo
    status=1
fi

if [[ -n "${manual_query}" ]]; then
    echo "ERROR: query string concatenated onto a REST route with '?'."
    echo "On plain permalinks the root already carries ?rest_route=, so a second '?' breaks the request."
    echo "Append parameters through URL + searchParams."
    echo
    echo "${manual_query}"
    echo
    status=1
fi

if [[ "${status}" -eq 0 ]]; then
    echo "OK: No hardcoded /wp-json/ bases or '?'-concatenated REST query strings."
fi

exit "${status}"
