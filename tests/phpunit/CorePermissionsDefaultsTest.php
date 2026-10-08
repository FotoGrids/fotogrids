<?php
/**
 * Unit tests for the default lowest role of each gallery and album capability.
 *
 * @package FotoGrids
 */

declare( strict_types=1 );

use FotoGrids\Permissions\Core_Permissions;
use PHPUnit\Framework\TestCase;

require_once dirname( __DIR__, 2 ) . '/src/includes/permissions/class-core-permissions.php';

/**
 * Covers Core_Permissions::cpt_cap_defaults().
 */
final class CorePermissionsDefaultsTest extends TestCase {

	/**
	 * Collection types by their capability plural.
	 *
	 * @return array<string, array{string}>
	 */
	public function plurals(): array {
		return array(
			'galleries' => array( 'galleries' ),
			'albums'    => array( 'albums' ),
		);
	}

	/**
	 * A role that can publish a collection can also edit and delete it once published.
	 *
	 * @dataProvider plurals
	 * @param string $plural Capability plural.
	 */
	public function test_publishing_role_keeps_published_state_caps( string $plural ): void {
		$defaults = Core_Permissions::cpt_cap_defaults();
		$publish  = $defaults[ "publish_fotogrids_{$plural}" ];

		$this->assertSame( $publish, $defaults[ "edit_published_fotogrids_{$plural}" ] );
		$this->assertSame( $publish, $defaults[ "delete_published_fotogrids_{$plural}" ] );
	}
}
