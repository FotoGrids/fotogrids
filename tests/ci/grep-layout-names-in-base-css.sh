#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
plugin_root="$(cd "${script_dir}/../.." && pwd)"

base_dir="${plugin_root}/src/public/render/base"

# Shared base CSS keys off capability markers such as data-fg-item-box, never a layout name.
violations="$(grep --recursive --line-number --include='*.css' 'data-fg-layout' "${base_dir}" || true)"

if [[ -n "${violations}" ]]; then
    echo "ERROR: Base CSS names a specific layout."
    echo "Layouts opt into shared base rules through a capability marker on the wrapper."
    echo
    echo "${violations}"
    exit 1
fi

echo "OK: Base CSS names no layout."
