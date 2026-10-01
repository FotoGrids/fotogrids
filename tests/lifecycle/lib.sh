#!/usr/bin/env bash
# Scratch installs and assertions for the lifecycle scenarios.
#
# A scenario gets its own WordPress and its own database, wrecks them however it
# needs to, and they are dropped afterwards. `$WP` runs WP-CLI against it.

set -uo pipefail

FG_LIFECYCLE_FAILURES=0

# --- assertions -------------------------------------------------------------

fail() {
	echo "    FAIL: $*"
	FG_LIFECYCLE_FAILURES=$(( FG_LIFECYCLE_FAILURES + 1 ))
}

pass() {
	echo "    ok: $*"
}

assert_eq() {
	local expected="$1" actual="$2" what="$3"

	if [ "$expected" = "$actual" ]; then
		pass "$what"
	else
		fail "$what — expected '$expected', got '$actual'"
	fi
}

assert_contains() {
	local haystack="$1" needle="$2" what="$3"

	case "$haystack" in
		*"$needle"*) pass "$what" ;;
		*) fail "$what — '$needle' missing from '$haystack'" ;;
	esac
}

# --- the scratch install ----------------------------------------------------

# A WordPress of its own, with the plugin active. Reuses the core already
# downloaded by boot.sh rather than fetching one per scenario.
scratch_install() {
	local name="$1"
	local source_wp="$FG_WP_SOURCE"

	SCRATCH_DIR="$FG_SCRATCH_ROOT/$name"
	SCRATCH_DB="fg_life_$name"

	rm -rf "$SCRATCH_DIR"
	mkdir -p "$SCRATCH_DIR"
	cp -a "$source_wp"/. "$SCRATCH_DIR"/
	rm -f "$SCRATCH_DIR/wp-config.php"

	mysql $FG_MYSQL_ARGS -e \
		"DROP DATABASE IF EXISTS \`$SCRATCH_DB\`; CREATE DATABASE \`$SCRATCH_DB\`;"

	WP="php $FG_WP_CLI --allow-root --path=$SCRATCH_DIR"

	$WP config create --force --dbname="$SCRATCH_DB" --dbuser="$FG_DB_USER" \
		--dbpass="$FG_DB_PASS" --dbhost="$FG_DB_HOST_ARG" --skip-check --quiet
	$WP core install --url=http://127.0.0.1:8899 --title="FotoGrids lifecycle" \
		--admin_user=admin --admin_password=password \
		--admin_email=test@example.com --skip-email --quiet
}

# Separate from the install, so a scenario can assert on the before state.
scratch_activate() {
	$WP plugin activate fotogrids --quiet
}

scratch_teardown() {
	mysql $FG_MYSQL_ARGS -e "DROP DATABASE IF EXISTS \`$SCRATCH_DB\`;" || true
	rm -rf "$SCRATCH_DIR"
}
