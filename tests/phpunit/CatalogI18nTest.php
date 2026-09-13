<?php
/**
 * Tests for Catalog_I18n.
 *
 * @package FotoGrids
 */

declare(strict_types=1);

use FotoGrids\Catalog\Catalog_I18n;
use PHPUnit\Framework\TestCase;

require_once FOTOGRIDS_PLUGIN_DIR . 'includes/hooks/filters/class-filters-catalog.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/catalog/class-catalog-i18n.php';

/**
 * The catalog vocabulary lives in JSON, so these tests stand in for the
 * compiled .mo a real locale would supply and assert the generated registry
 * carries a translation from there into the assembled tree.
 */
final class CatalogI18nTest extends TestCase {

	/**
	 * A label that exists in the shipped catalog and in the generated registry.
	 */
	private const KNOWN_LABEL = 'Action on Hover';

	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['fotogrids_test_translations'] = array();
		$GLOBALS['fotogrids_test_filters']     = array();
		Catalog_I18n::reset_for_tests();
	}

	protected function tearDown(): void {
		$GLOBALS['fotogrids_test_translations'] = array();
		$GLOBALS['fotogrids_test_filters']     = array();
		Catalog_I18n::reset_for_tests();
		parent::tearDown();
	}

	public function test_the_generated_registry_covers_the_shipped_catalog_vocabulary(): void {
		$registry = require FOTOGRIDS_PLUGIN_DIR . 'includes/catalog/catalog-strings.php';

		$this->assertIsArray( $registry );
		$this->assertArrayHasKey( self::KNOWN_LABEL, $registry );
	}

	public function test_a_translated_string_reaches_the_tree(): void {
		$GLOBALS['fotogrids_test_translations']['fotogrids'][ self::KNOWN_LABEL ] = 'Aktion beim Hover';

		$tree = Catalog_I18n::translate_tree(
			array(
				'effects' => array(
					'label'    => self::KNOWN_LABEL,
					'settings' => array(
						array(
							'key'   => 'hover_effect',
							'label' => self::KNOWN_LABEL,
						),
					),
				),
			)
		);

		$this->assertSame( 'Aktion beim Hover', $tree['effects']['label'] );
		$this->assertSame( 'Aktion beim Hover', $tree['effects']['settings'][0]['label'] );
	}

	public function test_nested_subtabs_and_options_are_translated(): void {
		$GLOBALS['fotogrids_test_translations']['fotogrids'][ self::KNOWN_LABEL ] = 'Translated';

		$tree = Catalog_I18n::translate_tree(
			array(
				'tab' => array(
					'subTabs' => array(
						'general' => array(
							'label'    => self::KNOWN_LABEL,
							'settings' => array(
								array(
									'key'         => 'example',
									'description' => self::KNOWN_LABEL,
									'options'     => array(
										array(
											'value' => self::KNOWN_LABEL,
											'label' => self::KNOWN_LABEL,
										),
									),
								),
							),
						),
					),
				),
			)
		);

		$sub_tab = $tree['tab']['subTabs']['general'];
		$setting = $sub_tab['settings'][0];

		$this->assertSame( 'Translated', $sub_tab['label'] );
		$this->assertSame( 'Translated', $setting['description'] );
		$this->assertSame( 'Translated', $setting['options'][0]['label'] );
	}

	public function test_machine_values_are_left_alone(): void {
		$GLOBALS['fotogrids_test_translations']['fotogrids'][ self::KNOWN_LABEL ] = 'Translated';

		$tree = Catalog_I18n::translate_tree(
			array(
				'tab' => array(
					'settings' => array(
						array(
							'key'   => self::KNOWN_LABEL,
							'value' => self::KNOWN_LABEL,
							'type'  => self::KNOWN_LABEL,
						),
					),
				),
			)
		);

		$setting = $tree['tab']['settings'][0];

		$this->assertSame( self::KNOWN_LABEL, $setting['key'] );
		$this->assertSame( self::KNOWN_LABEL, $setting['value'] );
		$this->assertSame( self::KNOWN_LABEL, $setting['type'] );
	}

	public function test_an_untranslated_locale_leaves_the_tree_unchanged(): void {
		$tree = array(
			'tab' => array(
				'label'    => self::KNOWN_LABEL,
				'settings' => array( array( 'label' => self::KNOWN_LABEL ) ),
			),
		);

		$this->assertSame( $tree, Catalog_I18n::translate_tree( $tree ) );
	}

	public function test_another_plugin_can_contribute_its_own_strings(): void {
		$GLOBALS['fotogrids_test_filters'][ \FotoGrids\Hooks\Filters_Catalog::STRINGS ] = static function ( array $strings ): array {
			$strings['Carousel Speed'] = 'Karussell-Geschwindigkeit';

			return $strings;
		};

		$tree = Catalog_I18n::translate_tree( array( 'tab' => array( 'label' => 'Carousel Speed' ) ) );

		$this->assertSame( 'Karussell-Geschwindigkeit', $tree['tab']['label'] );
	}
}
