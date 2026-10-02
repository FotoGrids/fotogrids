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

# Current behaviour that is wrong but not this change's to fix. Passes while the
# defect stands and fails once it is fixed, so the fix cannot land silently.
assert_defect() {
	local expected="$1" actual="$2" what="$3" issue="$4"

	if [ "$expected" = "$actual" ]; then
		pass "$what (known defect, $issue)"
	else
		fail "$what changed — $issue may be fixed; update this row"
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
	$WP core install --url=http://127.0.0.1:8899 --title="FotoGrids lifecycle" \
		--admin_user=admin --admin_password=password \
		--admin_email=test@example.com --skip-email --quiet
}

# Separate from the install, so a scenario can assert on the before state.
scratch_activate() {
	$WP plugin activate fotogrids --quiet
}

# Deactivate and delete the way a site owner does, as the admin.
#
# The SDK registers its uninstall hook from inside the deactivation hook, and
# that hook returns early without a current user, so a deactivation with nobody
# logged in leaves nothing to run on delete. `--skip-delete` keeps the files, so
# the install can still be inspected afterwards.
uninstall_as_admin() {
	$WP --user=admin plugin deactivate fotogrids --quiet
	$WP --user=admin plugin uninstall fotogrids --skip-delete --quiet
}

scratch_teardown() {
	mysql $FG_MYSQL_ARGS -e "DROP DATABASE IF EXISTS \`$SCRATCH_DB\`;" || true
	rm -rf "$SCRATCH_DIR"
}
