#!/usr/bin/env bash
# Scratch installs and assertions for the lifecycle scenarios.
#
# A scenario gets its own WordPress and its own database, wrecks them however it
# needs to, and they are dropped afterwards. `$WP` runs WP-CLI against it.

set -uo pipefail

FG_LIFECYCLE_FAILURES=0

# The tables the plugin owns, without the `wp_fotogrids_` prefix. Named rather
# than discovered, so adding or dropping one is a deliberate edit here. Exported
# so `wp eval` can read the list instead of having it interpolated into PHP.
export FG_TABLES="item_meta statistics statistics_daily gallery_albums tags item_metadata render_cache"
FG_TABLE_COUNT=$( set -- $FG_TABLES; echo $# )

# The subset that holds site data. `render_cache` is derived and expires on its
# own, so a row that asserts nothing was lost must not count it.
export FG_DATA_TABLES="item_meta statistics statistics_daily gallery_albums tags item_metadata"
FG_DATA_TABLE_COUNT=$( set -- $FG_DATA_TABLES; echo $# )

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

SCRATCH_URL="http://127.0.0.1:8899"

# The files, the database and wp-config, up to the point where a single site and
# a network diverge. Reuses the core already downloaded by boot.sh rather than
# fetching one per scenario.
scratch_stage() {
	local name="$1"
	local source_wp="$FG_WP_SOURCE"

	SCRATCH_DIR="$FG_SCRATCH_ROOT/$name"
	SCRATCH_DB="fg_life_$name"

	rm -rf "$SCRATCH_DIR"
	mkdir -p "$SCRATCH_DIR"
	cp -a "$source_wp"/. "$SCRATCH_DIR"/
	rm -f "$SCRATCH_DIR/wp-config.php"

	# The harness installs the plugin as a symlink into the shared build. Copied
	# through here, so a scenario that moves or edits a plugin file wrecks its
	# own install and not the build every other test runs against.
	if [ -L "$SCRATCH_DIR/wp-content/plugins/fotogrids" ]; then
		local linked
		linked="$( readlink -f "$SCRATCH_DIR/wp-content/plugins/fotogrids" )"
		rm -f "$SCRATCH_DIR/wp-content/plugins/fotogrids"
		cp -rL "$linked" "$SCRATCH_DIR/wp-content/plugins/fotogrids"
	fi

	mysql $FG_MYSQL_ARGS -e \
		"DROP DATABASE IF EXISTS \`$SCRATCH_DB\`; CREATE DATABASE \`$SCRATCH_DB\`;"

	WP="php $FG_WP_CLI --allow-root --path=$SCRATCH_DIR"

	$WP config create --force --dbname="$SCRATCH_DB" --dbuser="$FG_DB_USER" \
		--dbpass="$FG_DB_PASS" --dbhost="$FG_DB_HOST_ARG" --skip-check --quiet
}

# A WordPress of its own, with the plugin ready to activate.
scratch_install() {
	scratch_stage "$1"

	$WP core install --url="$SCRATCH_URL" --title="FotoGrids lifecycle" \
		--admin_user=admin --admin_password=password \
		--admin_email=test@example.com --skip-email --quiet
}

# A subdirectory network of three sites. Sites 2 and 3 are created and never
# visited, which is the state the network rows are about: WordPress runs the
# activation hook once, in site 1.
#
# `$WP_SITE2` addresses the second. There is deliberately no handle for the third:
# addressing a site boots WordPress there, which is the first request the rows
# assert has not happened yet.
scratch_install_multisite() {
	scratch_stage "$1"

	$WP core multisite-install --url="$SCRATCH_URL" --subdomains=0 \
		--title="FotoGrids lifecycle network" \
		--admin_user=admin --admin_password=password \
		--admin_email=test@example.com --skip-email --quiet

	$WP site create --slug=two --quiet
	$WP site create --slug=three --quiet

	WP_SITE2="$WP --url=$SCRATCH_URL/two"
}

# Network-activate, the way a network admin does from the network plugins screen.
scratch_activate_network() {
	$WP plugin activate fotogrids --network --quiet
}

# Separate from the install, so a scenario can assert on the before state.
scratch_activate() {
	$WP plugin activate fotogrids --quiet
}

# Deactivate and delete the way a site owner does, as the admin.
#
# `--skip-delete` keeps the files, so the install can still be inspected
# afterwards.
uninstall_as_admin() {
	$WP --user=admin plugin deactivate fotogrids --quiet
	$WP --user=admin plugin uninstall fotogrids --skip-delete --quiet
}

scratch_teardown() {
	mysql $FG_MYSQL_ARGS -e "DROP DATABASE IF EXISTS \`$SCRATCH_DB\`;" || true
	rm -rf "$SCRATCH_DIR"
}
