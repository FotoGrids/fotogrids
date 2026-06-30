<?php
/**
 * PHPUnit bootstrap for FotoGrids pure-unit tests.
 *
 * These tests run plain PHP classes in isolation and do NOT load WordPress.
 * When a test needs the WP test harness (DB-backed, hook-aware), add the
 * WP_PHPUNIT__DIR / yoast wp-test-utils setup here behind an env guard so the
 * isolated suite keeps running without a WordPress install.
 *
 * @package FotoGrids
 */

require_once dirname( __DIR__, 2 ) . '/vendor/autoload.php';

// WPINC is a WordPress core constant the plugin's files guard on. Define it so
// isolated classes load without a full WordPress bootstrap.
if ( ! defined( 'WPINC' ) ) {
	define( 'WPINC', 'wp-includes' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- WordPress core constant, not plugin-owned.
}

// Plugin dir, pointing at the real src/ so catalog/partial tests read the
// shipped JSON files.
if ( ! defined( 'FOTOGRIDS_PLUGIN_DIR' ) ) {
	define( 'FOTOGRIDS_PLUGIN_DIR', dirname( __DIR__, 2 ) . '/src/' );
}

// Minimal WordPress function stubs used by isolated catalog classes.
if ( ! function_exists( 'trailingslashit' ) ) {
	/**
	 * @param string $value Path.
	 * @return string
	 */
	function trailingslashit( $value ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- WordPress core function stubbed for the isolated test suite.
		return rtrim( (string) $value, '/\\' ) . '/';
	}
}
