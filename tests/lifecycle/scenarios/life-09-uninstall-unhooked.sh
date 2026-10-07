# LIFE-11. Deleting the plugin honours the site's "delete my data" choice however
# the plugin was deactivated, and whether or not the Freemius SDK's files are
# still there.
#
# Cleanup runs from uninstall.php, which WordPress runs on every delete. It does
# not depend on the uninstall hook the SDK registers, which only an admin's
# deactivation adds.

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
