#!/usr/bin/env bash
# Fetch the WordPress and the core test includes the DB suite boots against.
#
#   tests/phpunit-db/install-wp.sh [version]
#
# Both come from wordpress.org, so a local run and CI get the same bytes. The
# core tarball does not contain the test suite, which lives only in the
# development repository - hence the two downloads.

set -euo pipefail

VERSION="${1:-${FG_TESTS_WP_VERSION:-6.8}}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${FG_TESTS_WP_DIR:-$HERE/.wp}"

CORE="$DEST/$VERSION/wordpress"
INCLUDES="$DEST/$VERSION/tests/includes"

if [ -f "$CORE/wp-settings.php" ] && [ -f "$INCLUDES/bootstrap.php" ]; then
	echo "$DEST/$VERSION"
	exit 0
fi

mkdir -p "$CORE" "$INCLUDES"

echo "Downloading WordPress $VERSION" >&2
curl -fsSL "https://wordpress.org/wordpress-${VERSION}.tar.gz" \
	| tar xz -C "$CORE" --strip-components=1

echo "Downloading the $VERSION test includes" >&2
BASE="https://develop.svn.wordpress.org/tags/$VERSION/tests/phpunit/includes"
python3 - "$BASE" "$INCLUDES" <<'PY'
import os, posixpath, re, sys, urllib.request

base, out = sys.argv[1].rstrip('/') + '/', sys.argv[2]

def fetch(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read()

def walk(url, directory):
    os.makedirs(directory, exist_ok=True)
    listing = fetch(url).decode('utf8', 'replace')
    for href in re.findall(r'<li><a href="([^"]+)">', listing):
        if href.startswith('..') or href.startswith('/'):
            continue
        target = posixpath.join(url, href)
        if href.endswith('/'):
            walk(target, os.path.join(directory, href.rstrip('/')))
        else:
            with open(os.path.join(directory, href), 'wb') as handle:
                handle.write(fetch(target))

walk(base, out)
PY

echo "$DEST/$VERSION"
