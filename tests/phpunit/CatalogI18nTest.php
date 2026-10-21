<?php
/**
 * Tests for Catalog_I18n.
 *
 * @package FotoGrids
 */

declare(strict_types=1);

use FotoGrids\Catalog\Catalog;
use FotoGrids\Catalog\Catalog_Assembler;
use FotoGrids\Catalog\Catalog_I18n;
use PHPUnit\Framework\TestCase;

require_once FOTOGRIDS_PLUGIN_DIR . 'includes/hooks/filters/class-filters-catalog.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/catalog/class-catalog-i18n.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/catalog/class-catalog-partial-expander.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/catalog/class-catalog-assembler.php';
require_once FOTOGRIDS_PLUGIN_DIR . 'includes/catalog/class-catalog.php';

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

	public function test_html_rendered_keys_are_filtered_to_the_allowlist(): void {
		$GLOBALS['fotogrids_test_translations']['fotogrids']['Caption Placement'] =
			'Caption <strong>Placement</strong><script>alert(1)</script>';

		$tree = Catalog_I18n::translate_tree(
			array(
				'tab' => array(
					'settings' => array(
						array(
							'key'         => 'caption_placement',
							'description' => 'Caption Placement',
							'label'       => 'Caption Placement',
						),
					),
				),
			)
		);

		$setting = $tree['tab']['settings'][0];

		$this->assertSame( 'Caption <strong>Placement</strong>alert(1)', $setting['description'] );
		$this->assertSame(
			'Caption <strong>Placement</strong><script>alert(1)</script>',
			$setting['label'],
			'A label is rendered as escaped text, so it is not filtered.'
		);
	}

	public function test_an_anchor_is_allowed_no_attributes(): void {
		$allowed_html = ( new \ReflectionClass( Catalog_I18n::class ) )->getConstant( 'ALLOWED_HTML' );

		$this->assertArrayHasKey( 'a', $allowed_html );
		$this->assertSame(
			array(),
			$allowed_html['a'],
			'Catalog copy marks a link with a bare <a>; the admin UI supplies the destination. '
			. 'Granting href here would let a translation choose where a settings link points.'
		);
	}

	public function test_escaped_markup_inside_code_survives_the_filter(): void {
		$description = 'Emits <code>&lt;meta name="robots" content="noindex, nofollow"&gt;</code> on the page.';

		$tree = Catalog_I18n::translate_tree(
			array( 'tab' => array( 'settings' => array( array( 'description' => $description ) ) ) )
		);

		$this->assertSame( $description, $tree['tab']['settings'][0]['description'] );
	}

	public function test_every_shipped_html_string_survives_the_filter(): void {
		Catalog::init();
		$assembly  = ( new Catalog_Assembler() )->assemble( Catalog::raw_files() );
		$html_keys = ( new \ReflectionClass( Catalog_I18n::class ) )->getConstant( 'HTML_KEYS' );

		$shipped = array();
		$this->collect_strings( $assembly['tree'], $html_keys, $shipped );

		$filtered = array();
		$this->collect_strings( Catalog_I18n::translate_tree( $assembly['tree'] ), $html_keys, $filtered );

		$this->assertNotEmpty( $shipped );
		$this->assertSame(
			array(),
			array_values( array_diff( $shipped, $filtered ) ),
			'These catalog strings lose content to the HTML filter. Markup meant to be shown needs escaped entities.'
		);
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

	public function test_a_non_string_replacement_from_a_filter_is_discarded(): void {
		$GLOBALS['fotogrids_test_filters'][ \FotoGrids\Hooks\Filters_Catalog::STRINGS ] = static function ( array $strings ): array {
			$strings['Layout Type'] = array( 'not', 'a', 'string' );

			return $strings;
		};

		$tree = Catalog_I18n::translate_tree( array( 'tab' => array( 'label' => 'Layout Type' ) ) );

		$this->assertSame( 'Layout Type', $tree['tab']['label'] );
	}

	public function test_another_plugin_can_contribute_its_own_strings(): void {
		$GLOBALS['fotogrids_test_filters'][ \FotoGrids\Hooks\Filters_Catalog::STRINGS ] = static function ( array $strings ): array {
			$strings['Carousel Speed'] = 'Karussell-Geschwindigkeit';

			return $strings;
		};

		$tree = Catalog_I18n::translate_tree( array( 'tab' => array( 'label' => 'Carousel Speed' ) ) );

		$this->assertSame( 'Karussell-Geschwindigkeit', $tree['tab']['label'] );
	}

	/**
	 * Collects the values of the given keys from a catalog subtree.
	 *
	 * @param array<string, mixed> $node Subtree to walk.
	 * @param array<int, string>   $keys Keys to collect.
	 * @param array<int, string>   $out  Accumulator.
	 * @return void
	 */
	private function collect_strings( array $node, array $keys, array &$out ): void {
		foreach ( $node as $key => $value ) {
			if ( is_array( $value ) ) {
				$this->collect_strings( $value, $keys, $out );
			} elseif ( is_string( $value ) && in_array( $key, $keys, true ) ) {
				$out[] = $value;
			}
		}
	}
}
