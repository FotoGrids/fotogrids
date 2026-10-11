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
# Every option the plugin owns is declared under includes/options/declarations/
# as cleared or kept by the reset. The two lists below pin that decision, and
# the registry is checked against them, so moving an option between them takes
# an edit here as well.

RESET="fotogrids_album_defaults fotogrids_autosave fotogrids_debug_channels
	fotogrids_gallery_defaults fotogrids_general_settings
	fotogrids_integration_settings fotogrids_media_settings
	fotogrids_permission_settings fotogrids_preserve_data_on_uninstall
	fotogrids_seo_settings fotogrids_sharing_settings
	fotogrids_view_rewrite_version fotogrids_view_settings
	fotogrids_watermark_config_hash fotogrids_watermark_settings"

KEPT="fotogrids_activated_time fotogrids_allow_google_fonts
	fotogrids_allow_news_updates fotogrids_caps_version fotogrids_custom_sizes
	fotogrids_db_version fotogrids_deactivated_time fotogrids_error_log
	fotogrids_import_export_log fotogrids_license_data fotogrids_license_key
	fotogrids_license_last_check_time fotogrids_license_last_valid_response
	fotogrids_license_secret fotogrids_marketing_allowed fotogrids_migration_log
	fotogrids_notice_bar_dismissed fotogrids_remote_catalog_meta
	fotogrids_review_stats fotogrids_settings_mode fotogrids_share_statistics
	fotogrids_site_id fotogrids_unauthorised_settings_visibility
	fotogrids_user_persona fotogrids_version"

declared() {
	$WP eval "echo implode( ' ', \\FotoGrids\\Options\\Option_Registry::keys( '$1' ) );"
}

assert_eq "$( echo $RESET )" "$( declared reset )" "the registry clears exactly the options listed here"
assert_eq "$( echo $KEPT )" "$( declared keep )" "and keeps exactly the others"

for option in $RESET $KEPT; do
	$WP option update "$option" "planted-$option" --quiet
done

$WP eval 'global $wpdb;
	$wpdb->insert( $wpdb->prefix . "fotogrids_render_cache", array(
		"object_type" => "gallery", "object_id" => 1, "cache_key" => "planted",
		"html" => "<div></div>", "expires_at" => "2099-01-01 00:00:00" ) );'
assert_eq 1 "$( rows_in render_cache )" "a gallery render is cached before the reset"

reset=$( post_as_admin /admin/maintenance/reset-options )
assert_contains "$reset" '"success":true' "the reset reported success"

# A cleared option either reads back as absent (exit 1) or as the value its
# owner reseeded. Any other exit status is a failed boot, not a cleared option.
before=$FG_LIFECYCLE_FAILURES
for option in $RESET; do
	value=$( $WP option get "$option" 2>/dev/null )
	status=$?
	if [ "$status" -gt 1 ]; then
		fail "reading $option after the reset exited $status"
	elif [ "$value" = "planted-$option" ]; then
		fail "$option survived the reset"
	fi
done
[ "$FG_LIFECYCLE_FAILURES" -eq "$before" ] && pass "every reset option was cleared"

before=$FG_LIFECYCLE_FAILURES
for option in $KEPT; do
	[ "$( $WP option get "$option" 2>/dev/null )" = "planted-$option" ] \
		|| fail "$option was changed by the reset"
done
[ "$FG_LIFECYCLE_FAILURES" -eq "$before" ] && pass "every kept option is unchanged"

assert_eq 0 "$( rows_in render_cache )" "the render cache was flushed"
assert_contains "$( $WP option get fotogrids_media_settings --format=json )" '{' \
	"media settings were cleared and reseeded with defaults, not left wiped"
signature=$( $WP option get fotogrids_view_rewrite_version )
[ -n "$signature" ] && pass "the view router stamped its signature again on the next load" \
	|| fail "the view router's signature was not rebuilt"

# Every option on the site must be one the registry declares.
known=" $( echo $RESET $KEPT ) "
unaccounted=""
for option in $( $WP option list --search='fotogrids_*' --field=option_name ); do
	case "$known" in
		*" $option "*) ;;
		*) unaccounted="$unaccounted $option" ;;
	esac
done
assert_eq "" "$unaccounted" "every option the plugin owns is declared"

scratch_teardown
