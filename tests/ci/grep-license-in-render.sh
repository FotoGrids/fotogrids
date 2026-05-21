#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
plugin_root="$(cd "${script_dir}/../.." && pwd)"

free_render_dir="${plugin_root}/src/public/render"
pro_render_dir="${plugin_root}/../Pro/src/public/render"

violations="$(
    rg --line-number --no-heading --color=never --glob '*.php' \
        'License_Manager|License_Provider' \
        "${free_render_dir}" "${pro_render_dir}" \
    | rg --line-number --no-heading --color=never -v '@phpstan-ignore' \
    || true
)"

if [[ -n "${violations}" ]]; then
    echo "ERROR: License_Manager/License_Provider referenced in render code."
    echo "Render is license-agnostic. Move license logic to includes/settings/Edit_Gate or Catalog/State_Resolver."
    echo
    echo "${violations}"
    exit 1
fi

echo "OK: No license calls in render directories."
