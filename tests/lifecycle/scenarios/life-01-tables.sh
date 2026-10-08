# LIFE-01. A fresh activation creates the seven documented tables.
#
# Named literally rather than counted, so adding or dropping one is a deliberate
# edit here.

scratch_install life01

prefix=$( $WP eval 'global $wpdb; echo $wpdb->prefix;' )

before=$( $WP eval 'global $wpdb; echo count( $wpdb->get_col( "SHOW TABLES LIKE \"{$wpdb->prefix}fotogrids_%\"" ) );' )
assert_eq 0 "$before" "no plugin tables before activation"

scratch_activate

for table in $FG_TABLES; do
	found=$( $WP eval "global \$wpdb; echo \$wpdb->get_var( \"SHOW TABLES LIKE '{\$wpdb->prefix}fotogrids_$table'\" );" )
	assert_eq "${prefix}fotogrids_$table" "$found" "created ${prefix}fotogrids_$table"
done

total=$( $WP eval 'global $wpdb; echo count( $wpdb->get_col( "SHOW TABLES LIKE \"{$wpdb->prefix}fotogrids_%\"" ) );' )
assert_eq "$FG_TABLE_COUNT" "$total" "exactly $FG_TABLE_COUNT plugin tables, and no more"

scratch_teardown
