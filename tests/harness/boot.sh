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
    else
      report "test site" "'$SITE' NOT FOUND - create an empty LocalWP site with that name"
    fi
  else
    report "sites dir" "not found at $LOCAL_SITES_DIR"
  fi

  step "Plugin build"
  if [ -d "$REPO_DIR/dist/fotogrids" ]; then
    report "dist/fotogrids" "present"
  elif [ -d "$REPO_DIR/dist" ]; then
    report "dist/fotogrids" "MISSING - will be staged from dist/ on boot"
  else
    report "dist" "MISSING - run: npm run build:dev"
  fi

  step "Verdict"
  if [ -d "$LOCAL_SITES_DIR/$SITE" ] && in_local_shell; then
    say "  Ready. Run: ./tests/harness/boot.sh --mode=local"
  elif [ -d "$LOCAL_SITES_DIR/$SITE" ]; then
    say "  The '$SITE' site exists, but this is not LocalWP's site shell, so"
    say "  its wp-cli is not on PATH. In LocalWP, right-click '$SITE' and choose"
    say "  'Open site shell', then run: ./tests/harness/boot.sh --mode=local"
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

# The plugin must be staged as dist/fotogrids/ so the directory name matches
# the slug - the same layout zip:prod produces.
stage_plugin() {
  [ -d "$REPO_DIR/dist" ] || die "no dist/ - run 'npm run build:dev' first"
  if [ ! -d "$REPO_DIR/dist/fotogrids" ]; then
    step "Staging dist/fotogrids"
    mkdir -p "$REPO_DIR/dist/fotogrids"
    find "$REPO_DIR/dist" -mindepth 1 -maxdepth 1 ! -name fotogrids \
      -exec cp -R {} "$REPO_DIR/dist/fotogrids/" \;
  fi
}

write_env() {
  # These are the names the specs already read, so nothing in tests/e2e/ has to
  # know a harness exists. WP_CLI is the command alone; the install path goes in
  # WP_PATH so a path with spaces in it survives - LocalWP keeps its sites under
  # "~/Local Sites". Values are quoted because an unquoted assignment containing
  # a space is parsed under `set -a` as an assignment followed by a command.
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

# Run wp-cli with the site as the working directory.
#
# LocalWP's php resolves its php.ini relative to where it is invoked. Run it
# from anywhere else - the repo, say - and it loads whatever php.ini the machine
# has instead: extensions built for a different PHP version fail to load, and,
# less visibly, mysqli gets the wrong default socket, so every wp call dies with
# "Error establishing a database connection". Nothing about --path fixes that,
# because the problem is the interpreter's configuration and not WordPress's.
wp_local() {
  local dir="$1"
  shift
  ( cd "$dir" && wp --path="$dir" "$@" )
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

  have wp || die "wp-cli not on PATH. Open LocalWP > right-click the site > 'Open site shell', and run this from there."

  wp_local "$public_dir" option get siteurl >/dev/null 2>&1 || die \
    "wp-cli reached $SITE but not its database. Is the site started in LocalWP?"

  stage_plugin

  step "Linking the built plugin into $SITE"
  local target="$public_dir/wp-content/plugins/fotogrids"
  rm -rf "$target"
  ln -s "$REPO_DIR/dist/fotogrids" "$target"

  step "Activating"
  wp_local "$public_dir" plugin activate fotogrids

  # ci mode installs WordPress and so picks the credentials; local mode inherits
  # a site someone else created, and there is no way to read a password back out
  # of WordPress. So it sets one. The specs get a login that always works, and
  # the site keeps whatever username it was created with.
  local admin_user admin_pass
  admin_user="${FG_ADMIN_USER:-}"
  if [ -z "$admin_user" ]; then
    admin_user=$(wp_local "$public_dir" user list --role=administrator \
      --field=user_login --number=1 2>/dev/null | head -1)
  fi
  [ -n "$admin_user" ] || die "no administrator in $SITE - is it a finished WordPress install?"
  admin_pass="${FG_ADMIN_PASS:-password}"

  step "Setting $admin_user's password so the specs can log in"
  wp_local "$public_dir" user update "$admin_user" --user_pass="$admin_pass" --quiet

  local url
  url=$(wp_local "$public_dir" option get siteurl)
  write_env local "$url" "wp" "$public_dir" "$admin_user" "$admin_pass"
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

  if [ ! -f "$STATE_DIR/wp-cli.phar" ]; then
    step "Fetching wp-cli"
    curl -sSL -o "$STATE_DIR/wp-cli.phar" \
      https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
  fi
  # WP_CLI in .env carries the command without --path; see write_env.
  local WP_CMD="php $STATE_DIR/wp-cli.phar --allow-root"
  local WP="$WP_CMD --path=$wp_dir"

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
  # admin/password are wp-env's defaults, which tests/e2e/helpers.ts falls back
  # to. Diverging here makes every spec that logs in fail on this harness only.
  $WP core install --url="$url" --title="FotoGrids test" \
    --admin_user="$admin_user" --admin_password="$admin_pass" \
    --admin_email=test@example.com --skip-email

  # wp core install derives siteurl from the docroot when --url is ambiguous;
  # set both explicitly or auth cookies are issued for the wrong host and every
  # login silently bounces back to wp-login.php.
  $WP option update siteurl "$url"
  $WP option update home "$url"
  $WP rewrite structure '/%postname%/' --hard

  stage_plugin
  step "Linking the built plugin"
  rm -rf "$wp_dir/wp-content/plugins/fotogrids"
  ln -s "$REPO_DIR/dist/fotogrids" "$wp_dir/wp-content/plugins/fotogrids"
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

  write_env ci "$url" "$WP_CMD" "$wp_dir" "$admin_user" "$admin_pass"
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
