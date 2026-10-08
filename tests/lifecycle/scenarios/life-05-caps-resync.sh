# LIFE-07. Capabilities are re-granted on an existing install without a
# reactivation, when the catalogue version moves forward.
#
# The resync returns early at the current version, so the version is set back
# first - otherwise nothing runs and the row passes for the wrong reason.

scratch_install life05
scratch_activate

# Any WP-CLI command boots the plugin; maybe_upgrade attaches the resync to
# init:8, so a load runs it.
load() {
	$WP option get fotogrids_caps_version >/dev/null
}

role_has() {
	$WP eval "\$r = get_role( '$1' );
		echo ( \$r && ! empty( \$r->capabilities['$2'] ) ) ? 'yes' : 'no';"
}

current=$( $WP option get fotogrids_caps_version )
CAP=view_fotogrids_stats

assert_eq yes "$( role_has editor $CAP )" "the editor starts with the capability"

$WP eval "get_role( 'editor' )->remove_cap( '$CAP' );"
assert_eq no "$( role_has editor $CAP )" "the capability was removed, so there is something to restore"

# At the current version the resync must not run.
load
assert_eq no "$( role_has editor $CAP )" \
	"a load at the current catalogue version does not re-grant"

$WP option update fotogrids_caps_version 1.0 --quiet
load

assert_eq yes "$( role_has editor $CAP )" "the resync re-granted the capability"
assert_eq "$current" "$( $WP option get fotogrids_caps_version )" \
	"the resync moved the stored version forward"

# A capability the plugin no longer grants is not taken back. Documented here
# because the uninstaller is the only thing that removes capabilities.
$WP eval "get_role( 'editor' )->add_cap( 'fotogrids_retired_cap' );"
$WP option update fotogrids_caps_version 1.0 --quiet
load

assert_eq yes "$( role_has editor fotogrids_retired_cap )" \
	"the resync grants, and never revokes"

scratch_teardown
