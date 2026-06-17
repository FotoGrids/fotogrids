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
