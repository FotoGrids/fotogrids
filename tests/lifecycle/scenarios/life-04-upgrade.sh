# LIFE-06. An install left on an older schema upgrades itself on a page load.
#
# The version is set back rather than an old install being built, so the row
# tests the branch, not a historical schema. A dropped table then shows the gate
# works both ways: the upgrade repairs it, a load at the current version does
# not.

scratch_install life04
scratch_activate

current=$( $WP option get fotogrids_db_version )

# Any WP-CLI command boots the plugin, which calls maybe_upgrade on
# plugins_loaded, so a load needs no explicit call.
load() {
	$WP option get fotogrids_db_version >/dev/null
}

# One row per table, so "no data lost" has something to lose. The columns come
# from the live schema, so a column added or renamed does not break this row.
plant_a_row_in_every_table() {
	$WP eval '
	global $wpdb;

	foreach ( explode( " ", getenv( "FG_TABLES" ) ) as $suffix ) {
		$table   = $wpdb->prefix . "fotogrids_" . $suffix;
		$columns = $wpdb->get_results( "SHOW COLUMNS FROM `$table`" );
		$values  = array();

		foreach ( $columns as $column ) {
			// Anything nullable, defaulted or generated fills itself in.
			if ( "NO" !== $column->Null || null !== $column->Default
				|| false !== strpos( $column->Extra, "auto_increment" ) ) {
				continue;
			}

			if ( preg_match( "/^enum\((.+)\)$/", $column->Type, $enum ) ) {
				$values[ $column->Field ] = trim( explode( ",", $enum[1] )[0], "\x27" );
			} elseif ( preg_match( "/int|decimal|float|double/", $column->Type ) ) {
				$values[ $column->Field ] = 1;
			} elseif ( preg_match( "/^date/", $column->Type ) ) {
				$values[ $column->Field ] = "2026-01-01";
			} else {
				$values[ $column->Field ] = "life04";
			}
		}

		if ( false === $wpdb->insert( $table, $values ) ) {
			echo "could not plant a row in $table: {$wpdb->last_error}\n";
		}
	}'
}

# Only the data tables: render_cache expires on its own, so counting it would
# make "nothing was lost" depend on the clock.
rows_in_the_data_tables() {
	$WP eval '
	global $wpdb;
	$total = 0;
	foreach ( explode( " ", getenv( "FG_DATA_TABLES" ) ) as $suffix ) {
		$total += (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}fotogrids_$suffix" );
	}
	echo $total;'
}

table_exists() {
	$WP eval "global \$wpdb; echo \$wpdb->get_var( \"SHOW TABLES LIKE '{\$wpdb->prefix}fotogrids_$1'\" ) ? 'yes' : 'no';"
}

plant_a_row_in_every_table
assert_eq "$FG_DATA_TABLE_COUNT" "$( rows_in_the_data_tables )" \
	"a row was planted in every data table"

# --- the upgrade branch -----------------------------------------------------

$WP option update fotogrids_db_version 1.0 --quiet
load

assert_eq "$current" "$( $WP option get fotogrids_db_version )" \
	"the stored version moved back to current"
assert_eq "$FG_DATA_TABLE_COUNT" "$( rows_in_the_data_tables )" \
	"every planted row survived the upgrade"

# --- the fast path ----------------------------------------------------------

$WP eval 'global $wpdb; $wpdb->query( "DROP TABLE {$wpdb->prefix}fotogrids_tags" );'
assert_eq no "$( table_exists tags )" "the table was dropped, so there is something to repair"

load
assert_eq no "$( table_exists tags )" \
	"a load at the current version does not repair a dropped table"

$WP option update fotogrids_db_version 1.0 --quiet
load
assert_eq yes "$( table_exists tags )" "the upgrade recreated the dropped table"

# The dropped table's row went with it; the other six keep theirs.
assert_eq "$(( FG_DATA_TABLE_COUNT - 1 ))" "$( rows_in_the_data_tables )" \
	"recreating one table left the others' rows alone"

scratch_teardown
