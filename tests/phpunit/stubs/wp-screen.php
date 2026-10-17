<?php
/**
 * Test double for get_current_screen(), returning $GLOBALS['fotogrids_test_screen'].
 *
 * @package FotoGrids
 */

if ( ! function_exists( 'get_current_screen' ) ) {
	/**
	 * Current screen set by the test.
	 *
	 * @return object|null
	 */
	function get_current_screen() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- Stands in for the WordPress core function.
		return $GLOBALS['fotogrids_test_screen'] ?? null;
	}
}
