<?php
/**
 * PHPUnit bootstrap for the DB-backed suite.
 *
 * Boots WordPress with its own test harness and the plugin active, so a test
 * gets a real $wpdb, real users and real capabilities. The isolated suite in
 * tests/phpunit stays WordPress-free and is not affected by anything here.
 *
 *   composer test:php:db
 *
 * WordPress and the core test includes come from tests/phpunit-db/install-wp.sh;
 * the polyfills they require come from Composer. Every path is overridable
 * through the environment.
 *
 * @package FotoGrids
 */

$fg_root = dirname( __DIR__, 2 );

$fg_wp_version = getenv( 'FG_TESTS_WP_VERSION' ) ?: '6.8';
$fg_wp = getenv( 'FG_TESTS_WP_DIR' ) ?: __DIR__ . '/.wp';

$fg_includes = getenv( 'FG_TESTS_INCLUDES_DIR' ) ?: "$fg_wp/$fg_wp_version/tests/includes";
$fg_polyfills = getenv( 'FG_TESTS_POLYFILLS_DIR' ) ?: $fg_root . '/vendor/yoast/phpunit-polyfills';
$fg_plugin = getenv( 'FG_TESTS_PLUGIN' ) ?: $fg_root . '/dist/fotogrids/fotogrids.php';

foreach ( array(
	$fg_includes . '/functions.php' => 'the core test includes — run tests/phpunit-db/install-wp.sh',
	$fg_polyfills . '/phpunitpolyfills-autoload.php' => 'the PHPUnit polyfills — run composer install',
	$fg_plugin => 'the built plugin — run npm run build:dev',
) as $fg_path => $fg_what ) {
	if ( ! file_exists( $fg_path ) ) {
		echo "Cannot find $fg_what.\nLooked in $fg_path.\n";
		exit( 1 );
	}
}

/**
 * Make the plugin rebuild its own schema from the current activator.
 *
 * The harness drops and recreates WordPress' own tables per bootstrap, but not
 * the plugin's, and dbDelta will not remove an index or a column that is
 * already there — so without this the schema under test is an accumulation of
 * every version that has ever run against this database.
 *
 * Dropping the tables and the stored version leaves the plugin's own
 * `maybe_upgrade` to recreate them on `plugins_loaded`, and the capability
 * resync to grant caps on `init`. Calling `Activator::activate()` here instead
 * would fire the module and tool registration actions a second time, which the
 * registries log as a replacement for every tool.
 *
 * Not on `wp_install`, which fires in the harness's install subprocess where a
 * filter added here never reaches.
 */
function fg_tests_reset_schema(): void {
	global $wpdb;

	foreach ( $wpdb->get_col( "SHOW TABLES LIKE '{$wpdb->prefix}fotogrids\_%'" ) as $table ) {
		$wpdb->query( "DROP TABLE IF EXISTS `$table`" );
	}

	delete_option( 'fotogrids_db_version' );
	delete_option( 'fotogrids_caps_version' );
}

define( 'WP_TESTS_PHPUNIT_POLYFILLS_PATH', $fg_polyfills );
define( 'WP_TESTS_CONFIG_FILE_PATH', __DIR__ . '/wp-tests-config.php' );

require_once $fg_includes . '/functions.php';

// Activation hooks do not fire here, so the schema and capabilities are created
// explicitly - the tables are what half of this suite asserts on.
tests_add_filter(
	'muplugins_loaded',
	static function () use ( $fg_plugin ) {
		require $fg_plugin;
		fg_tests_reset_schema();
	}
);

require $fg_includes . '/bootstrap.php';

