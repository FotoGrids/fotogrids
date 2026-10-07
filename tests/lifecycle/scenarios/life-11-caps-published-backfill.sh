# LIFE-07, the 1.3 step. An install at caps version 1.2 grants the published-state
# gallery and album capabilities to roles that can publish but were never given
# them, and leaves alone a role whose permissions the site owner set.
#
# The 1.2 state is rebuilt by hand: activation grants today's defaults, so the
# capabilities a 1.2 activation left out are removed again before the load.

scratch_install life11
scratch_activate

load() {
	$WP option get fotogrids_caps_version >/dev/null
}

role_has() {
	$WP eval "\$r = get_role( '$1' );
		echo ( \$r && ! empty( \$r->capabilities['$2'] ) ) ? 'yes' : 'no';"
}

# What a 1.2 activation gave the author: publish, but no published-state caps.
$WP eval '
$author = get_role( "author" );
foreach ( array( "galleries", "albums" ) as $plural ) {
	$author->remove_cap( "edit_published_fotogrids_{$plural}" );
	$author->remove_cap( "delete_published_fotogrids_{$plural}" );
}'

# The owner raised album content to Editor, which removes every cap in the row.
$WP eval '
$author = get_role( "author" );
foreach ( array( "edit_fotogrids_album", "read_fotogrids_album", "delete_fotogrids_album", "edit_fotogrids_albums", "publish_fotogrids_albums", "delete_fotogrids_albums" ) as $cap ) {
	$author->remove_cap( $cap );
}'

# A role from another plugin that may publish galleries but not delete them.
$WP role create fg-publisher "FG Publisher" --quiet
$WP cap add fg-publisher edit_fotogrids_galleries publish_fotogrids_galleries --quiet

assert_eq no "$( role_has author edit_published_fotogrids_galleries )" \
	"the author starts without the published-state caps"

$WP option update fotogrids_caps_version 1.2 --quiet
load

assert_eq 1.3 "$( $WP option get fotogrids_caps_version )" "the stored version moved to 1.3"

assert_eq yes "$( role_has author edit_published_fotogrids_galleries )" \
	"an author who can publish galleries can now edit published ones"
assert_eq yes "$( role_has author delete_published_fotogrids_galleries )" \
	"and delete published ones"

assert_eq no "$( role_has author publish_fotogrids_albums )" \
	"the album row the owner raised to Editor stays raised"
assert_eq no "$( role_has author edit_published_fotogrids_albums )" \
	"the author was not given published-state album caps"

assert_eq yes "$( role_has fg-publisher edit_published_fotogrids_galleries )" \
	"a custom role that can publish gets edit_published"
assert_eq no "$( role_has fg-publisher delete_published_fotogrids_galleries )" \
	"but not delete_published, since it cannot delete"

for role in contributor subscriber; do
	count=$( $WP eval "\$r = get_role( '$role' ); echo count( array_filter( array_keys( array_filter( \$r->capabilities ) ), fn( \$c ) => false !== strpos( \$c, 'fotogrids' ) ) );" )
	assert_eq 0 "$count" "$role still holds no plugin capabilities"
done

# The step runs once: at 1.3 a removed capability stays removed.
$WP eval 'get_role( "author" )->remove_cap( "edit_published_fotogrids_galleries" );'
load
assert_eq no "$( role_has author edit_published_fotogrids_galleries )" \
	"a load at 1.3 does not run the step again"

$WP role delete fg-publisher --quiet
scratch_teardown
