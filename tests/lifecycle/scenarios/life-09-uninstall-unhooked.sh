# LIFE-11. Deleting the plugin honours the site's "delete my data" choice however
# the plugin was deactivated, and whether or not the Freemius SDK's files are
# still there.
#
# Cleanup runs from the FotoGrids uninstall callback, registered on activation,
# on deactivation and on every admin load. It replaces the callback the SDK
# registers on an admin's deactivation, and reports the uninstall to the SDK
# itself.

tables() {
	$WP eval 'global $wpdb; echo count( $wpdb->get_col( "SHOW TABLES LIKE \"{$wpdb->prefix}fotogrids_%\"" ) );'
}

options() {
	$WP eval 'global $wpdb; echo (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->options} WHERE option_name LIKE \"fotogrids\_%\"" );'
}

admin_caps() {
	$WP eval '$r = get_role( "administrator" );
		echo count( array_filter( array_keys( array_filter( $r->capabilities ) ),
			fn( $c ) => false !== strpos( $c, "fotogrids" ) ) );'
}

fg_event_count() {
	$WP cron event list --fields=hook --format=csv 2>/dev/null | grep -c fotogrids || true
}

# --- deactivated and deleted with nobody logged in --------------------------
#
# The route WP-CLI, deploy scripts and managed hosts take.

scratch_install life09
scratch_activate

gallery=$( $WP post create --post_type=fotogrids_gallery --post_title="life09" --porcelain )
$WP option update fotogrids_preserve_data_on_uninstall 0 --quiet

$WP plugin deactivate fotogrids --quiet
$WP plugin uninstall fotogrids --skip-delete --quiet

assert_eq 0 "$( tables )" "every table was dropped without a logged-in user"
assert_eq 0 "$( options )" "every option was deleted"
assert_eq 0 "$( admin_caps )" "the administrator's capabilities were removed"
assert_eq 0 "$( $WP post list --post_type=fotogrids_gallery --post_status=any --format=count )" \
	"the gallery post was deleted"

scratch_teardown

# --- deactivated as the admin, then the SDK's files go missing ---------------
#
# What a half-finished update or upload leaves behind. The admin's deactivation
# has registered the SDK's uninstall callback, which names a class that is no
# longer loadable.

scratch_install life09b
scratch_activate

$WP option update fotogrids_preserve_data_on_uninstall 0 --quiet
$WP --user=admin plugin deactivate fotogrids --quiet

mv "$SCRATCH_DIR/wp-content/plugins/fotogrids/freemius/start.php" \
	"$SCRATCH_DIR/freemius-start.php.away"

if $WP --user=admin plugin uninstall fotogrids --skip-delete --quiet; then
	pass "the delete completes with the SDK missing"
else
	fail "the delete failed with the SDK missing"
fi

assert_eq 0 "$( tables )" "and every table was dropped"
assert_eq 0 "$( options )" "and every option was deleted"

scratch_teardown

# --- dropped from the active list without a deactivation ---------------------
#
# WordPress deactivates a plugin this way when its files go missing, so no
# deactivation hook clears the scheduled events. Data is kept here: the
# events are cleared whether or not it is.

scratch_install life09c
scratch_activate

# A load, so the init hooks that schedule have run.
$WP option get fotogrids_version >/dev/null
scheduled=$( fg_event_count )

$WP eval 'update_option( "active_plugins", array() );'
assert_eq "$scheduled" "$( fg_event_count )" "the events outlive a deactivation that ran no plugin code"

$WP plugin uninstall fotogrids --skip-delete --quiet

assert_eq 0 "$( fg_event_count )" "the delete cleared all $scheduled events"
assert_eq "$FG_TABLE_COUNT" "$( tables )" "and kept the data, as the site's default asks"

scratch_teardown

# --- activated and deactivated as the admin, then deleted --------------------
#
# The SDK unregisters the uninstall callback on an admin's activation and
# registers its own on an admin's deactivation. The FotoGrids callback has to be
# the one left, and it still has to report the uninstall to the SDK.

scratch_install life09d

mkdir -p "$SCRATCH_DIR/wp-content/mu-plugins"
cat > "$SCRATCH_DIR/wp-content/mu-plugins/life09-sdk-uninstall.php" <<'PHP'
<?php
add_action( 'fs_after_uninstall_fotogrids', function () {
	update_option( 'life09_sdk_uninstall_calls', (int) get_option( 'life09_sdk_uninstall_calls', 0 ) + 1 );
} );
PHP

uninstall_callback() {
	$WP eval '$u = (array) get_option( "uninstall_plugins" );
		echo wp_json_encode( $u["fotogrids/fotogrids.php"] ?? null );'
}

expected='["FotoGrids\\Uninstaller","uninstall"]'

$WP --user=admin plugin activate fotogrids --quiet
assert_eq "$expected" "$( uninstall_callback )" "an admin's activation leaves the FotoGrids callback registered"

$WP option update fotogrids_preserve_data_on_uninstall 0 --quiet
$WP --user=admin plugin deactivate fotogrids --quiet
assert_eq "$expected" "$( uninstall_callback )" "an admin's deactivation leaves the FotoGrids callback registered"

$WP --user=admin plugin uninstall fotogrids --skip-delete --quiet

assert_eq 0 "$( tables )" "every table was dropped"
assert_eq 0 "$( options )" "every option was deleted"
assert_eq 1 "$( $WP option get life09_sdk_uninstall_calls 2>/dev/null )" "the uninstall was reported to the SDK once"

scratch_teardown
