#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
plugin_root="$(cd "${script_dir}/../.." && pwd)"

free_render_dir="${plugin_root}/src/public/render"
pro_render_dir="${plugin_root}/../Pro/src/public/render"

scan_dirs=()
[[ -d "${free_render_dir}" ]] && scan_dirs+=( "${free_render_dir}" )
[[ -d "${pro_render_dir}" ]] && scan_dirs+=( "${pro_render_dir}" )

violations="$(
    grep --recursive --line-number --include='*.php' --extended-regexp \
        'License_Manager|License_Provider' \
        "${scan_dirs[@]}" \
    | grep --invert-match '@phpstan-ignore' \
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
