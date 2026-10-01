# LIFE-03. Activation grants capabilities down the ladder the registry declares.
#
# Compared against cpt_cap_defaults() rather than a fixed count, so a new
# capability does not fail this row for existing on purpose. The invariants that
# would be bugs are asserted literally: contributor and subscriber get nothing,
# and a role never holds a capability the ladder puts above it.

scratch_install life03
scratch_activate

for role in contributor subscriber; do
	count=$( $WP eval "\$r = get_role( '$role' ); echo count( array_filter( array_keys( array_filter( \$r->capabilities ) ), fn( \$c ) => false !== strpos( \$c, 'fotogrids' ) ) );" )
	assert_eq 0 "$count" "$role holds no plugin capabilities"
done

# Every capability the defaults put at 'author' reaches author, editor and admin.
missing=$( $WP eval '
$defaults = \FotoGrids\Permissions\Core_Permissions::cpt_cap_defaults();
$missing = array();
foreach ( $defaults as $cap => $lowest ) {
	$roles = "author" === $lowest
		? array( "author", "editor", "administrator" )
		: array( "editor", "administrator" );
	foreach ( $roles as $name ) {
		$role = get_role( $name );
		if ( ! $role || empty( $role->capabilities[ $cap ] ) ) { $missing[] = "$name:$cap"; }
	}
}
echo implode( " ", $missing );' )
assert_eq "" "$missing" "every capability reached the roles at or above its floor"

# And nothing leaked below its floor.
leaked=$( $WP eval '
$defaults = \FotoGrids\Permissions\Core_Permissions::cpt_cap_defaults();
$leaked = array();
foreach ( $defaults as $cap => $lowest ) {
	if ( "author" === $lowest ) { continue; }
	$role = get_role( "author" );
	if ( $role && ! empty( $role->capabilities[ $cap ] ) ) { $leaked[] = "author:$cap"; }
}
echo implode( " ", $leaked );' )
assert_eq "" "$leaked" "no capability reached a role below its floor"

# The ladder describes something, rather than being empty.
count=$( $WP eval 'echo count( \FotoGrids\Permissions\Core_Permissions::cpt_cap_defaults() );' )
if [ "$count" -gt 20 ]; then
	pass "the ladder covers $count capabilities"
else
	fail "the ladder covers only $count capabilities, so the checks above prove little"
fi

scratch_teardown
