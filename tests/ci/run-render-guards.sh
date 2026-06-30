#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "${script_dir}/grep-license-in-render.sh"
bash "${script_dir}/grep-style-tag-in-render.sh"

echo "OK: Render CI guards passed."
