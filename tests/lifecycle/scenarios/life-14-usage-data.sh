# LIFE-19. Share usage data, switched off and on again once the site has a
# Freemius account.
#
# The Freemius API is answered by tests/harness/freemius-api.php, which records every
# request in the fs_test_log option.

scratch_install life14
mkdir -p "$SCRATCH_DIR/wp-content/mu-plugins"
cp "$HERE/../harness/freemius-api.php" "$SCRATCH_DIR/wp-content/mu-plugins/"
scratch_activate

consent() {
	$WP --user=admin eval "\\FotoGrids\\Settings\\Plugin_Settings_Store::apply_share_statistics_consent( $1 );"
}

requests() {
	$WP eval 'foreach ( (array) get_option( "fs_test_log", array() ) as $r ) { echo $r["m"], " ", strtok( $r["u"], "?" ), " ", $r["b"], "\n"; }'
}

freemius() {
	$WP eval "\$fs = freemius( 'fotogrids' ); echo $1;"
}

sync_scheduled() {
	$WP eval 'echo wp_next_scheduled( "fs_data_sync_fotogrids" ) ? "yes" : "no";'
}

consent true
$WP --user=admin eval '\FotoGrids\Settings\Plugin_Settings_Store::apply_marketing_consent( true );'

# What the first admin page load after opting in does: mark the plugin loaded
# and schedule the daily sync.
$WP eval '$a = get_option( "fs_accounts" );
	$a["plugin_data"]["fotogrids"]["was_plugin_loaded"] = true;
	update_option( "fs_accounts", $a );
	$fs = freemius( "fotogrids" );
	$m  = new ReflectionMethod( $fs, "maybe_schedule_sync_cron" );
	$m->setAccessible( true );
	$m->invoke( $fs );'

assert_eq 1 "$( freemius '(int) $fs->is_registered()' )" "opting in registers the site with Freemius"
assert_eq yes "$( sync_scheduled )" "and schedules its daily sync"

$WP option delete fs_test_log --quiet
consent false
off=$( requests )

assert_eq 0 "$( $WP option get fotogrids_share_statistics )" "switching it off stores the choice"
assert_contains "$off" '/users/11.json {"is_marketing_allowed":false}' \
	"product-email consent is revoked on the Freemius server"
assert_contains "$off" '/installs/22/permissions.json {"permissions":"user,site,extensions","is_enabled":false}' \
	"and the tracking permissions are switched off there too"
assert_eq no "$( sync_scheduled )" "the daily sync is no longer scheduled"
assert_eq 1 "$( freemius '(int) $fs->is_anonymous()' )" "and the account is disconnected"

$WP option delete fs_test_log --quiet
consent true
on=$( requests )

assert_contains "$on" '/installs/22/permissions.json {"permissions":"user,site,extensions","is_enabled":true}' \
	"switching it back on grants the permissions on the server"
case "$on" in
	*'/action/service/user/install/'*) fail "switching it back on registered the site a second time" ;;
	*) pass "without registering the site a second time" ;;
esac
assert_eq yes "$( sync_scheduled )" "the daily sync is scheduled again"
assert_eq 1 "$( freemius '(int) $fs->is_registered()' )" "and the account is connected again"

# Freemius refusing the opt-out must still leave nothing to send.
$WP option update fs_test_fail 1 --quiet
consent false
$WP option delete fs_test_fail --quiet

assert_eq 0 "$( $WP option get fotogrids_share_statistics )" "with the Freemius API failing, the choice is still stored as off"
assert_eq 0 "$( freemius '(int) $fs->is_tracking_allowed()' )" "tracking is switched off on the site"
assert_eq 1 "$( freemius '(int) $fs->is_anonymous()' )" "and the account is disconnected locally"

scratch_teardown
