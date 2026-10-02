# LIFE-09. Uninstall with data preservation on - the default - deletes nothing.
#
# The option is absent on a fresh install and defaults to true, so this is what
# a site that never opened Settings > Advanced gets. Deleting the plugin must
# leave the galleries intact for a reinstall.

scratch_install life07
scratch_activate

gallery=$( $WP post create --post_type=fotogrids_gallery --post_title="life07" --porcelain )
$WP post meta update "$gallery" fotogrids_layout grid --quiet
$WP eval 'global $wpdb; $wpdb->insert( $wpdb->prefix . "fotogrids_tags",
	array( "name" => "life07", "slug" => "life07" ) );'

# Absent, not false: the default is what is under test.
assert_eq "" "$( $WP option get fotogrids_preserve_data_on_uninstall 2>/dev/null )" \
	"a fresh install stores no preference, so the default applies"

uninstall_as_admin

assert_eq "$FG_TABLE_COUNT" \
	"$( $WP eval 'global $wpdb; echo count( $wpdb->get_col( "SHOW TABLES LIKE \"{$wpdb->prefix}fotogrids_%\"" ) );' )" \
	"every table survived"
assert_eq 1 \
	"$( $WP eval 'global $wpdb; echo (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}fotogrids_tags" );' )" \
	"the planted row survived"
assert_eq fotogrids_gallery "$( $WP post get "$gallery" --field=post_type )" "the gallery post survived"
assert_eq grid "$( $WP post meta get "$gallery" fotogrids_layout )" "the gallery's settings survived"

settings=$( $WP eval 'global $wpdb; echo (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->options} WHERE option_name LIKE \"fotogrids\_%\"" );' )
[ "$settings" -gt 0 ] && pass "$settings options survived" || fail "the options were deleted"

# Schedules are not site data, so they go either way.
assert_eq 0 "$( $WP cron event list --fields=hook --format=csv 2>/dev/null | grep -c fotogrids || true )" \
	"the scheduled events were cleared even though the data was kept"

scratch_teardown
