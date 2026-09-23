<?php
/**
 * Every value-bearing catalog setting has a collection default.
 *
 * Gallery_Repository::get_settings() and Album_Repository::get_settings() only
 * read stored meta for keys present in the resolved defaults, so a catalog key
 * without a default can be saved from the admin but never read back.
 *
 * @package FotoGrids
 */

declare( strict_types=1 );

use FotoGrids\Catalog\Catalog;
use FotoGrids\Catalog\Catalog_Partial_Expander;
use FotoGrids\Collection_Defaults;
use PHPUnit\Framework\TestCase;

require_once FOTOGRIDS_PLUGIN_DIR . 'includes/hooks/filters/class-filters-catalog.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/hooks/filters/class-filters-settings.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/catalog/class-catalog-partial-expander.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/catalog/class-catalog.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/exif/class-exif-fields.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/class-collection-defaults.php';

final class CollectionDefaultsCoverageTest extends TestCase {

	/**
	 * Catalog field types that render UI but hold no stored value.
	 */
	private const DISPLAY_ONLY_TYPES = array(
		'setting_group',
		'side_by_side',
		'setting_subtabs',
		'info_block',
		'promo',
		'cache_status',
		'watermark_status',
		'external_url_manager',
	);

	/**
	 * Catalog keys with no renderer or reader yet, so no default is expected.
	 */
	private const KEYS_WITHOUT_READER = array(
		'video_autoplay_on_open',
		'video_autoplay_on_slide',
		'video_advance_after_end',
		'edit_role_permission_type',
		'edit_allowed_roles',
		'edit_allowed_users',
		'view_role_permission_type',
		'view_allowed_roles',
	);

	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['fotogrids_test_filters'] = array();
		Catalog::reset_for_tests();
		Catalog_Partial_Expander::reset_for_tests();
	}

	protected function tearDown(): void {
		Catalog::reset_for_tests();
		Catalog_Partial_Expander::reset_for_tests();
		parent::tearDown();
	}

	/**
	 * Keys of every catalog field that stores a value.
	 *
	 * @return array<int, string>
	 */
	private function value_keys(): array {
		$keys = array();
		$this->collect_value_keys( Catalog::raw_files(), $keys );
		return array_values( array_unique( $keys ) );
	}

	/**
	 * Walk an assembled catalog branch and collect value-bearing field keys.
	 *
	 * @param mixed              $node Catalog branch.
	 * @param array<int, string> $keys Collected keys.
	 * @return void
	 */
	private function collect_value_keys( $node, array &$keys ): void {
		if ( ! is_array( $node ) ) {
			return;
		}
		if ( isset( $node['key'], $node['type'] ) && is_string( $node['key'] ) && ! in_array( $node['type'], self::DISPLAY_ONLY_TYPES, true ) ) {
			$keys[] = $node['key'];
		}
		foreach ( $node as $child ) {
			$this->collect_value_keys( $child, $keys );
		}
	}

	/**
	 * Union of the gallery and album default keys.
	 *
	 * @return array<string, mixed>
	 */
	private function defaults(): array {
		return Collection_Defaults::resolve_gallery() + Collection_Defaults::resolve_album();
	}

	public function test_every_catalog_value_key_has_a_default(): void {
		$defaults = $this->defaults();

		$missing = array_values(
			array_filter(
				$this->value_keys(),
				static fn( string $key ): bool => ! array_key_exists( $key, $defaults )
					&& ! in_array( $key, self::KEYS_WITHOUT_READER, true )
			)
		);

		$this->assertSame( array(), $missing, 'Catalog keys that can be saved but never read back: ' . implode( ', ', $missing ) );
	}

	public function test_keys_without_reader_are_still_catalog_keys_without_a_default(): void {
		$defaults   = $this->defaults();
		$value_keys = $this->value_keys();

		foreach ( self::KEYS_WITHOUT_READER as $key ) {
			$this->assertContains( $key, $value_keys, "$key is no longer in the catalog; drop it from KEYS_WITHOUT_READER." );
			$this->assertArrayNotHasKey( $key, $defaults, "$key now has a default; drop it from KEYS_WITHOUT_READER." );
		}
	}
}
