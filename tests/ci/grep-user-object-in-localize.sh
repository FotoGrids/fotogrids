#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
plugin_root="$(cd "${script_dir}/../.." && pwd)"

free_includes_dir="${plugin_root}/src/includes"
free_public_dir="${plugin_root}/src/public"
pro_src_dir="${plugin_root}/../Pro/src"

scan_targets=()
[[ -d "${free_includes_dir}" ]] && scan_targets+=( "${free_includes_dir}" )
[[ -d "${free_public_dir}" ]] && scan_targets+=( "${free_public_dir}" )
[[ -d "${pro_src_dir}" ]] && scan_targets+=( "${pro_src_dir}" )

# A WP_User carries the raw wp_users row on its public $data property, so any
# user object used directly as an array value reaches the browser complete with
# user_pass, user_email and user_activation_key once the array is JSON-encoded
# for wp_localize_script, wp_add_inline_script or a REST response. Assign the
# object to a variable and build an explicit projection instead.
user_object_sources='wp_get_current_user\(\)|get_userdata\(|get_user_by\('

violations="$(
    grep --recursive --line-number --include='*.php' --extended-regexp \
        "=>[[:space:]]*(${user_object_sources})" \
        "${scan_targets[@]}" \
    | grep --invert-match --extended-regexp ':[[:space:]]*(\*|//|/\*)' \
    || true
)"

if [[ -n "${violations}" ]]; then
    echo "ERROR: WP_User object used directly as an array value."
    echo "A user object serialises its whole wp_users row, including the password hash."
    echo "Build an explicit projection of the fields the consumer reads."
    echo
    echo "${violations}"
    exit 1
fi

echo "OK: No WP_User objects used as array values."
