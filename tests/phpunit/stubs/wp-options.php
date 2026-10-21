<?php
/**
 * Test doubles for the option and user meta functions, backed by
 * $GLOBALS['fotogrids_test_options'] and $GLOBALS['fotogrids_test_user_meta'].
 *
 * Setting $GLOBALS['fotogrids_test_fail_writes'] makes every write return false.
 *
 * @package FotoGrids
 */

if ( ! function_exists( 'get_option' ) ) {
	/**
	 * @param string $option        Option name.
	 * @param mixed  $default_value Value when the option is absent.
	 * @return mixed
	 */
	function get_option( $option, $default_value = false ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- Stands in for the WordPress core function.
		return array_key_exists( $option, $GLOBALS['fotogrids_test_options'] ?? array() )
			? $GLOBALS['fotogrids_test_options'][ $option ]
			: $default_value;
	}
}

if ( ! function_exists( 'update_option' ) ) {
	/**
	 * @param string $option   Option name.
	 * @param mixed  $value    Value.
	 * @param mixed  $autoload Ignored.
	 * @return bool False when unchanged or when writes fail.
	 */
	function update_option( $option, $value, $autoload = null ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, Generic.CodeAnalysis.UnusedFunctionParameter -- Stands in for the WordPress core function.
		if ( ! empty( $GLOBALS['fotogrids_test_fail_writes'] ) ) {
			return false;
		}
		if ( array_key_exists( $option, $GLOBALS['fotogrids_test_options'] ?? array() ) && $GLOBALS['fotogrids_test_options'][ $option ] === $value ) {
			return false;
		}
		$GLOBALS['fotogrids_test_options'][ $option ] = $value;
		return true;
	}
}

if ( ! function_exists( 'get_user_meta' ) ) {
	/**
	 * @param int    $user_id User ID.
	 * @param string $key     Meta key.
	 * @param bool   $single  Return a single value.
	 * @return mixed '' (or array()) when absent.
	 */
	function get_user_meta( $user_id, $key = '', $single = false ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- Stands in for the WordPress core function.
		$meta = $GLOBALS['fotogrids_test_user_meta'][ (int) $user_id ] ?? array();
		if ( ! array_key_exists( $key, $meta ) ) {
			return $single ? '' : array();
		}
		return $single ? $meta[ $key ] : array( $meta[ $key ] );
	}
}

if ( ! function_exists( 'update_user_meta' ) ) {
	/**
	 * @param int    $user_id User ID.
	 * @param string $key     Meta key.
	 * @param mixed  $value   Value.
	 * @return bool False when unchanged or when writes fail.
	 */
	function update_user_meta( $user_id, $key, $value ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- Stands in for the WordPress core function.
		if ( ! empty( $GLOBALS['fotogrids_test_fail_writes'] ) ) {
			return false;
		}
		$meta = $GLOBALS['fotogrids_test_user_meta'][ (int) $user_id ] ?? array();
		if ( array_key_exists( $key, $meta ) && $meta[ $key ] === $value ) {
			return false;
		}
		$GLOBALS['fotogrids_test_user_meta'][ (int) $user_id ][ $key ] = $value;
		return true;
	}
}
