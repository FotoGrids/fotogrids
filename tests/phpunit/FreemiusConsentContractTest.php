<?php
/**
 * The vendored Freemius SDK still offers what the usage-data choice relies on.
 *
 * Plugin_Settings_Store::apply_share_statistics_consent() reaches the SDK's
 * private Freemius::toggle_permission_tracking() through reflection, so a
 * vendored SDK update that renames it or changes its arguments would leave the
 * choice switching nothing on the Freemius side without an error.
 *
 * @package FotoGrids
 */

declare( strict_types=1 );

use PHPUnit\Framework\TestCase;

final class FreemiusConsentContractTest extends TestCase {

	public function test_toggle_permission_tracking_keeps_its_signature(): void {
		$source = (string) file_get_contents( FOTOGRIDS_PLUGIN_DIR . 'freemius/includes/class-freemius.php' );

		$this->assertMatchesRegularExpression(
			'/function\s+toggle_permission_tracking\(\s*\$permissions\s*,\s*\$is_enabled\s*,\s*\$blog_id\s*=\s*null\s*\)/',
			$source
		);
	}

	public function test_toggle_permission_tracking_updates_the_server_and_the_sync(): void {
		$source = (string) file_get_contents( FOTOGRIDS_PLUGIN_DIR . 'freemius/includes/class-freemius.php' );
		$start  = strpos( $source, 'function toggle_permission_tracking(' );
		$body   = substr( $source, (int) $start, 4000 );

		$this->assertNotFalse( $start );
		$this->assertStringContainsString( 'update_site_permissions(', $body );
		$this->assertStringContainsString( 'clear_sync_cron(', $body );
		$this->assertStringContainsString( 'schedule_sync_cron(', $body );
		$this->assertStringContainsString( 'toggle_user_permission(', $body );
	}

	public function test_the_local_opt_out_methods_are_public(): void {
		$freemius = (string) file_get_contents( FOTOGRIDS_PLUGIN_DIR . 'freemius/includes/class-freemius.php' );
		$manager  = (string) file_get_contents( FOTOGRIDS_PLUGIN_DIR . 'freemius/includes/managers/class-fs-permission-manager.php' );

		$this->assertMatchesRegularExpression( '/\n\s*(public\s+)?function\s+skip_connection\(/', $freemius );
		$this->assertMatchesRegularExpression( '/\n\s*(public\s+)?function\s+update_site_tracking\(\s*\$is_enabled/', $manager );
	}

	public function test_the_permission_ids_still_exist(): void {
		$source = (string) file_get_contents( FOTOGRIDS_PLUGIN_DIR . 'freemius/includes/managers/class-fs-permission-manager.php' );

		foreach ( array( 'USER' => 'user', 'SITE' => 'site', 'EVENTS' => 'events', 'EXTENSIONS' => 'extensions' ) as $name => $id ) {
			$this->assertMatchesRegularExpression( "/const\\s+PERMISSION_{$name}\\s*=\\s*'{$id}'/", $source );
		}
	}
}
