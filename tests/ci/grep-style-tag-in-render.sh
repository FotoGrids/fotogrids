#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
plugin_root="$(cd "${script_dir}/../.." && pwd)"

free_render_dir="${plugin_root}/src/public/render"
pro_render_dir="${plugin_root}/../Pro/src/public/render"
free_public_render_file="${plugin_root}/src/public/public-render.php"

violations="$(
    rg --line-number --no-heading --color=never --glob '*.php' \
        '<style\b' \
        "${free_render_dir}" "${pro_render_dir}" "${free_public_render_file}" \
    | rg --line-number --no-heading --color=never -v 'fg-vars' \
    || true
)"

if [[ -n "${violations}" ]]; then
    echo "ERROR: Inline <style> output detected in render path."
    echo "Render path must emit CSS variables and module assets, not inline style tags."
    echo
    echo "${violations}"
    exit 1
fi

echo "OK: No inline <style> tags in render path."
