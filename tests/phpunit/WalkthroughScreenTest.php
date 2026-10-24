<?php
/**
 * Walkthrough_Screen rules.
 *
 * @package FotoGrids
 */

declare( strict_types=1 );

use FotoGrids\Modules\Walkthrough\Walkthrough_Screen;
use PHPUnit\Framework\TestCase;

require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-post-types.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/modules/Walkthrough/class-walkthrough-state.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/modules/Walkthrough/class-walkthrough-screen.php';

final class WalkthroughScreenTest extends TestCase {

	/**
	 * @dataProvider auto_start_cases
	 * @param string $state          Stored state.
	 * @param bool   $is_empty       Whether the collection is empty.
	 * @param bool   $authored_other Whether the user made another one.
	 * @param bool   $expected       Whether the tour opens by itself.
	 */
	public function test_auto_starts( string $state, bool $is_empty, bool $authored_other, bool $expected ): void {
		$this->assertSame( $expected, Walkthrough_Screen::auto_starts( $state, $is_empty, $authored_other ) );
	}

	/**
	 * @return array<string, array<int, string|bool>>
	 */
	public function auto_start_cases(): array {
		return array(
			'first time'           => array( '', true, false, true ),
			'collection has items' => array( '', false, false, false ),
			'authored another'     => array( '', true, true, false ),
			'done'                 => array( 'done', true, false, false ),
			'skipped'              => array( 'skipped', true, false, false ),
			'publish pending'      => array( 'publish-pending', true, false, false ),
		);
	}

	/**
	 * @dataProvider resume_cases
	 * @param string $state    Stored state.
	 * @param bool   $is_saved Whether the collection was saved.
	 * @param bool   $expected Whether the last part opens.
	 */
	public function test_resumes( string $state, bool $is_saved, bool $expected ): void {
		$this->assertSame( $expected, Walkthrough_Screen::resumes( $state, $is_saved ) );
	}

	/**
	 * @return array<string, array<int, string|bool>>
	 */
	public function resume_cases(): array {
		return array(
			'pending and saved'   => array( 'publish-pending', true, true ),
			'pending, not saved'  => array( 'publish-pending', false, false ),
			'done and saved'      => array( 'done', true, false ),
			'never ran and saved' => array( '', true, false ),
		);
	}

	/**
	 * @dataProvider screens
	 * @param string $id        Screen id.
	 * @param string $base      Screen base.
	 * @param string $post_type Screen post type.
	 * @param string $expected  Tour id.
	 */
	public function test_tour_for( string $id, string $base, string $post_type, string $expected ): void {
		$this->assertSame( $expected, Walkthrough_Screen::tour_for( $id, $base, $post_type ) );
	}

	/**
	 * @return array<string, array<int, string>>
	 */
	public function screens(): array {
		return array(
			'gallery editor'    => array( 'fotogrids_gallery', 'post', 'fotogrids_gallery', 'gallery' ),
			'album editor'      => array( 'fotogrids_album', 'post', 'fotogrids_album', 'album' ),
			'dashboard top'     => array( 'toplevel_page_fotogrids', 'toplevel_page_fotogrids', '', 'dashboard' ),
			'dashboard submenu' => array( 'fotogrids_page_fotogrids-dashboard', 'fotogrids_page_fotogrids-dashboard', '', 'dashboard' ),
			'gallery list'      => array( 'edit-fotogrids_gallery', 'edit', 'fotogrids_gallery', '' ),
			'post editor'       => array( 'post', 'post', 'post', '' ),
			'settings page'     => array( 'fotogrids_page_fotogrids-settings', 'fotogrids_page_fotogrids-settings', '', '' ),
		);
	}
}
