<?php
/**
 * Unit tests for the collection post type constants, kind mapping, and the
 * collection-screen admin body classes.
 *
 * @package FotoGrids
 */

declare( strict_types=1 );

use FotoGrids\Admin\Admin_Body_Class;
use FotoGrids\Post_Types;
use PHPUnit\Framework\TestCase;

require_once dirname( __DIR__, 2 ) . '/src/includes/class-post-types.php';
require_once dirname( __DIR__, 2 ) . '/src/includes/admin/class-admin-body-class.php';
require_once __DIR__ . '/stubs/wp-screen.php';

/**
 * Post_Types and Admin_Body_Class.
 */
final class PostTypesTest extends TestCase {

	protected function tearDown(): void {
		unset( $GLOBALS['fotogrids_test_screen'] );
	}

	public function test_post_type_values(): void {
		$this->assertSame( 'fotogrids_gallery', Post_Types::GALLERY );
		$this->assertSame( 'fotogrids_album', Post_Types::ALBUM );
		$this->assertSame( array( 'fotogrids_gallery', 'fotogrids_album' ), Post_Types::COLLECTION_TYPES );
	}

	/**
	 * @return array<string, array{0: string|null, 1: string|null}>
	 */
	public function kind_provider(): array {
		return array(
			'gallery post type' => array( 'fotogrids_gallery', 'gallery' ),
			'album post type'   => array( 'fotogrids_album', 'album' ),
			'gallery kind'      => array( 'gallery', 'gallery' ),
			'album kind'        => array( 'album', 'album' ),
			'embed post type'   => array( 'fotogrids_embed', null ),
			'core post type'    => array( 'post', null ),
			'empty'             => array( '', null ),
			'null'              => array( null, null ),
		);
	}

	/**
	 * @dataProvider kind_provider
	 *
	 * @param string|null $type     Input.
	 * @param string|null $expected Expected kind.
	 */
	public function test_kind_of( ?string $type, ?string $expected ): void {
		$this->assertSame( $expected, Post_Types::kind_of( $type ) );
	}

	/**
	 * @return array<string, array{0: string, 1: string}>
	 */
	public function screen_provider(): array {
		return array(
			'gallery screen' => array( 'fotogrids_gallery', 'base fotogrids-collection-screen fotogrids-collection-screen--gallery' ),
			'album screen'   => array( 'fotogrids_album', 'base fotogrids-collection-screen fotogrids-collection-screen--album' ),
			'post screen'    => array( 'post', 'base' ),
			'gallery-named'  => array( 'gallery', 'base' ),
			'no post type'   => array( '', 'base' ),
		);
	}

	/**
	 * @dataProvider screen_provider
	 *
	 * @param string $post_type Screen post type.
	 * @param string $expected  Expected body classes.
	 */
	public function test_body_classes( string $post_type, string $expected ): void {
		$GLOBALS['fotogrids_test_screen'] = (object) array( 'post_type' => $post_type );

		$this->assertSame( $expected, Admin_Body_Class::add( 'base' ) );
	}

	public function test_body_classes_without_screen(): void {
		$this->assertSame( 'base', Admin_Body_Class::add( 'base' ) );
	}
}
