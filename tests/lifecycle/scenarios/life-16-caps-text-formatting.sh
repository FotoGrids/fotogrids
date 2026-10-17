# LIFE-07, the 1.5 step. An install at caps version 1.4 grants caption and
# description formatting to authors, editors and administrators, once.
#
# The 1.4 state is rebuilt by hand: activation grants today's defaults, so the
# capability a 1.4 activation left out is removed again before the load.

scratch_install life16
scratch_activate

load() {
	$WP option get fotogrids_caps_version >/dev/null
}

role_has() {
	$WP eval "\$r = get_role( '$1' );
		echo ( \$r && ! empty( \$r->capabilities['$2'] ) ) ? 'yes' : 'no';"
}

CAP=format_fotogrids_item_text

for role in author editor administrator; do
	assert_eq yes "$( role_has $role $CAP )" "a new install gives $role text formatting"
	$WP eval "get_role( '$role' )->remove_cap( '$CAP' );"
done
assert_eq no "$( role_has author $CAP )" "the author starts as a 1.4 install left it"

$WP option update fotogrids_caps_version 1.4 --quiet
load

assert_eq 1.5 "$( $WP option get fotogrids_caps_version )" "the stored version moved to 1.5"
for role in author editor administrator; do
	assert_eq yes "$( role_has $role $CAP )" "$role was granted text formatting"
done
for role in contributor subscriber; do
	assert_eq no "$( role_has $role $CAP )" "$role was not granted text formatting"
done

# The step runs once: at 1.5 a removed capability stays removed.
$WP eval "get_role( 'author' )->remove_cap( '$CAP' );"
load
assert_eq no "$( role_has author $CAP )" "a load at 1.5 does not run the step again"

scratch_teardown
