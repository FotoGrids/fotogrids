# LIFE-12, LIFE-13 and LIFE-14. What a network activation reaches, and what it
# leaves to each site's first request.
#
# Every count is asked from site 1, against the other site's table prefix.
# Addressing site 2 with WP-CLI boots WordPress there, and that load is itself
# the first request these rows are about, so looking would create what they
# assert is absent.

scratch_install_multisite life12

# --- before a visit ----------------------------------------------------------

tables_for() {
	$WP eval "global \$wpdb; echo count( \$wpdb->get_col( \"SHOW TABLES LIKE '${1}fotogrids\_%'\" ) );"
}

options_for() {
	$WP eval "global \$wpdb; echo implode( ' ', \$wpdb->get_col( \"SELECT option_name FROM ${1}options WHERE option_name LIKE 'fotogrids\_%' ORDER BY option_name\" ) );"
}

# The role map is a per-site option, so another site's is read without booting
# it. Takes a table prefix, since site 1's option is `wp_user_roles`.
admin_caps_for() {
	$WP eval "global \$wpdb;
		\$roles = maybe_unserialize( \$wpdb->get_var( \"SELECT option_value FROM ${1}options WHERE option_name = '${1}user_roles'\" ) );
		\$caps = is_array( \$roles ) ? ( \$roles['administrator']['capabilities'] ?? array() ) : array();
		echo count( array_filter( array_keys( array_filter( \$caps ) ),
			fn( \$cap ) => false !== strpos( \$cap, 'fotogrids' ) ) );"
}

# The migration record and lock, read the same way.
record_for() {
	$WP eval "global \$wpdb;
		\$value = maybe_unserialize( \$wpdb->get_var( \"SELECT option_value FROM ${1}options WHERE option_name = 'fotogrids_completed_migrations'\" ) );
		echo is_array( \$value ) ? implode( ' ', \$value ) : '';"
}

lock_for() {
	$WP eval "global \$wpdb; echo (int) \$wpdb->get_var( \"SELECT COUNT(*) FROM ${1}options WHERE option_name = 'fotogrids_migration_lock'\" );"
}

# An album whose stored featured gallery is not one of its galleries, written
# straight into a site's tables. Prints the album's ID.
plant_stale_pick() {
	$WP eval "global \$wpdb;
		\$wpdb->insert( '${1}posts', array( 'post_type' => 'fotogrids_album', 'post_status' => 'publish', 'post_title' => 'life12', 'post_content' => '', 'post_excerpt' => '', 'to_ping' => '', 'pinged' => '', 'post_content_filtered' => '' ) );
		\$album = \$wpdb->insert_id;
		\$wpdb->insert( '${1}postmeta', array( 'post_id' => \$album, 'meta_key' => 'fotogrids_featured_gallery', 'meta_value' => '987654' ) );
		echo \$album;"
}

pick_for() {
	$WP eval "global \$wpdb; echo (string) \$wpdb->get_var( \"SELECT meta_value FROM ${1}postmeta WHERE post_id = ${2} AND meta_key = 'fotogrids_featured_gallery'\" );"
}

site2_album=$( plant_stale_pick wp_2_ )
site3_album=$( plant_stale_pick wp_3_ )

scratch_activate_network

migrations=$( $WP eval '$ids = array_map( fn( $m ) => $m::id(), \FotoGrids\Migrations\Migration_Runner::discover() ); sort( $ids ); echo implode( " ", $ids );' )

assert_contains "$migrations" "0004-featured-gallery-repair" "the plugin has its migrations"
assert_eq "$migrations" "$( record_for wp_ )" "network activation ran and recorded every migration in site 1"
assert_eq 0 "$( lock_for wp_ )" "and released site 1's lock"
assert_eq "" "$( record_for wp_2_ )" "site 2 has no record before its first request"
assert_eq 987654 "$( pick_for wp_2_ "$site2_album" )" "and keeps its stale featured gallery"

assert_eq "$FG_TABLE_COUNT" "$( tables_for wp_ )" "network activation created site 1's tables"
assert_eq 0 "$( tables_for wp_2_ )" "site 2 has none: the activation hook runs once, in site 1"
assert_eq 0 "$( tables_for wp_3_ )" "nor does site 3"
assert_eq "" "$( options_for wp_2_ )" "and site 2 was given no options"
assert_eq 0 "$( admin_caps_for wp_2_ )" "and site 2's administrator no capabilities"

# --- site 2's first request --------------------------------------------------
#
# `maybe_upgrade` on plugins_loaded sees db_version absent and builds the
# schema; the capability resync follows on init.

$WP_SITE2 option get fotogrids_version >/dev/null 2>&1

assert_eq "$FG_TABLE_COUNT" "$( tables_for wp_2_ )" "site 2's first request built its own tables"
assert_eq "$( admin_caps_for wp_ )" "$( admin_caps_for wp_2_ )" \
	"and granted its administrator the same capabilities site 1 has"
assert_eq 0 "$( tables_for wp_3_ )" "site 3, still unvisited, has nothing"
assert_eq "$migrations" "$( record_for wp_2_ )" "site 2's first request ran and recorded every migration for site 2"
assert_eq 0 "$( lock_for wp_2_ )" "and released site 2's lock"
assert_eq "" "$( pick_for wp_2_ "$site2_album" )" "and cleared site 2's stale featured gallery"
assert_eq "" "$( record_for wp_3_ )" "site 3, still unvisited, has no record"
assert_eq 987654 "$( pick_for wp_3_ "$site3_album" )" "and keeps its stale featured gallery"

# The install-time options are written by the activator, which site 2 never ran.
# Nothing on a later page load seeds them, so the site has a schema and
# capabilities but no identity.
for option in fotogrids_site_id fotogrids_media_settings fotogrids_version; do
	case " $( options_for wp_2_ ) " in
		*" $option "*) fail "site 2 was seeded $option, which only the activator writes" ;;
		*) pass "site 2 has no $option, as only the activator writes it" ;;
	esac
done

# --- a network delete --------------------------------------------------------
#
# The uninstall callback runs once, against whichever site WordPress happens to be on.
# Site 2 asked for its data to be deleted too and keeps all of it.

$WP_SITE2 eval 'global $wpdb; $wpdb->insert( $wpdb->prefix . "fotogrids_tags", array( "name" => "life12", "type" => "tag" ) );'
assert_eq 1 "$( $WP eval 'global $wpdb; echo (int) $wpdb->get_var( "SELECT COUNT(*) FROM wp_2_fotogrids_tags" );' )" \
	"a row was planted on site 2"

granted=$( admin_caps_for wp_2_ )

$WP option update fotogrids_preserve_data_on_uninstall 0 --quiet
$WP_SITE2 option update fotogrids_preserve_data_on_uninstall 0 --quiet

$WP --user=admin plugin deactivate fotogrids --network --quiet
$WP --user=admin plugin uninstall fotogrids --skip-delete --quiet

assert_eq 0 "$( tables_for wp_ )" "the delete dropped site 1's tables"
assert_eq 0 "$( admin_caps_for wp_ )" "and removed site 1's capabilities"
assert_eq "$FG_TABLE_COUNT" "$( tables_for wp_2_ )" "site 2 keeps its tables"
assert_eq 1 "$( $WP eval 'global $wpdb; echo (int) $wpdb->get_var( "SELECT COUNT(*) FROM wp_2_fotogrids_tags" );' )" \
	"and the row in them"
assert_eq "$granted" "$( admin_caps_for wp_2_ )" "and its administrator's capabilities"

scratch_teardown
