#!/usr/bin/env bash
#
# Boots a WordPress with the built FotoGrids plugin active and prints where it
# is. Everything the test suite needs to exist before Playwright starts.
#
#   ./tests/harness/boot.sh --doctor        report what this machine has
#   ./tests/harness/boot.sh                 auto-detect a mode and boot
#   ./tests/harness/boot.sh --mode=local    LocalWP site on macOS
#   ./tests/harness/boot.sh --mode=ci       throwaway install against MySQL
#   ./tests/harness/boot.sh --stop          stop a ci-mode server
#
# Writes tests/harness/.env with WP_BASE_URL, WP_CLI, WP_PATH and the admin
# credentials - the names tests/e2e/ already reads, so the specs never learn
# which mode booted them.
#
# Portability: this runs on macOS as often as on Linux, so it stays inside
# POSIX tool behaviour - no `sed -i` without an argument, no `readlink -f`,
# no `grep -P`, no GNU-only flags.

set -euo pipefail

FG_LOCAL_PHP=""
WP_SHIM=""

HARNESS_DIR=$(cd -- "$(dirname -- "$0")" && pwd -P)
REPO_DIR=$(cd -- "$HARNESS_DIR/../.." && pwd -P)
ENV_FILE="$HARNESS_DIR/.env"
STATE_DIR="${FG_HARNESS_STATE:-$HARNESS_DIR/.state}"

MODE=""
SITE="${FG_LOCAL_SITE:-fotogrids-tests}"
WP_VERSION="${FG_WP_VERSION:-latest}"
FRESH=0
FORCE_SITE=0

# LocalWP keeps its sites here. Overridable for a non-default install.
LOCAL_SITES_DIR="${FG_LOCAL_SITES_DIR:-$HOME/Local Sites}"

say()  { printf '%s\n' "$*" >&2; }
step() { printf '\033[1m==>\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

usage() {
  sed -n '3,17p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

for arg in "$@"; do
  case "$arg" in
    --mode=*)  MODE="${arg#*=}" ;;
    --site=*)  SITE="${arg#*=}" ;;
    --wp=*)    WP_VERSION="${arg#*=}" ;;
    --fresh)   FRESH=1 ;;
    --force-site) FORCE_SITE=1 ;;
    --doctor)  MODE="doctor" ;;
    --stop)    MODE="stop" ;;
    -h|--help) usage ;;
    *) die "unknown argument: $arg (try --help)" ;;
  esac
done

# ---------------------------------------------------------------------------
# doctor - report the environment, change nothing
# ---------------------------------------------------------------------------

report() { printf '  %-22s %s\n' "$1" "$2" >&2; }

# True when this shell is LocalWP's site shell, which puts LocalWP's own php,
# mysql and wp on PATH. Outside it, `php` is the system one, which is not what
# runs the site in local mode.
in_local_shell() {
  case "$(command -v php 2>/dev/null)" in
    *lightning-services*|*Local.app*|*"Local/"*) return 0 ;;
    *) return 1 ;;
  esac
}

doctor() {
  local shell_kind="system"
  in_local_shell && shell_kind="LocalWP site shell"

  step "This shell ($shell_kind)"
  report "uname"    "$(uname -s) $(uname -m)"
  report "bash"     "${BASH_VERSION:-unknown}"
  report "php"      "$(have php && php -r 'echo PHP_VERSION;' || echo 'MISSING')"
  report "  from"   "$(command -v php 2>/dev/null || echo '-')"
  report "mysql"    "$(have mysql && mysql --version | sed 's/.*Distrib //;s/,.*//' || echo 'MISSING')"
  report "wp-cli"   "$(have wp && wp --version --allow-root 2>/dev/null | head -1 || echo 'MISSING')"
  report "  its php"  "$(local_php 2>/dev/null || command -v php 2>/dev/null || echo '-')"
  report "curl"     "$(have curl && echo present || echo 'MISSING')"
  report "node"     "$(have node && node -v || echo 'MISSING')"

  if have php; then
    step "PHP extensions ($shell_kind php)"
    for ext in mysqli gd exif zip mbstring xml curl; do
      if php -m | grep -qx "$ext"; then report "$ext" "ok"; else report "$ext" "MISSING"; fi
    done
    if ! in_local_shell; then
      say "  These belong to the php on PATH. In local mode LocalWP runs the"
      say "  site with its own php, so a MISSING here does not affect it - only"
      say "  ci mode, which uses this one."
    fi
  fi

  step "LocalWP"
  if [ -d "$LOCAL_SITES_DIR" ]; then
    report "sites dir" "$LOCAL_SITES_DIR"
    ls -1 "$LOCAL_SITES_DIR" 2>/dev/null | while IFS= read -r s; do
      if [ "$s" = "$SITE" ]; then report "  $s" "<- test site"; else report "  $s" ""; fi
    done
    if [ -d "$LOCAL_SITES_DIR/$SITE" ]; then
      report "test site" "found"
      local facts
      facts="$(local_site_facts "$SITE" || true)"
      if [ -n "$facts" ]; then
        report "  runs php" "$(printf '%s' "$facts" | cut -d' ' -f2) (local mode uses this one, whatever PATH says)"
      else
        report "  runs php" "not in sites.json - local mode will fall back to PATH"
      fi
    else
      report "test site" "'$SITE' NOT FOUND - create an empty LocalWP site with that name"
    fi
  else
    report "sites dir" "not found at $LOCAL_SITES_DIR"
  fi

  step "Plugin build"
  if [ -f "$REPO_DIR/dist/fotogrids.php" ]; then
    report "dist/" "built $(date -r "$REPO_DIR/dist/fotogrids.php" '+%Y-%m-%d %H:%M' 2>/dev/null)"
  else
    report "dist/" "MISSING - run: npm run build:dev"
  fi
  report "  staged as" "dist/fotogrids/ (re-synced on every boot)"

  step "Verdict"
  if [ -d "$LOCAL_SITES_DIR/$SITE" ]; then
    say "  Ready. Run: ./tests/harness/boot.sh --mode=local"
    if [ -z "$(local_site_facts "$SITE" || true)" ]; then
      say ""
      say "  LocalWP's sites.json does not list '$SITE', so the harness cannot"
      say "  find the php that serves it and will use whatever is on PATH. Run"
      say "  this from the site shell (right-click the site > 'Open site shell')"
      say "  if anything behaves oddly."
    fi
  else
    say "  Create an empty LocalWP site named '$SITE', then run this again from"
    say "  that site's shell. Set FG_LOCAL_SITE to use a different name."
    if have php && have mysql; then
      say ""
      say "  ci mode also works in this shell: ./tests/harness/boot.sh --mode=ci"
    fi
  fi
}

# ---------------------------------------------------------------------------
# shared
# ---------------------------------------------------------------------------

# Stage the build as dist/fotogrids/ and point a WordPress install at it.
#
# Two constraints, both load-bearing:
#
# - The staged directory must be named fotogrids. Freemius resolves its SDK
#   against the plugin directory's real name (start.php derives WP_FS__DIR from
#   the resolved symlink), so linking plugins/fotogrids at dist/ makes it
#   require <dist>/fotogrids/freemius and fatal the site.
# - The sync is unconditional. `npm run build:dev` writes to dist/, never into
#   this copy, so staging it only when absent pins the site to whatever was
#   built first and the suite silently tests code the repo no longer has.
link_plugin() {
  local target="$1"
  local staged="$REPO_DIR/dist/fotogrids"
  [ -f "$REPO_DIR/dist/fotogrids.php" ] || \
    die "no dist/fotogrids.php - run 'npm run build:dev' first"

  rm -rf "$staged"
  mkdir -p "$staged"
  if have rsync; then
    rsync -a --delete --exclude '/fotogrids/' "$REPO_DIR/dist/" "$staged/"
  else
    find "$REPO_DIR/dist" -mindepth 1 -maxdepth 1 ! -name fotogrids \
      -exec cp -R {} "$staged/" \;
  fi

  rm -rf "$target"
  ln -s "$staged" "$target"
}

fetch_wp_cli() {
  mkdir -p "$STATE_DIR"
  if [ ! -f "$STATE_DIR/wp-cli.phar" ]; then
    step "Fetching wp-cli"
    curl -sSL -o "$STATE_DIR/wp-cli.phar" \
      https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
  fi
}

# Single-quote a value for embedding in the generated shim.
sq() {
  printf "%s" "$1" | sed "s/'/'\\\\''/g"
}

# Write .state/wp: the one way this harness and the specs invoke wp-cli.
#
# It pins three things that a shell otherwise decides by accident. The php,
# because PATH order is not ours to control and the site's php is the only one
# whose behaviour we care about. The install path, because --path on its own is
# not enough - LocalWP's php resolves its php.ini relative to the working
# directory, so wp-cli run from the repo picks up a different configuration
# entirely and cannot even reach the database. And display_errors, because PHP
# writes startup warnings to *stdout*, where anything reading a value back out
# of wp-cli captures them as if they were the value.
#
# It is a file rather than a string in .env so that a path containing a space
# survives being handed to execFileSync - LocalWP keeps its sites under
# "~/Local Sites".
write_wp_shim() {
  local php="$1" wp_path="$2" extra="${3:-}" phprc="${4:-}" sock="${5:-}"
  local env_line="" ini=""
  if [ -n "$phprc" ]; then
    env_line="PHPRC='$(sq "$phprc")'; export PHPRC"
  fi
  if [ -n "$sock" ]; then
    ini="-d mysqli.default_socket='$(sq "$sock")' -d pdo_mysql.default_socket='$(sq "$sock")'"
  fi
  mkdir -p "$STATE_DIR"
  # Not .state/wp - that is the WordPress install directory in ci mode.
  cat > "$STATE_DIR/wp-shim" <<EOF
#!/bin/sh
# Generated by tests/harness/boot.sh - do not edit, do not commit.
cd '$(sq "$wp_path")' || exit 1
$env_line
exec '$(sq "$php")' -d display_errors=stderr $ini '$(sq "$STATE_DIR/wp-cli.phar")' \
  --path='$(sq "$wp_path")' $extra "\$@"
EOF
  chmod +x "$STATE_DIR/wp-shim"
  WP_SHIM="$STATE_DIR/wp-shim"
}

write_env() {
  # These are the names the specs already read, so nothing in tests/e2e/ has to
  # know a harness exists. WP_CLI is the shim written by write_wp_shim: one
  # executable, no arguments to parse, php and install path already pinned.
  # Values are quoted because an unquoted assignment containing a space is
  # parsed under `set -a` as an assignment followed by a command.
  cat > "$ENV_FILE" <<EOF
# Written by tests/harness/boot.sh - do not edit, do not commit.
FG_MODE="$1"
WP_BASE_URL="$2"
WP_CLI="$3"
WP_PATH="$4"
WP_ADMIN_USER="${5:-admin}"
WP_ADMIN_PASS="${6:-password}"
EOF
  step "Wrote $ENV_FILE"
  cat "$ENV_FILE" >&2
}

# ---------------------------------------------------------------------------
# local - a LocalWP site on macOS
# ---------------------------------------------------------------------------

# The php LocalWP serves the site with, located on PATH.
#
# PATH order does not settle this: the site shell prepends LocalWP's bin
# directories, then a shell profile can prepend another php in front of them.
# wp-cli would then run a php the site never serves, while still loading
# LocalWP's php.ini - whose extensions are built for the other version and all
# fail to load. LocalWP's binary is still on PATH, just later.
# A site's LocalWP runtime: its opaque run-directory id, and its php version.
#
# sites.json is the only place both are recorded, and with them the harness can
# address LocalWP's php, php.ini and mysql socket directly - so PATH never has
# to be right and the site shell is not a prerequisite. Needs node, which this
# repo requires anyway.
LOCAL_ROOT="$HOME/Library/Application Support/Local"

local_site_facts() {
  LOCAL_ROOT="$LOCAL_ROOT" node -e '
    const fs = require("fs");
    const sites = JSON.parse(
      fs.readFileSync(process.env.LOCAL_ROOT + "/sites.json", "utf8")
    );
    for (const [id, site] of Object.entries(sites)) {
      if (site && site.name === process.argv[1]) {
        const php =
          (site.services && site.services.php && site.services.php.version) || "";
        console.log(id + " " + php);
        process.exit(0);
      }
    }
    process.exit(1);
  ' "$1" 2>/dev/null
}

# Fallback for when sites.json cannot be read: LocalWP puts its php on PATH
# inside the site shell, after whatever the user's profile prepended.
local_php() {
  local saved_ifs="$IFS" dir
  IFS=:
  for dir in $PATH; do
    case "$dir" in
      *lightning-services/php-*)
        if [ -x "$dir/php" ]; then
          IFS="$saved_ifs"
          printf '%s\n' "$dir/php"
          return 0
        fi
        ;;
    esac
  done
  IFS="$saved_ifs"
  return 1
}


boot_local() {
  local site_dir="$LOCAL_SITES_DIR/$SITE"
  local public_dir="$site_dir/app/public"

  if [ ! -d "$public_dir" ]; then
    say ""
    say "No LocalWP site named '$SITE'."
    say ""
    say "Create an empty site with that name in LocalWP, then re-run. It must be"
    say "a site you do not develop in: the fixture seeder truncates the FotoGrids"
    say "tables and deletes every gallery and album post."
    say ""
    say "To target a different site anyway: --site=NAME --force-site"
    die "test site not found"
  fi

  if [ "$SITE" != "${FG_LOCAL_SITE:-fotogrids-tests}" ] && [ "$FORCE_SITE" -ne 1 ]; then
    die "refusing to touch '$SITE' without --force-site (the seeder is destructive)"
  fi

  local phprc="" sock="" facts="" site_id="" php_ver=""
  facts="$(local_site_facts "$SITE" || true)"
  if [ -n "$facts" ]; then
    site_id="$(printf '%s' "$facts" | cut -d' ' -f1)"
    php_ver="$(printf '%s' "$facts" | cut -d' ' -f2)"
    FG_LOCAL_PHP="$(ls "$LOCAL_ROOT"/lightning-services/php-"$php_ver"+*/bin/*/bin/php 2>/dev/null | head -1)"
    phprc="$LOCAL_ROOT/run/$site_id/conf/php"
    sock="$LOCAL_ROOT/run/$site_id/mysql/mysqld.sock"
    [ -d "$phprc" ] || phprc=""
    [ -S "$sock" ] || sock=""
  fi

  if [ -n "$FG_LOCAL_PHP" ]; then
    step "Using LocalWP's php $php_ver for $SITE"
  else
    FG_LOCAL_PHP="$(local_php || command -v php || true)"
    [ -n "$FG_LOCAL_PHP" ] || die "no php found. Open LocalWP > right-click '$SITE' > 'Open site shell' and run this from there."
    say "  note: could not resolve LocalWP's own php for '$SITE'; using $FG_LOCAL_PHP."
  fi

  fetch_wp_cli
  write_wp_shim "$FG_LOCAL_PHP" "$public_dir" "" "$phprc" "$sock"

  # Before the probe, not after: a broken link left by a previous run fatals the
  # site, and the probe would then blame the database.
  step "Linking the built plugin into $SITE"
  link_plugin "$public_dir/wp-content/plugins/fotogrids"

  # Print wp-cli's own output. "Cannot reach the database" covers a stopped
  # site, a wrong socket and the wrong php.ini, which need different fixes, and
  # only wp-cli's message distinguishes them.
  local probe
  if ! probe=$( "$WP_SHIM" option get siteurl 2>&1 ); then
    say ""
    say "wp-cli could not read $SITE's site URL. It said:"
    say ""
    printf '%s\n' "$probe" | sed 's/^/    /' >&2
    say ""
    say "  php:    $FG_LOCAL_PHP"
    say "  phprc:  ${phprc:-<none>}"
    say "  socket: ${sock:-<none>}"
    say "  shim:   $WP_SHIM"
    die "cannot reach $SITE's database - is the site started in LocalWP?"
  fi

  step "Activating"
  "$WP_SHIM" plugin activate fotogrids

  # ci mode installs WordPress and so picks the credentials; local mode inherits
  # a site someone else created, and there is no way to read a password back out
  # of WordPress. So it sets one. The specs get a login that always works, and
  # the site keeps whatever username it was created with.
  local admin_user admin_pass
  admin_user="${FG_ADMIN_USER:-}"
  if [ -z "$admin_user" ]; then
    # tail, not head: head closes the pipe early, wp-cli takes SIGPIPE, and
    # under `set -e -o pipefail` that ends the script silently.
    admin_user=$( "$WP_SHIM" user list --role=administrator \
      --field=user_login --number=1 2>/dev/null | tail -n 1 || true )
  fi
  [ -n "$admin_user" ] || die "no administrator in $SITE - is it a finished WordPress install?"
  admin_pass="${FG_ADMIN_PASS:-password}"

  step "Setting $admin_user's password so the specs can log in"
  "$WP_SHIM" user update "$admin_user" --user_pass="$admin_pass" --quiet

  local url
  url=$( "$WP_SHIM" option get siteurl )
  write_env local "$url" "$WP_SHIM" "$public_dir" "$admin_user" "$admin_pass"
}

# ---------------------------------------------------------------------------
# ci - a throwaway install against a MySQL that already exists
# ---------------------------------------------------------------------------

boot_ci() {
  local db_host="${FG_DB_HOST:-127.0.0.1}"
  local db_port="${FG_DB_PORT:-3306}"
  local db_socket="${FG_DB_SOCKET:-}"
  local db_name="${FG_DB_NAME:-fotogrids_test}"
  local db_user="${FG_DB_USER:-root}"
  local db_pass="${FG_DB_PASS:-}"
  local port="${FG_PORT:-8899}"
  local admin_user="${FG_ADMIN_USER:-admin}"
  local admin_pass="${FG_ADMIN_PASS:-password}"
  local wp_dir="$STATE_DIR/wp"
  local url="http://127.0.0.1:$port"

  have php || die "php not on PATH"

  local mysql_args
  if [ -n "$db_socket" ]; then
    mysql_args="--socket=$db_socket"
    db_host="localhost:$db_socket"
  else
    mysql_args="--host=$db_host --port=$db_port"
  fi
  [ -n "$db_pass" ] && mysql_args="$mysql_args --password=$db_pass"

  [ "$FRESH" -eq 1 ] && rm -rf "$STATE_DIR"
  mkdir -p "$STATE_DIR"

  fetch_wp_cli
  local WP="php $STATE_DIR/wp-cli.phar --allow-root --path=$wp_dir"

  if [ ! -f "$wp_dir/wp-settings.php" ]; then
    step "Downloading WordPress ($WP_VERSION)"
    mkdir -p "$wp_dir"
    php "$STATE_DIR/wp-cli.phar" --allow-root --path="$wp_dir" \
      core download --version="$WP_VERSION" --force
  fi

  step "Creating the database"
  mysql $mysql_args -u "$db_user" \
    -e "DROP DATABASE IF EXISTS \`$db_name\`; CREATE DATABASE \`$db_name\`;"

  step "Configuring"
  $WP config create --force --dbname="$db_name" --dbuser="$db_user" \
    --dbpass="$db_pass" --dbhost="$db_host" --skip-check \
    --extra-php <<'PHP'
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', true );
define( 'WP_DEBUG_DISPLAY', false );
define( 'DISABLE_WP_CRON', true );
PHP

  step "Installing"
  # admin/password are the credentials tests/e2e/helpers.ts falls back to.
  # Diverging here makes every spec that logs in fail on this harness only.
  $WP core install --url="$url" --title="FotoGrids test" \
    --admin_user="$admin_user" --admin_password="$admin_pass" \
    --admin_email=test@example.com --skip-email

  # wp core install derives siteurl from the docroot when --url is ambiguous;
  # set both explicitly or auth cookies are issued for the wrong host and every
  # login silently bounces back to wp-login.php.
  $WP option update siteurl "$url"
  $WP option update home "$url"
  $WP rewrite structure '/%postname%/' --hard


  step "Linking the built plugin"
  rm -rf "$wp_dir/wp-content/plugins/fotogrids"
  link_plugin "$wp_dir/wp-content/plugins/fotogrids"
  $WP plugin activate fotogrids

  step "Serving on $url"
  # php -S is single-threaded; without workers, parallel requests from
  # Playwright get ERR_CONNECTION_RESET rather than a response.
  # Detached, so the server outlives this script and Playwright can use it.
  PHP_CLI_SERVER_WORKERS="${FG_PHP_WORKERS:-8}" \
    nohup php -S "127.0.0.1:$port" -t "$wp_dir" "$HARNESS_DIR/router.php" \
    >"$STATE_DIR/server.log" 2>&1 </dev/null &
  echo $! > "$STATE_DIR/server.pid"
  disown 2>/dev/null || true

  local tries=0
  until curl -fs -o /dev/null "$url/wp-login.php"; do
    tries=$((tries + 1))
    [ "$tries" -gt 40 ] && { tail -20 "$STATE_DIR/server.log" >&2; die "server did not come up"; }
    sleep 0.25
  done

  # The install exists by now, so the shim can cd into it.
  write_wp_shim "$(command -v php)" "$wp_dir" "--allow-root"
  write_env ci "$url" "$WP_SHIM" "$wp_dir" "$admin_user" "$admin_pass"
}

# ---------------------------------------------------------------------------

if [ -z "$MODE" ]; then
  if [ -d "$LOCAL_SITES_DIR/$SITE" ]; then MODE=local; else MODE=ci; fi
  step "Auto-detected mode: $MODE"
fi

stop_server() {
  if [ -f "$STATE_DIR/server.pid" ]; then
    kill "$(cat "$STATE_DIR/server.pid")" 2>/dev/null || true
    rm -f "$STATE_DIR/server.pid"
    step "Stopped the server"
  else
    step "Nothing running"
  fi
  rm -f "$ENV_FILE"
}

case "$MODE" in
  doctor) doctor ;;
  stop)   stop_server ;;
  local)  boot_local ;;
  ci)     boot_ci ;;
  *)      die "unknown mode: $MODE" ;;
esac
