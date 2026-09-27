<?php
/**
 * Unit tests for when the collection view-permissions gate claims a render.
 *
 * WP-independent: the gate guards on WPINC, which the bootstrap defines, and
 * supports() reads nothing but the render context.
 *
 * @package FotoGrids
 */

declare( strict_types=1 );

use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Columns_Mode;
use FotoGrids\Render\Api\Render_Behavior;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Render_Layout;
use FotoGrids\Render\Api\Render_Meta;
use FotoGrids\Render\Api\Render_Mode;
use FotoGrids\Render\Api\Request_Source;
use FotoGrids\Render\Gates\Collection_Permissions\Collection_Permissions;
use PHPUnit\Framework\TestCase;

$fotogrids_render_root = dirname( __DIR__, 2 ) . '/src/public/render/';
require_once $fotogrids_render_root . 'api/class-collection-kind.php';
require_once $fotogrids_render_root . 'api/class-columns-mode.php';
require_once $fotogrids_render_root . 'api/class-render-mode.php';
require_once $fotogrids_render_root . 'api/class-request-source.php';
require_once $fotogrids_render_root . 'api/class-render-meta.php';
require_once $fotogrids_render_root . 'api/class-render-layout.php';
require_once $fotogrids_render_root . 'api/class-render-behavior.php';
require_once $fotogrids_render_root . 'api/class-item-view.php';
require_once $fotogrids_render_root . 'api/class-render-context.php';
require_once $fotogrids_render_root . 'api/class-asset-decl.php';
require_once $fotogrids_render_root . 'api/class-module-assets.php';
require_once $fotogrids_render_root . 'api/class-gate-result.php';
require_once $fotogrids_render_root . 'api/trait-setting-helpers.php';
require_once $fotogrids_render_root . 'api/interface-gate.php';
require_once $fotogrids_render_root . 'gates/collection-permissions/class-collection-permissions.php';

final class CollectionPermissionsGateTest extends TestCase {

	/**
	 * @param array<string, mixed> $settings Render settings map.
	 */
	private function context( array $settings, bool $is_preview = false ): Render_Context {
		return new Render_Context(
			new Render_Meta(
				7,
				null,
				'fg-instance-7',
				Request_Source::SHORTCODE,
				$is_preview,
				Render_Mode::INITIAL,
				2,
				Collection_Kind::GALLERY
			),
			new Render_Layout(
				'grid',
				Columns_Mode::FIXED,
				array( 'desktop' => 3 ),
				array( 'desktop' => 10 ),
				array()
			),
			new Render_Behavior( 'lightbox', 'show_all', 'load_more', null, 'full' ),
			$settings,
			array()
		);
	}

	/**
	 * @return array<string, array{0: array<string, mixed>, 1: bool}>
	 */
	public function view_policy_matrix(): array {
		return array(
			'public'                 => array( array( 'who_can_view' => 'all' ), false ),
			'registered users only'  => array( array( 'who_can_view' => 'registered_users' ), true ),
			'specific roles'         => array( array( 'who_can_view' => 'specific_roles' ), true ),
			'an unrecognised policy' => array( array( 'who_can_view' => 'members_club' ), true ),
			'a single-value array'   => array( array( 'who_can_view' => array( 'specific_roles' ) ), true ),
			'an empty string'        => array( array( 'who_can_view' => '' ), false ),
			'no policy at all'       => array( array(), false ),
		);
	}

	/**
	 * @dataProvider view_policy_matrix
	 * @param array<string, mixed> $settings Render settings map.
	 */
	public function test_any_policy_other_than_all_claims_the_render( array $settings, bool $expected ): void {
		$this->assertSame(
			$expected,
			( new Collection_Permissions() )->supports( $this->context( $settings ) )
		);
	}

	public function test_the_gate_stays_out_of_admin_previews(): void {
		foreach ( array( 'registered_users', 'specific_roles' ) as $policy ) {
			$this->assertFalse(
				( new Collection_Permissions() )->supports(
					$this->context( array( 'who_can_view' => $policy ), true )
				),
				'Preview render for ' . $policy
			);
		}
	}
}
