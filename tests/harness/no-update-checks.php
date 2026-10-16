<?php
/**
 * Stops the update checks core runs on admin loads, so a scratch site never
 * calls WordPress.org.
 *
 * @package FotoGrids\Tests
 */

remove_action( 'admin_init', '_maybe_update_core' );
remove_action( 'admin_init', '_maybe_update_plugins' );
remove_action( 'admin_init', '_maybe_update_themes' );
remove_action( 'load-plugins.php', 'wp_update_plugins' );
remove_action( 'load-themes.php', 'wp_update_themes' );
