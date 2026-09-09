<?php
/**
 * Front controller for `php -S`, which has no .htaccess and no mod_rewrite.
 *
 * Serves an existing file as-is and sends everything else to index.php, which
 * is what WordPress needs for pretty permalinks. Without this the plugin's
 * standalone view pages 404 and every REST route falls back to ?rest_route=,
 * which is a different code path from the one production uses.
 *
 * @package FotoGrids\Tests
 */

// DOCUMENT_ROOT, not __DIR__: the router lives in tests/harness/ while the
// docroot is the WordPress install `php -S -t` was pointed at.
$docroot = rtrim( $_SERVER['DOCUMENT_ROOT'], '/' );
$path    = parse_url( $_SERVER['REQUEST_URI'], PHP_URL_PATH );
$file    = $docroot . $path;

// wp-admin/ and similar directory requests resolve to their index.php.
if ( is_dir( $file ) && file_exists( rtrim( $file, '/' ) . '/index.php' ) ) {
	$_SERVER['SCRIPT_NAME'] = rtrim( $path, '/' ) . '/index.php';
	require rtrim( $file, '/' ) . '/index.php';
	return true;
}

if ( is_file( $file ) ) {
	// Let the built-in server stream static assets itself.
	if ( substr( $file, -4 ) !== '.php' ) {
		return false;
	}
	$_SERVER['SCRIPT_NAME'] = $path;
	require $file;
	return true;
}

$_SERVER['SCRIPT_NAME'] = '/index.php';
require $docroot . '/index.php';
