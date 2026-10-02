# LIFE-08. Deactivation is reversible: it clears schedules and caches and
# leaves every piece of site data alone.
#
# Deactivated as the admin, which is how a site does it, and how the Freemius
# SDK comes to register its uninstall hook.

scratch_install life06
scratch_activate

gallery=$( $WP post create --post_type=fotogrids_gallery --post_title="life06" --porcelain )
$WP post meta update "$gallery" fotogrids_layout grid --quiet
$WP eval 'global $wpdb; $wpdb->insert( $wpdb->prefix . "fotogrids_tags",
	array( "name" => "life06", "slug" => "life06" ) );'
$WP transient set fotogrids_life06 cached 3600 --quiet

tables_before=$( $WP eval 'global $wpdb; echo count( $wpdb->get_col( "SHOW TABLES LIKE \"{$wpdb->prefix}fotogrids_%\"" ) );' )
# Names rather than a count, so a swap of one option for another is visible.
plugin_options() {
	$WP eval 'global $wpdb;
		foreach ( $wpdb->get_col( "SELECT option_name FROM {$wpdb->options}
			WHERE option_name LIKE \"fotogrids\_%\" ORDER BY option_name" ) as $name ) {
			echo "$name\n";
		}'
}

options_before="$SCRATCH_DIR/options-before.txt"
plugin_options > "$options_before"
caps_before=$( $WP eval '$r = get_role( "administrator" );
	echo count( array_filter( array_keys( array_filter( $r->capabilities ) ),
		fn( $c ) => false !== strpos( $c, "fotogrids" ) ) );' )
crons_before=$( $WP cron event list --fields=hook --format=csv 2>/dev/null | grep -c fotogrids || true )

assert_eq "$FG_TABLE_COUNT" "$tables_before" "the install has its tables before deactivation"
[ "$crons_before" -gt 0 ] && pass "the plugin scheduled $crons_before events" \
	|| fail "nothing was scheduled, so clearing it proves nothing"

$WP --user=admin plugin deactivate fotogrids --quiet

# --- data survives ----------------------------------------------------------

assert_eq "$tables_before" \
	"$( $WP eval 'global $wpdb; echo count( $wpdb->get_col( "SHOW TABLES LIKE \"{$wpdb->prefix}fotogrids_%\"" ) );' )" \
	"every table survived"
assert_eq 1 \
	"$( $WP eval 'global $wpdb; echo (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}fotogrids_tags" );' )" \
	"the planted row survived"
assert_eq "$caps_before" \
	"$( $WP eval '$r = get_role( "administrator" );
		echo count( array_filter( array_keys( array_filter( $r->capabilities ) ),
			fn( $c ) => false !== strpos( $c, "fotogrids" ) ) );' )" \
	"the administrator kept all $caps_before capabilities"
assert_eq grid "$( $WP post meta get "$gallery" fotogrids_layout )" "the gallery's settings survived"
assert_eq fotogrids_gallery "$( $WP post get "$gallery" --field=post_type )" "the gallery post survived"

# Compared by name, not by count: two options are expected to move, and naming
# them is the point. `fotogrids_view_rewrite_version` is the rewrite-flush
# signature, dropped so the next activation re-flushes.
lost=$( comm -23 "$options_before" <( plugin_options ) | tr '\n' ' ' )
gained=$( comm -13 "$options_before" <( plugin_options ) | tr '\n' ' ' )

assert_eq "fotogrids_view_rewrite_version " "$lost" "the only option dropped is the rewrite signature"
assert_eq "fotogrids_deactivated_time " "$gained" "the only option added is the deactivation timestamp"

# --- schedules and caches do not -------------------------------------------

assert_eq 0 "$( $WP cron event list --fields=hook --format=csv 2>/dev/null | grep -c fotogrids || true )" \
	"every scheduled event was cleared"
assert_eq 0 \
	"$( $WP eval 'global $wpdb; echo (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->options} WHERE option_name LIKE \"\_transient\_fotogrids\_%\"" );' )" \
	"the plugin's transients were cleared"

scratch_teardown
