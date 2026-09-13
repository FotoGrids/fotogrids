<?php
/**
 * Plugin constants for static analysis.
 *
 * PHPStan does not execute code, so the constants fotogrids.php defines at
 * runtime are invisible to it. Defining them here lets the analyser resolve
 * both the constants themselves and the `require_once FOTOGRIDS_PLUGIN_DIR .
 * '...'` chains that load the plugin.
 *
 * FOTOGRIDS_PLUGIN_DIR must be the real src/ path for those requires to
 * resolve; the remaining values are placeholders of the correct type.
 *
 * WordPress core constants (ABSPATH, ARRAY_A, DAY_IN_SECONDS, ...) come from
 * szepeviktor/phpstan-wordpress and are not repeated here.
 *
 * @package FotoGrids
 */

define( 'FOTOGRIDS_VERSION', '0.0.0' );
define( 'FOTOGRIDS_PLUGIN_DIR', dirname( __DIR__, 2 ) . '/src/' );
define( 'FOTOGRIDS_PLUGIN_URL', 'https://example.com/wp-content/plugins/fotogrids/' );
define( 'FOTOGRIDS_PLUGIN_FILE', FOTOGRIDS_PLUGIN_DIR . 'fotogrids.php' );
define( 'FOTOGRIDS_PLUGIN_BASENAME', 'fotogrids/fotogrids.php' );
define( 'FOTOGRIDS_PRO_VERSION', '0.0.0' );
define( 'COOKIEPATH', '/' );
