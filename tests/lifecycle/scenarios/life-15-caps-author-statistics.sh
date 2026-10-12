# LIFE-07, the 1.4 step. An install at caps version 1.3 grants the Statistics
# screen to the author role, once.
#
# The 1.3 state is rebuilt by hand: activation grants today's defaults, so the
# capability a 1.3 activation left out is removed again before the load.

scratch_install life15
scratch_activate

load() {
	$WP option get fotogrids_caps_version >/dev/null
}

role_has() {
	$WP eval "\$r = get_role( '$1' );
		echo ( \$r && ! empty( \$r->capabilities['$2'] ) ) ? 'yes' : 'no';"
}

CAP=view_fotogrids_stats

assert_eq yes "$( role_has author $CAP )" "a new install gives the author Statistics"

$WP eval "get_role( 'author' )->remove_cap( '$CAP' );"
assert_eq no "$( role_has author $CAP )" "the author starts as a 1.3 install left it"

$WP option update fotogrids_caps_version 1.3 --quiet
load

assert_eq 1.4 "$( $WP option get fotogrids_caps_version )" "the stored version moved to 1.4"
assert_eq yes "$( role_has author $CAP )" "the author was granted Statistics"
assert_eq yes "$( role_has editor $CAP )" "the editor kept Statistics"

for role in contributor subscriber; do
	assert_eq no "$( role_has $role $CAP )" "$role was not granted Statistics"
done

# The step runs once: at 1.4 a removed capability stays removed.
$WP eval "get_role( 'author' )->remove_cap( '$CAP' );"
load
assert_eq no "$( role_has author $CAP )" "a load at 1.4 does not run the step again"

scratch_teardown
