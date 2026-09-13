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

// ABSPATH is the constant the hook-catalogue classes guard on; without it they
// exit at file scope and the suite dies before any test runs.
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', dirname( __DIR__, 2 ) . '/' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- WordPress core constant, not plugin-owned.
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

// Translation lookups for the isolated suite. A test populates
// $GLOBALS['fotogrids_test_translations'][ $domain ][ $original ] to stand in for
// a compiled .mo file.
if ( ! function_exists( '__' ) ) {
	/**
	 * @param string $text   Text to translate.
	 * @param string $domain Text domain.
	 * @return string
	 */
	function __( $text, $domain = 'default' ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- WordPress core function stubbed for the isolated test suite.
		$translations = $GLOBALS['fotogrids_test_translations'][ $domain ] ?? array();

		return $translations[ $text ] ?? $text;
	}
}

// Filter dispatch for the isolated suite. A test populates
// $GLOBALS['fotogrids_test_filters'][ $hook_name ] with a callable.
if ( ! function_exists( 'apply_filters' ) ) {
	/**
	 * @param string $hook_name Filter name.
	 * @param mixed  $value     Value being filtered.
	 * @return mixed
	 */
	function apply_filters( $hook_name, $value ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- WordPress core function stubbed for the isolated test suite.
		$callback = $GLOBALS['fotogrids_test_filters'][ $hook_name ] ?? null;

		return null === $callback ? $value : $callback( $value );
	}
}

// Stand-in for wp_kses in the isolated suite: filters tags to the allowlist so
// the key policy in Catalog_I18n can be asserted. Real wp_kses also filters
// attributes and normalises entities; this double does neither.
if ( ! function_exists( 'wp_kses' ) ) {
	/**
	 * @param string                            $string       Text to filter.
	 * @param array<string, array<string, bool>> $allowed_html Allowed tags.
	 * @return string
	 */
	function wp_kses( $string, $allowed_html ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- WordPress core function stubbed for the isolated test suite.
		return strip_tags( (string) $string, array_keys( (array) $allowed_html ) );
	}
}
