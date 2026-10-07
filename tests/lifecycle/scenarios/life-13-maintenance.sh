# LIFE-17 and LIFE-18. The two Maintenance repair actions.
#
# Both are REST routes, called here as the administrator rather than through the
# screen: the contract is what they do to the database, and a dropped table or a
# wiped option is not something the shared Playwright site can be asked to
# survive.

scratch_install life13
scratch_activate

# Read from the install rather than written down here, so a schema bump does not
# need an edit in this file.
schema_version=$( $WP option get fotogrids_db_version )

# POST a route as the administrator. Prints the response body as JSON.
post_as_admin() {
	$WP --user=admin eval "
		\$response = rest_do_request( new WP_REST_Request( 'POST', '/fotogrids/v1$1' ) );
		if ( \$response->is_error() ) {
			echo 'error ' . \$response->get_status();
			exit;
		}
		echo wp_json_encode( \$response->get_data() );"
}

table_exists() {
	$WP eval "global \$wpdb; echo \$wpdb->get_var( \"SHOW TABLES LIKE '{\$wpdb->prefix}fotogrids_$1'\" ) ? 'yes' : 'no';"
}

rows_in() {
	$WP eval "global \$wpdb; echo (int) \$wpdb->get_var( \"SELECT COUNT(*) FROM {\$wpdb->prefix}fotogrids_$1\" );"
}

# --- LIFE-17. Reinstalling the tables ----------------------------------------
#
# The route answers with a fixed list of table names whether or not they are
# there, so every assertion below reads the database.

$WP eval 'global $wpdb;
	$wpdb->insert( $wpdb->prefix . "fotogrids_tags", array( "name" => "dropped", "type" => "tag" ) );
	$wpdb->insert( $wpdb->prefix . "fotogrids_statistics", array( "object_type" => "gallery", "object_id" => 1 ) );'

$WP eval 'global $wpdb; $wpdb->query( "DROP TABLE {$wpdb->prefix}fotogrids_tags" );'
assert_eq no "$( table_exists tags )" "a table was dropped, so there is something to repair"

reinstall=$( post_as_admin /admin/maintenance/reinstall-tables )
assert_contains "$reinstall" '"success":true' "the reinstall reported success"

assert_eq yes "$( table_exists tags )" "the dropped table is back"
assert_eq 1 "$( rows_in statistics )" "and the surviving tables kept their rows"
assert_eq 0 "$( rows_in tags )" "the recreated one is empty, its rows having gone with it"

# The route works by deleting the stored schema version. It has to put it back,
# or every later page load re-runs dbDelta.
assert_eq "$schema_version" "$( $WP option get fotogrids_db_version )" \
	"and the schema version is current again"

# --- LIFE-18. Resetting the settings -----------------------------------------
#
# Every option the plugin owns falls into one of three groups, and the reset
# treats them differently. The third group is not a decision the route makes -
# those keys are in neither of its lists, and survive because nothing names
# them.

RESET="fotogrids_general_settings fotogrids_permission_settings
	fotogrids_integration_settings fotogrids_gallery_defaults
	fotogrids_album_defaults fotogrids_sharing_settings fotogrids_view_settings
	fotogrids_autosave fotogrids_share_statistics fotogrids_allow_google_fonts
	fotogrids_allow_news_updates fotogrids_preserve_data_on_uninstall
	fotogrids_notice_bar_dismissed fotogrids_review_stats
	fotogrids_debug_channels"

KEPT="fotogrids_version fotogrids_db_version fotogrids_activated_time
	fotogrids_deactivated_time fotogrids_site_id fotogrids_license_key
	fotogrids_license_data fotogrids_license_secret
	fotogrids_license_last_valid_response fotogrids_license_last_check_time"

# In neither list. They survive a reset, and the route never decided that.
UNLISTED="fotogrids_caps_version fotogrids_seo_settings
	fotogrids_watermark_settings fotogrids_settings_mode fotogrids_user_persona
	fotogrids_marketing_allowed"

# Derived rather than set: the reset clears media settings and reseeds them, and
# the view router rewrites its own signature on the next load. Neither can be
# asserted by planting a value, so both are checked on their own below.
DERIVED="fotogrids_media_settings fotogrids_view_rewrite_version"

for option in $RESET $KEPT $UNLISTED; do
	$WP option update "$option" "planted-$option" --quiet
done

reset=$( post_as_admin /admin/maintenance/reset-options )
assert_contains "$reset" '"success":true' "the reset reported success"

gone=0 stayed=0
for option in $RESET; do
	[ "$( $WP option get "$option" 2>/dev/null )" = "planted-$option" ] \
		&& fail "$option survived the reset" || gone=$(( gone + 1 ))
done
pass "all $gone listed settings were cleared"

for option in $KEPT $UNLISTED; do
	[ "$( $WP option get "$option" 2>/dev/null )" = "planted-$option" ] \
		&& stayed=$(( stayed + 1 )) || fail "$option was cleared by the reset"
done
pass "all $stayed preserved and unlisted options survived"

assert_contains "$( $WP option get fotogrids_media_settings --format=json )" '{' \
	"media settings were cleared and reseeded with defaults, not left wiped"
signature=$( $WP option get fotogrids_view_rewrite_version )
[ -n "$signature" ] && pass "the view router's signature is still there" \
	|| fail "the view router's signature was cleared"

# The groups above must account for every option the plugin owns. An option added
# without a decision about the reset lands here rather than in a bug report from
# a site owner whose settings did or did not survive.
known=" $( echo $RESET $KEPT $UNLISTED $DERIVED ) "
unaccounted=""
for option in $( $WP option list --search='fotogrids_*' --field=option_name ); do
	case "$known" in
		*" $option "*) ;;
		*) unaccounted="$unaccounted $option" ;;
	esac
done
assert_eq "" "$unaccounted" "every option the plugin owns is accounted for by one of the groups"

scratch_teardown
