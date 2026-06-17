#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
plugin_root="$(cd "${script_dir}/../.." && pwd)"

free_render_dir="${plugin_root}/src/public/render"
pro_render_dir="${plugin_root}/../Pro/src/public/render"
free_public_render_file="${plugin_root}/src/public/public-render.php"

scan_targets=()
[[ -d "${free_render_dir}" ]] && scan_targets+=( "${free_render_dir}" )
[[ -d "${pro_render_dir}" ]] && scan_targets+=( "${pro_render_dir}" )
[[ -f "${free_public_render_file}" ]] && scan_targets+=( "${free_public_render_file}" )

# Sanctioned inline <style> emitters. These deliberately output a scoped <style>
# block carrying CSS variables or scoped custom CSS, which is the supported
# mechanism rather than a violation:
#   - fg-vars / --fg-   : per-instance CSS-variable blocks
#   - fg-custom-css     : the custom-code feature's scoped user CSS block
# The gate renderer builds its <style> across several concatenated sprintf
# lines (the opening '<style>' line carries no marker), so it is allowlisted by
# file rather than by inline marker.
sanctioned_markers='fg-vars|--fg-|fg-custom-css'
sanctioned_files='class-gate-renderer\.php'

# Match <style in real code only: drop lines whose content (the part after
# "path:line:") begins with a comment marker (*, //, /*), so docblock and
# inline-comment mentions of <style> are not treated as output.
violations="$(
    grep --recursive --line-number --include='*.php' --extended-regexp \
        '<style\b' \
        "${scan_targets[@]}" \
    | grep --invert-match --extended-regexp ':[[:space:]]*(\*|//|/\*)' \
    | grep --invert-match --extended-regexp "${sanctioned_markers}" \
    | grep --invert-match --extended-regexp "${sanctioned_files}" \
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
