<?php
/**
 * Database and site settings for the DB-backed suite.
 *
 * Every value comes from the environment so CI and a local run share this file.
 * The WordPress test harness drops and recreates every table in DB_NAME on each
 * bootstrap, so the default name is the suite's own and never the one
 * tests/harness/boot.sh installs into.
 *
 * @package FotoGrids
 */

$fg_wp_version = getenv( 'FG_TESTS_WP_VERSION' ) ?: '6.8';
$fg_wp = getenv( 'FG_TESTS_WP_DIR' ) ?: __DIR__ . '/.wp';

define( 'ABSPATH', ( getenv( 'FG_TESTS_ABSPATH' ) ?: "$fg_wp/$fg_wp_version/wordpress" ) . '/' );

define( 'DB_NAME', getenv( 'FG_TESTS_DB_NAME' ) ?: 'fotogrids_phpunit' );
define( 'DB_USER', getenv( 'FG_TESTS_DB_USER' ) ?: 'root' );
define( 'DB_PASSWORD', getenv( 'FG_TESTS_DB_PASS' ) ?: '' );
define( 'DB_HOST', getenv( 'FG_TESTS_DB_HOST' ) ?: '127.0.0.1' );
define( 'DB_CHARSET', 'utf8' );
define( 'DB_COLLATE', '' );

$table_prefix = 'wptests_';

define( 'WP_TESTS_DOMAIN', 'example.org' );
define( 'WP_TESTS_EMAIL', 'admin@example.org' );
define( 'WP_TESTS_TITLE', 'FotoGrids DB tests' );
define( 'WP_PHP_BINARY', 'php' );

// The harness defines DISABLE_WP_CRON itself, and redefining it is a warning
// the suite is configured to fail on.
if ( ! defined( 'WP_DEBUG' ) ) {
	define( 'WP_DEBUG', true );
}
