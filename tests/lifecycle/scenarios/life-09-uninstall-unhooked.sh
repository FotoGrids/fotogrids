# LIFE-11. Deleting the plugin runs no cleanup unless the Freemius SDK
# registered the uninstall hook first.
#
# Cleanup hangs off the SDK's `after_uninstall` action, and the SDK registers
# that hook from inside its own deactivation hook, which returns early when
# there is no current user. So the site's "delete my data" choice is honoured
# only on the one path where an admin clicks Deactivate and then Delete.
#
# Both halves assert today's behaviour and name the issue, so a fix cannot land
# unnoticed.

ISSUE=FotoGrids/backstage#389

tables() {
	$WP eval 'global $wpdb; echo count( $wpdb->get_col( "SHOW TABLES LIKE \"{$wpdb->prefix}fotogrids_%\"" ) );'
}

hooked() {
	# Assigned first: isset() takes a variable, not a call.
	$WP eval '$registered = (array) get_option( "uninstall_plugins", array() );
		echo isset( $registered["fotogrids/fotogrids.php"] ) ? "yes" : "no";'
}

scratch_install life09
scratch_activate

$WP option update fotogrids_preserve_data_on_uninstall 0 --quiet

# --- deactivated with nobody logged in --------------------------------------

$WP plugin deactivate fotogrids --quiet
assert_defect no "$( hooked )" "a deactivation without a current user registers no uninstall hook" "$ISSUE"

$WP plugin uninstall fotogrids --skip-delete --quiet
assert_defect "$FG_TABLE_COUNT" "$( tables )" \
	"the data survives a delete the site asked to have cleaned" "$ISSUE"

scratch_teardown

# --- deactivated as the admin, then the SDK's files go missing ---------------
#
# Its own install: once a delete has run, the SDK will not register the hook
# again, so reusing the one above would prove nothing.

scratch_install life09b
scratch_activate

$WP option update fotogrids_preserve_data_on_uninstall 0 --quiet
$WP --user=admin plugin deactivate fotogrids --quiet

assert_eq yes "$( hooked )" "a deactivation as the admin does register the hook"

# What a half-finished update or upload leaves behind. The registered callback
# names a class that is no longer loadable.
mv "$SCRATCH_DIR/wp-content/plugins/fotogrids/freemius/start.php" \
	"$SCRATCH_DIR/freemius-start.php.away"

if $WP --user=admin plugin uninstall fotogrids --skip-delete --quiet >/dev/null 2>&1; then
	fail "the delete succeeded with the SDK missing — $ISSUE may be fixed; update this row"
else
	pass "the delete fails outright with the SDK missing (known defect, $ISSUE)"
fi

assert_defect "$FG_TABLE_COUNT" "$( tables )" \
	"and leaves the data behind" "$ISSUE"

scratch_teardown
