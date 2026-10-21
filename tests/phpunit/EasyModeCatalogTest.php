<?php
/**
 * Easy mode catalog data: `modes` tags and `preset_group` nodes.
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

final class EasyModeCatalogTest extends TestCase {

	private const VALID_MODES = array( 'easy', 'advanced' );

	/**
	 * Keys of nodes shown in Easy on a gallery, by tab.
	 */
	private const EASY_GALLERY_KEYS = array(
		// layout.
		'layout',
		'featured_image_side',
		'featured_thumbs_count',
		'layout_item_aspect_ratio',
		'layout_item_aspect_ratio_w',
		'layout_item_aspect_ratio_h',
		'instant_photo_hover_action',
		'instant_photo_elevation',
		'instant_photo_sticker',
		'columns',
		'layout_items_per_view',
		'single_item_auto_progress',
		'layout_justified_row_height',
		// layout-navigation.
		'layout_loop',
		'layout_show_counter',
		'layout_autoplay',
		'layout_transition',
		'layout_show_arrows',
		'layout_arrows_location',
		'layout_show_bullets',
		'layout_bullets_location',
		'layout_thumbnails_show',
		'layout_thumbnails_location',
		// styling.
		'background_enabled',
		'background_color',
		'border_enabled',
		'border_color',
		'thumbnail_filter_enabled',
		'thumbnail_filter_type',
		'full_image_background_enabled',
		'full_image_background_color',
		'full_image_border_enabled',
		'full_image_border_color',
		'full_image_filter_enabled',
		'full_image_filter_type',
		// interactions.
		'item_click_behavior',
		'lightbox_variant',
		'item_click_zoom_conflict_notice',
		'external_url_manager',
		'interactions_zoom',
		'interactions_zoom_style',
		'interactions_zoom_mode',
		'zoom_item_click_conflict_notice',
		'lightbox_mini_show_close',
		'lightbox_mini_show_arrows',
		'lightbox_mini_show_bullets',
		'lightbox_mini_show_overlay',
		'lightbox_mini_theme',
		// lightbox.
		'lightbox_scope',
		'lightbox_img_shadow_enabled',
		'lightbox_theme',
		'lightbox_fullscreen',
		'lightbox_loop',
		'lightbox_transition',
		'lightbox_auto_progress',
		'lightbox_show_arrows',
		'lightbox_show_dots',
		'lightbox_show_counter',
		'lightbox_thumbnail_strip_location',
		'lightbox_backdrop_close',
		'lightbox_info_panel_enabled',
		'lightbox_info_blocks',
		'lightbox_info_blocks_empty_notice',
		'lightbox_share_block_off_notice',
		'lightbox_zoom',
		// lightbox-mini.
		'lightbox_lite_caption_show',
		// lightbox-grid.
		'lightbox_grid_theme',
		'lightbox_lite_caption_location',
		// captions.
		'caption_hide_title',
		'caption_title_source',
		'caption_hide_description',
		'caption_description_source',
		// pagination.
		'pagination_type',
		'items_per_page',
		'pagination_method',
		'load_more_button_text',
		'pages_show_prev_next',
		'pages_show_numbers',
		// sorting.
		'default_sort_order',
		'date_sort_direction',
		'title_sort_direction',
		'random_sort_caching_notice',
		'advanced_sorting_promo',
		// filtering.
		'filtering_enabled',
		'filtering_multiple_enabled',
		'filter_by',
		'date_filter_type',
		'filter_ui_position',
		'filter_display_mode',
		'filter_sidebar_side',
		'filter_ui_style',
		'filter_reset_btn_enabled',
		'show_filter_count',
		'advanced_filtering_promo',
		// effects.
		'loading_icon',
		'loaded_effect',
		'hover_effect_info',
		'hover_effect',
		'hover_affect_others',
		// media.
		'thumbnail_size',
		'thumbnail_custom_size_width',
		'thumbnail_custom_size_height',
		'full_image_size',
		'full_image_custom_size_width',
		'full_image_custom_size_height',
		'media_regen_info',
		// video.
		'video_playback_mode',
		'video_playback_full_lightbox_notice',
		'video_autoplay_on_open',
		'video_autoplay_on_slide',
		'video_advance_after_end',
		'video_pro_features_promo',
		// performance.
		'lazy_load',
		'enable_cache',
		'cache_status',
		'cdn_promotion',
		// permissions.
		'who_can_edit',
		'edit_allowed_roles',
		'edit_allowed_users',
		'who_can_view',
		'view_allowed_roles',
		// security.
		'disable_right_click',
		'password_protect',
		'password',
		'watermark_global_off_notice',
		'watermark_apply_to_collection',
		'watermark_status',
		// sharing.
		'sharing_global_off_notice',
		// exif.
		'display_exif',
		'exif_fields',
		'exif_per_image_notice',
		// seo.
		'fotogrids_og_image_source',
		'fotogrids_og_image_custom_id',
		'fotogrids_noindex',
		// advanced.
		'auto_clear_cache',
		'enable_statistics',
		// ecommerce.
		'woocommerce_integration',
		'add_to_cart',
		'product_variations',
		'sale_badges',
		'product_categories',
		'seamless_checkout',
	);

	/**
	 * Keys of nodes shown in Easy on an album, by tab.
	 */
	private const EASY_ALBUM_KEYS = array(
		// layout.
		'layout',
		'featured_image_side',
		'featured_thumbs_count',
		'layout_item_aspect_ratio',
		'layout_item_aspect_ratio_w',
		'layout_item_aspect_ratio_h',
		'instant_photo_hover_action',
		'instant_photo_elevation',
		'instant_photo_sticker',
		'columns',
		'layout_items_per_view',
		'single_item_auto_progress',
		'layout_justified_row_height',
		// styling.
		'background_enabled',
		'background_color',
		'border_enabled',
		'border_color',
		'thumbnail_filter_enabled',
		'thumbnail_filter_type',
		// captions.
		'caption_hide_title',
		'caption_hide_description',
		// pagination.
		'pagination_type',
		'items_per_page',
		'pagination_method',
		'load_more_button_text',
		'pages_show_prev_next',
		'pages_show_numbers',
		// sorting.
		'default_sort_order',
		'date_sort_direction',
		'title_sort_direction',
		'advanced_sorting_promo',
		// filtering.
		'filtering_enabled',
		'filtering_multiple_enabled',
		'filter_by',
		'date_filter_type',
		'filter_ui_position',
		'filter_display_mode',
		'filter_sidebar_side',
		'filter_ui_style',
		'filter_reset_btn_enabled',
		'show_filter_count',
		'advanced_filtering_promo',
		// effects.
		'loading_icon',
		'loaded_effect',
		'hover_effect_info',
		'hover_effect',
		'hover_affect_others',
		// performance.
		'enable_cache',
		'cache_status',
		'cdn_promotion',
		// permissions.
		'who_can_edit',
		'edit_allowed_roles',
		'edit_allowed_users',
		'who_can_view',
		'view_allowed_roles',
		// security.
		'disable_right_click',
		'password_protect',
		'password',
		// sharing.
		'sharing_global_off_notice',
		// seo.
		'fotogrids_og_image_source',
		'fotogrids_og_image_custom_id',
		'fotogrids_noindex',
		// navigation.
		'use_ajax_from_album',
		'navigation_show_breadcrumbs',
		'navigation_breadcrumbs_placements',
		'navigation_show_back_button',
		'navigation_info_block',
		// advanced.
		'auto_clear_cache',
		'enable_statistics',
	);

	private const PRESET_IDS = array( 'easy_spacing', 'easy_corners', 'easy_border_width', 'easy_shadow', 'easy_full_image_border_width', 'easy_caption_style', 'easy_sharing' );

	/**
	 * Advanced-only keys an Easy condition may read because their default satisfies it.
	 */
	private const DEFAULT_SATISFIED_GATES = array( 'columns_mode' );

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
	 * Every array node in a branch, depth first.
	 *
	 * @param mixed                            $node  Catalog branch.
	 * @param array<int, array<string, mixed>> $nodes Collected nodes.
	 * @return void
	 */
	private function collect_nodes( $node, array &$nodes ): void {
		if ( ! is_array( $node ) ) {
			return;
		}
		$nodes[] = $node;
		foreach ( $node as $child ) {
			$this->collect_nodes( $child, $nodes );
		}
	}

	/**
	 * Keys tagged for Easy that a collection kind can reach, honouring `postTypes`.
	 *
	 * @param mixed              $node      Catalog branch.
	 * @param string             $post_type Collection kind.
	 * @param array<int, string> $keys      Collected keys.
	 * @return void
	 */
	private function collect_easy_keys( $node, string $post_type, array &$keys ): void {
		if ( ! is_array( $node ) ) {
			return;
		}
		if ( isset( $node['postTypes'] ) && is_array( $node['postTypes'] ) && ! in_array( $post_type, $node['postTypes'], true ) ) {
			return;
		}
		if ( isset( $node['key'], $node['modes'] ) && is_string( $node['key'] ) && in_array( 'easy', (array) $node['modes'], true ) ) {
			$keys[] = $node['key'];
		}
		foreach ( $node as $child ) {
			$this->collect_easy_keys( $child, $post_type, $keys );
		}
	}

	/**
	 * Every preset_group node, keyed by id.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	private function presets(): array {
		$nodes = array();
		$this->collect_nodes( Catalog::raw_files(), $nodes );

		$presets = array();
		foreach ( $nodes as $node ) {
			if ( 'preset_group' === ( $node['type'] ?? null ) ) {
				$presets[ (string) ( $node['id'] ?? '' ) ] = $node;
			}
		}
		return $presets;
	}

	/**
	 * Loose deep equality: numbers equal numeric strings, maps compare per key.
	 *
	 * @param mixed $left  Value.
	 * @param mixed $right Value.
	 * @return bool
	 */
	private function same_value( $left, $right ): bool {
		if ( is_array( $left ) || is_array( $right ) ) {
			if ( ! is_array( $left ) || ! is_array( $right ) || array_keys( $left ) !== array_keys( $right ) ) {
				return false;
			}
			foreach ( $left as $key => $item ) {
				if ( ! $this->same_value( $item, $right[ $key ] ) ) {
					return false;
				}
			}
			return true;
		}
		if ( is_numeric( $left ) && is_numeric( $right ) ) {
			return (float) $left === (float) $right;
		}
		return $left === $right;
	}

	/**
	 * Asserts a preset value has the same shape and scalar types as its default.
	 *
	 * @param mixed  $value    Preset value.
	 * @param mixed  $expected Shipped default.
	 * @param string $label    Failure label.
	 * @return void
	 */
	private function assert_same_shape( $value, $expected, string $label ): void {
		if ( is_array( $expected ) ) {
			$this->assertIsArray( $value, $label );
			$this->assertSame( array_keys( $expected ), array_keys( $value ), $label );
			foreach ( $expected as $key => $item ) {
				$this->assert_same_shape( $value[ $key ], $item, $label . '.' . $key );
			}
			return;
		}
		$this->assertSame( gettype( $expected ), gettype( $value ), $label );
	}

	/**
	 * Every `dependsOn` key in a condition.
	 *
	 * @param mixed              $condition Condition node.
	 * @param array<int, string> $keys      Collected keys.
	 * @return void
	 */
	private function collect_condition_keys( $condition, array &$keys ): void {
		if ( ! is_array( $condition ) ) {
			return;
		}
		if ( isset( $condition['dependsOn'] ) ) {
			foreach ( (array) $condition['dependsOn'] as $key ) {
				$keys[] = (string) $key;
			}
		}
		foreach ( array( 'all', 'any' ) as $group ) {
			foreach ( (array) ( $condition[ $group ] ?? array() ) as $child ) {
				$this->collect_condition_keys( $child, $keys );
			}
		}
	}

	/**
	 * Easy nodes with the condition keys of their own and every ancestor's condition.
	 *
	 * @param mixed                                           $node      Catalog branch.
	 * @param string                                          $post_type Collection kind.
	 * @param array<int, string>                              $gates     Inherited condition keys.
	 * @param array<int, array{0: array<string, mixed>, 1: array<int, string>}> $found Collected pairs.
	 * @return void
	 */
	private function collect_easy_gates( $node, string $post_type, array $gates, array &$found ): void {
		if ( ! is_array( $node ) ) {
			return;
		}
		if ( isset( $node['postTypes'] ) && is_array( $node['postTypes'] ) && ! in_array( $post_type, $node['postTypes'], true ) ) {
			return;
		}
		if ( isset( $node['condition'] ) ) {
			$this->collect_condition_keys( $node['condition'], $gates );
		}
		if ( in_array( 'easy', (array) ( $node['modes'] ?? array() ), true ) ) {
			$found[] = array( $node, $gates );
		}
		foreach ( $node as $name => $child ) {
			if ( in_array( $name, array( 'condition', 'options', 'overrides', 'condition_global' ), true ) ) {
				continue;
			}
			$this->collect_easy_gates( $child, $post_type, $gates, $found );
		}
	}

	public function test_every_modes_value_is_valid(): void {
		$nodes = array();
		$this->collect_nodes( Catalog::raw_files(), $nodes );

		$tagged = 0;
		foreach ( $nodes as $node ) {
			if ( ! array_key_exists( 'modes', $node ) ) {
				continue;
			}
			++$tagged;
			$label = (string) ( $node['key'] ?? $node['id'] ?? $node['type'] ?? '?' );
			$this->assertIsArray( $node['modes'], $label );
			$this->assertNotSame( array(), $node['modes'], $label );
			$this->assertSame( array_values( array_unique( $node['modes'] ) ), $node['modes'], $label );
			$this->assertSame( array(), array_diff( $node['modes'], self::VALID_MODES ), $label );
		}
		$this->assertGreaterThan( 0, $tagged );
	}

	public function test_gallery_easy_keys_match_the_easy_list(): void {
		$keys = array();
		$this->collect_easy_keys( Catalog::raw_files(), 'gallery', $keys );

		$expected = self::EASY_GALLERY_KEYS;
		sort( $expected );
		$actual = array_values( array_unique( $keys ) );
		sort( $actual );

		$this->assertSame( $expected, $actual );
	}

	public function test_album_easy_keys_match_the_easy_list(): void {
		$keys = array();
		$this->collect_easy_keys( Catalog::raw_files(), 'album', $keys );

		$expected = self::EASY_ALBUM_KEYS;
		sort( $expected );
		$actual = array_values( array_unique( $keys ) );
		sort( $actual );

		$this->assertSame( $expected, $actual );
	}

	public function test_easy_nodes_are_gated_only_by_easy_keys(): void {
		foreach ( array( 'gallery', 'album' ) as $post_type ) {
			$found = array();
			$this->collect_easy_gates( Catalog::raw_files(), $post_type, array(), $found );

			$editable = self::DEFAULT_SATISFIED_GATES;
			foreach ( $found as $pair ) {
				$node = $pair[0];
				if ( isset( $node['key'] ) ) {
					$editable[] = (string) $node['key'];
				}
				foreach ( (array) ( $node['options'] ?? array() ) as $option ) {
					if ( 'preset_group' === ( $node['type'] ?? null ) && is_array( $option['values'] ?? null ) ) {
						$editable = array_merge( $editable, array_keys( $option['values'] ) );
					}
				}
			}

			foreach ( $found as $pair ) {
				$label = $post_type . ':' . (string) ( $pair[0]['key'] ?? $pair[0]['id'] ?? '?' );
				$this->assertSame( array(), array_values( array_diff( $pair[1], $editable ) ), $label );
			}
		}
	}

	public function test_all_presets_exist_easy_only_and_keyless(): void {
		$presets = $this->presets();

		$this->assertSame( self::PRESET_IDS, array_keys( $presets ) );

		foreach ( $presets as $id => $preset ) {
			$this->assertArrayNotHasKey( 'key', $preset, $id );
			$this->assertSame( array( 'easy' ), $preset['modes'] ?? null, $id );
			$this->assertNotEmpty( $preset['options'] ?? null, $id );
		}
	}

	public function test_preset_values_write_known_keys_in_the_default_shape(): void {
		$defaults = Collection_Defaults::resolve_gallery();

		foreach ( $this->presets() as $id => $preset ) {
			foreach ( $preset['options'] as $option ) {
				$label = $id . ':' . (string) ( $option['value'] ?? '?' );
				$this->assertIsString( $option['label'] ?? null, $label );
				$this->assertNotEmpty( $option['values'] ?? null, $label );

				foreach ( $option['values'] as $key => $value ) {
					$this->assertArrayHasKey( $key, $defaults, $label );
					$this->assert_same_shape( $value, $defaults[ $key ], $label . ':' . $key );
				}
			}
		}
	}

	public function test_each_preset_has_exactly_one_default_option(): void {
		$defaults = Collection_Defaults::resolve_gallery();

		foreach ( $this->presets() as $id => $preset ) {
			$matches = array();
			foreach ( $preset['options'] as $option ) {
				$is_default = true;
				foreach ( $option['values'] as $key => $value ) {
					if ( ! array_key_exists( $key, $defaults ) || ! $this->same_value( $value, $defaults[ $key ] ) ) {
						$is_default = false;
						break;
					}
				}
				if ( $is_default ) {
					$matches[] = $option['value'];
				}
			}

			$this->assertCount( 1, $matches, $id . ' default options: ' . implode( ', ', $matches ) );
		}
	}

	public function test_presets_are_not_flattened_into_catalog_entries(): void {
		$entries = Catalog::all();

		foreach ( self::PRESET_IDS as $id ) {
			$this->assertArrayNotHasKey( $id, $entries );
		}
		$this->assertArrayNotHasKey( '', $entries );
	}

	public function test_easy_styling_follows_the_advanced_order(): void {
		$nodes = array();
		$this->collect_nodes( Catalog::raw_files(), $nodes );
		$thumbnails = null;
		foreach ( $nodes as $node ) {
			if ( 'thumbnails' === ( $node['id'] ?? null ) && in_array( 'background_group', array_column( $node['settings'] ?? array(), 'key' ), true ) ) {
				$thumbnails = $node;
				break;
			}
		}
		$this->assertIsArray( $thumbnails );

		$ids = array_map(
			static function ( $node ) {
				return (string) ( $node['key'] ?? $node['id'] ?? '' );
			},
			$thumbnails['settings']
		);
		$this->assertSame(
			array( 'background_group', 'easy_corners', 'border_radius_group', 'border_group', 'easy_shadow', 'shadow_group', 'thumbnail_image_filter_group' ),
			$ids
		);
	}

	public function test_border_width_presets_are_plain_buttons_writing_one_width(): void {
		$presets = $this->presets();

		foreach ( array( 'easy_border_width' => 'border_width', 'easy_full_image_border_width' => 'full_image_border_width' ) as $id => $key ) {
			$this->assertFalse( $presets[ $id ]['bigIcons'] ?? null, $id );
			$this->assertSame( array( 'thin', 'medium', 'thick' ), array_column( $presets[ $id ]['options'], 'value' ), $id );
			foreach ( $presets[ $id ]['options'] as $option ) {
				$this->assertSame( array( $key ), array_keys( $option['values'] ), $id );
				$this->assertArrayNotHasKey( 'icon', $option, $id );
			}
		}
	}

	public function test_lightbox_style_uses_big_icon_buttons(): void {
		$nodes = array();
		$this->collect_nodes( Catalog::raw_files(), $nodes );
		$variant = null;
		foreach ( $nodes as $node ) {
			if ( 'lightbox_variant' === ( $node['key'] ?? null ) ) {
				$variant = $node;
				break;
			}
		}
		$this->assertIsArray( $variant );
		$this->assertTrue( $variant['bigIcons'] ?? null );
		$this->assertSame(
			array( 'full' => 'lightbox_full', 'mini' => 'lightbox_mini', 'grid' => 'lightbox_grid' ),
			array_column( $variant['options'], 'icon', 'value' )
		);
	}

	public function test_caption_style_options_read_below_overlay_on_hover(): void {
		$options = $this->presets()['easy_caption_style']['options'];

		$this->assertSame(
			array( 'below' => 'Below', 'overlay' => 'Overlay', 'hover' => 'On hover' ),
			array_column( $options, 'label', 'value' )
		);
	}
}
