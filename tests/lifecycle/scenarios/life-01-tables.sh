# LIFE-01. A fresh activation creates the seven documented tables.
#
# Named literally rather than counted, so adding or dropping one is a deliberate
# edit here.

scratch_install life01

prefix=$( $WP eval 'global $wpdb; echo $wpdb->prefix;' )

before=$( $WP eval 'global $wpdb; echo count( $wpdb->get_col( "SHOW TABLES LIKE \"{$wpdb->prefix}fotogrids_%\"" ) );' )
assert_eq 0 "$before" "no plugin tables before activation"

scratch_activate

for table in item_meta statistics statistics_daily gallery_albums tags item_metadata render_cache; do
	found=$( $WP eval "global \$wpdb; echo \$wpdb->get_var( \"SHOW TABLES LIKE '{\$wpdb->prefix}fotogrids_$table'\" );" )
	assert_eq "${prefix}fotogrids_$table" "$found" "created ${prefix}fotogrids_$table"
done

total=$( $WP eval 'global $wpdb; echo count( $wpdb->get_col( "SHOW TABLES LIKE \"{$wpdb->prefix}fotogrids_%\"" ) );' )
assert_eq 7 "$total" "exactly seven plugin tables"

scratch_teardown
