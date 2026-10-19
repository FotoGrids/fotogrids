<?php
declare(strict_types=1);

namespace FotoGrids\Render\Internal;

use FotoGrids\Image_Size_Manager;
use FotoGrids\Render\Api\Collection_Kind;
use FotoGrids\Render\Api\Columns_Mode;
use FotoGrids\Render\Api\Item_View;
use FotoGrids\Render\Api\Render_Behavior;
use FotoGrids\Render\Internal\Caption_Content_Builder;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Render_Layout;
use FotoGrids\Render\Api\Render_Meta;
use FotoGrids\Render\Api\Render_Mode;
use FotoGrids\Render\Api\Request_Source;
use FotoGrids\Render\Api\Sorter;
use FotoGrids\Render\Features\Pagination\Page_Size_Resolver;
use FotoGrids\Render\Layouts\Justified\Page_Cutter;
use FotoGrids\Render\Layouts\Justified\Snap_Resolver;
use FotoGrids\Render\Video\Video_Item_Helpers;
use FotoGrids\Render\Video\Video_Poster_Resolver;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Builds render contexts for public and preview renders.
 *
 * @package FotoGrids\Render\Internal
 * @since   1.0.0
 */
final class Context_Builder {

	/**
	 * Widest container page 1's overflow is sized for, in pixels.
	 */
	private const POOL_WIDTH = 2560.0;

	private Instance_Id_Factory $instance_id_factory;
	/**
	 * @var callable|null
	 */
	private $items_loader;

	/**
	 * @param callable|null $items_loader Callback for item hydration.
	 */
	public function __construct(
		Instance_Id_Factory $instance_id_factory,
		$items_loader = null
	) {
		$this->instance_id_factory = $instance_id_factory;
		$this->items_loader        = $items_loader;
	}

	/**
	 * Returns the visit-context album from the `fg_via` query var.
	 *
	 * @since  1.2.0
	 * @return int|null Positive album ID, or null when absent or invalid.
	 */
	public static function via_album_from_request(): ?int {
		if ( ! isset( $_GET['fg_via'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only breadcrumb hint on a front-end page view.
			return null;
		}

		$candidate = (int) wp_unslash( $_GET['fg_via'] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Read-only breadcrumb hint; the (int) cast sanitizes it.

		return $candidate > 0 ? $candidate : null;
	}

	/**
	 * Creates a context for public rendering.
	 *
	 * @since   1.0.0
	 * @param   int                  $gallery_id Gallery identifier.
	 * @param   array<string, mixed> $render_settings Normalized settings.
	 * @param   array<int, mixed>    $collection_item_ids Item IDs.
	 * @param   value-of<Request_Source::ALL> $source Request source.
	 * @param   int|null             $album_id Album identifier.
	 * @param   array<string, mixed> $meta_overrides Optional Render_Meta field overrides.
	 * @return  Render_Context
	 */
	public function build_for_public(
		int $gallery_id,
		array $render_settings = array(),
		array $collection_item_ids = array(),
		string $source = Request_Source::SHORTCODE,
		?int $album_id = null,
		array $meta_overrides = array()
	): Render_Context {
		$render_settings = self::coerce_layout_settings( $render_settings );
		// Paginated REST requests pass the initial render's seed. Capped at 2^31-1
		// to survive a JSON round-trip through JavaScript numbers.
		$random_seed = isset( $meta_overrides['random_seed'] ) && null !== $meta_overrides['random_seed']
			? (int) $meta_overrides['random_seed']
			: random_int( 1, 2147483647 );

		// Set by the REST handler, not inferred from Request_Source: non-AJAX
		// renders can also carry ALBUM_AJAX.
		$is_ajax_swap = ! empty( $meta_overrides['is_ajax_swap'] );

		$view_page = ! empty( $meta_overrides['view_page'] );

		$render_meta = new Render_Meta(
			$gallery_id,
			$album_id,
			isset( $meta_overrides['instance_id'] ) && '' !== $meta_overrides['instance_id']
				? (string) $meta_overrides['instance_id']
				: $this->instance_id_factory->generate( $gallery_id ),
			$source,
			false,
			Render_Mode::INITIAL,
			2,
			Collection_Kind::GALLERY,
			isset( $meta_overrides['requested_page'] ) ? (int) $meta_overrides['requested_page'] : null,
			isset( $meta_overrides['requested_per_page'] ) ? (int) $meta_overrides['requested_per_page'] : null,
			isset( $meta_overrides['breakpoint'] ) ? (string) $meta_overrides['breakpoint'] : null,
			isset( $meta_overrides['partial'] ) ? (string) $meta_overrides['partial'] : null,
			null,
			isset( $meta_overrides['active_filters'] ) && is_array( $meta_overrides['active_filters'] )
									? $meta_overrides['active_filters']
									: array(),
			$random_seed,
			$view_page,
			$is_ajax_swap,
			isset( $meta_overrides['container_width'] ) && (int) $meta_overrides['container_width'] > 0
									? (int) $meta_overrides['container_width']
									: null,
			null,
			null,
			isset( $meta_overrides['requested_offset'] ) ? max( 0, (int) $meta_overrides['requested_offset'] ) : null,
			isset( $meta_overrides['requested_length'] ) && (int) $meta_overrides['requested_length'] > 0
									? (int) $meta_overrides['requested_length']
									: null,
			! empty( $meta_overrides['with_aspects'] ),
		);

		// An explicit override wins over `fg_via`. Breadcrumb_Resolver validates
		// that the album contains this gallery.
		$via_album_id = null;
		if ( array_key_exists( 'via_album_id', $meta_overrides ) ) {
			$candidate    = (int) $meta_overrides['via_album_id'];
			$via_album_id = $candidate > 0 ? $candidate : null;
		} else {
			$via_album_id = self::via_album_from_request();
		}

		[ $thumb_size, $full_size ] = Image_Size_Manager::resolve_setting_slugs( $render_settings );

		// Item-less shell for the sorters' supports() and sort().
		$sort_context = new Render_Context(
			$render_meta,
			$this->build_layout( $render_settings ),
			$this->build_behavior( $render_settings ),
			$render_settings,
			array(),
			array(),
			$via_album_id,
		);

		$raw_ids    = array_map( 'absint', $collection_item_ids );
		$sorted_ids = $this->apply_sorter( $raw_ids, $sort_context );

		// Single Item keeps one sorted item unless Animate Images is on.
		$is_single_item         = ( $render_settings['layout'] ?? '' ) === 'single-item';
		$single_item_animates   = $is_single_item && ! empty( $render_settings['single_item_auto_progress'] );
		$single_item_full_count = $is_single_item ? count( $sorted_ids ) : null;
		if ( $is_single_item && ! $single_item_animates ) {
			$sorted_ids = array_slice( $sorted_ids, 0, 1 );
		}

		$thumb_size = $this->apply_layout_thumb_size( $thumb_size, $render_settings, $sort_context );

		$loaded_items = $this->load_items( $sorted_ids, $thumb_size, $full_size );
		$loaded_items = $this->resolve_captions( $loaded_items, $render_settings );

		// Filtering must run before pagination so pages count the filtered set.
		if ( ! empty( $render_meta->active_filters ) && Collection_Kind::GALLERY === $render_meta->collection_kind ) {
			$filter_context = new Render_Context(
				$render_meta,
				$sort_context->layout,
				$sort_context->behavior,
				$render_settings,
				$loaded_items,
				array(),
				$via_album_id,
			);

			$loaded_items = $this->apply_server_filters( $loaded_items, $render_meta->active_filters, $filter_context );
		}

		// Single Item uses its count from before the one-item slice.
		$total_item_count = $single_item_full_count ?? count( $loaded_items );
		$render_meta      = $render_meta->with( array( 'total_item_count' => $total_item_count ) );

		if ( $render_meta->with_aspects || self::is_slice_planned( $render_settings, $render_meta ) ) {
			$render_meta = $render_meta->with( array( 'sequence_aspects' => self::aspects_of( $loaded_items ) ) );
		}

		[ $loaded_items, $render_meta ] = $this->apply_pagination_slice(
			$loaded_items,
			$render_settings,
			$render_meta,
			$sort_context,
			$total_item_count
		);

		return new Render_Context(
			$render_meta,
			$sort_context->layout,
			$sort_context->behavior,
			$render_settings,
			$loaded_items,
			array(),
			$via_album_id,
		);
	}

	/**
	 * Slices items to the requested page and records page size and total pages on the meta.
	 *
	 * Returns both unchanged when pagination is off or the layout lacks the
	 * `paginates` capability.
	 *
	 * @since 1.0.0
	 * @param array<int, mixed>    $loaded_items     Fully-prepared Item_Views.
	 * @param array<string, mixed> $render_settings  Resolved settings.
	 * @param Render_Meta          $render_meta      Current render meta.
	 * @param Render_Context       $context          Context used for capability + page-size resolution.
	 * @param int                  $total_item_count Item count before slicing.
	 * @return array{0: array<int, mixed>, 1: Render_Meta}
	 */
	private function apply_pagination_slice(
		array $loaded_items,
		array $render_settings,
		Render_Meta $render_meta,
		Render_Context $context,
		int $total_item_count
	): array {
		$paginates_capability = Layout_Capabilities::supports( $context, 'paginates' );
		if ( ( $render_settings['pagination_type'] ?? 'show_all' ) !== 'paginated'
			|| Collection_Kind::GALLERY !== $render_meta->collection_kind
			|| ! $paginates_capability
		) {
			return array( $loaded_items, $render_meta );
		}

		$per_page_override = $render_meta->requested_per_page;
		$page_size         = null !== $per_page_override && $per_page_override > 0
			? $per_page_override
			: Page_Size_Resolver::resolve_page_size( $render_settings, $context );
		$page              = max( 1, (int) ( $render_meta->requested_page ?? 1 ) );

		if ( null !== $render_meta->requested_length && $render_meta->requested_length > 0 ) {
			$offset       = min( $total_item_count, (int) $render_meta->requested_offset );
			$loaded_items = array_slice( $loaded_items, $offset, $render_meta->requested_length );
			$render_meta  = $render_meta->with(
				array(
					'requested_offset'     => $offset,
					'pagination_page_size' => count( $loaded_items ),
				)
			);
		} elseif ( self::is_slice_planned( $render_settings, $render_meta ) && self::planned_should_paginate( $total_item_count, $page_size, $render_settings ) ) {
			$aspects    = ! empty( $render_meta->sequence_aspects ) ? $render_meta->sequence_aspects : self::aspects_of( $loaded_items );
			$pages      = self::cut_pages( $aspects, $page_size, $render_settings, $render_meta );
			$page_index = min( $page, count( $pages ) ) - 1;
			$current    = $pages[ $page_index ];
			$length     = $current['size'];
			$overflow   = null;
			if ( 0 === $page_index ) {
				$length   = max( $length, self::page_one_pool( $aspects, $page_size, $render_settings ) );
				$overflow = $current['size'];
			}
			$loaded_items = array_slice( $loaded_items, $current['offset'], $length );
			if ( null !== $overflow ) {
				$loaded_items = self::mark_overflow( $loaded_items, $overflow );
			}
			$render_meta = $render_meta->with(
				array(
					'pagination_page_size'   => $current['size'],
					'pagination_total_pages' => count( $pages ),
					'overflow_from'          => null !== $overflow && $overflow < count( $loaded_items ) ? $overflow : null,
				)
			);
		} elseif ( Page_Size_Resolver::should_paginate( $total_item_count, $page_size ) ) {
			$offset       = ( $page - 1 ) * $page_size;
			$loaded_items = array_slice( $loaded_items, $offset, $page_size );
			$render_meta  = $render_meta->with(
				array(
					'pagination_page_size'   => $page_size,
					'pagination_total_pages' => (int) ceil( $total_item_count / $page_size ),
				)
			);
		} else {
			$render_meta = $render_meta->with(
				array(
					'pagination_page_size'   => $page_size,
					'pagination_total_pages' => 1,
				)
			);
		}

		return array( $loaded_items, $render_meta );
	}

	/**
	 * Creates a context for preview rendering.
	 *
	 * @since   1.0.0
	 * @param   int                  $gallery_id Gallery identifier.
	 * @param   array<string, mixed> $base_settings Base settings.
	 * @param   array<string, mixed> $settings_overlay Overlay settings.
	 * @param   array<int, mixed>    $collection_item_ids Ordered item IDs.
	 * @param   array<int|string, array<string, mixed>> $item_overrides Per-item overrides keyed by attachment ID.
	 * @param   string|null          $simulate_state Simulated gate state.
	 * @return  Render_Context
	 */
	public function build_for_preview(
		int $gallery_id,
		array $base_settings = array(),
		array $settings_overlay = array(),
		array $collection_item_ids = array(),
		array $item_overrides = array(),
		string $source = Request_Source::PREVIEW_UNSAVED,
		?string $simulate_state = null
	): Render_Context {
		$render_settings            = array_replace_recursive( $base_settings, $settings_overlay );
		$render_settings            = self::coerce_layout_settings( $render_settings );
		$warnings                   = array();
		[ $thumb_size, $full_size ] = Image_Size_Manager::resolve_setting_slugs( $render_settings );
		$thumb_size                 = $this->apply_layout_thumb_size( $thumb_size, $render_settings );
		$collection_items           = $this->load_items( $collection_item_ids, $thumb_size, $full_size );
		if ( ! empty( $item_overrides ) ) {
			$collection_items = $this->apply_item_overrides( $collection_items, $item_overrides );
		}
		$collection_items = $this->resolve_captions( $collection_items, $render_settings );

		if ( null !== $simulate_state && ! in_array( $simulate_state, array( 'ok', 'password_required', 'expired', 'unauthorized' ), true ) ) {
			$warnings[] = sprintf( 'Unsupported simulate_state: %s', $simulate_state );
		}

		$render_meta = new Render_Meta(
			$gallery_id,
			null,
			$this->instance_id_factory->generate( $gallery_id ),
			$source,
			true,
			Render_Mode::AJAX,
			2
		);

		$total_item_count = count( $collection_items );
		$render_meta      = $render_meta->with( array( 'total_item_count' => $total_item_count ) );

		$preview_context = new Render_Context(
			$render_meta,
			$this->build_layout( $render_settings ),
			$this->build_behavior( $render_settings ),
			$render_settings,
			$collection_items,
			$warnings
		);

		[ $collection_items, $render_meta ] = $this->apply_pagination_slice(
			$collection_items,
			$render_settings,
			$render_meta,
			$preview_context,
			$total_item_count
		);

		return new Render_Context(
			$render_meta,
			$preview_context->layout,
			$preview_context->behavior,
			$render_settings,
			$collection_items,
			$warnings
		);
	}

	/**
	 * Creates a context for rendering an album as a collection.
	 *
	 * Items are child-gallery summaries from Album_Item_Loader, kept in
	 * album-stored order; no sorter runs.
	 *
	 * @since   1.0.0
	 * @param   int                  $album_id            Album post identifier.
	 * @param   array<string, mixed> $render_settings     Resolved album settings.
	 * @param   array<int, mixed>    $child_gallery_ids   Child gallery post IDs in album-stored order.
	 * @param   value-of<Request_Source::ALL> $source     Request source.
	 * @param   string               $instance_id         Instance ID to render with. Empty takes the next one.
	 * @return  Render_Context
	 */
	public function build_for_album(
		int $album_id,
		array $render_settings = array(),
		array $child_gallery_ids = array(),
		string $source = Request_Source::SHORTCODE,
		string $instance_id = ''
	): Render_Context {
		$render_settings = self::coerce_layout_settings( $render_settings );

		$render_meta = new Render_Meta(
			// gallery_id is 0; the album ID seeds the instance ID.
			0,
			$album_id,
			'' !== $instance_id ? $instance_id : $this->instance_id_factory->generate( $album_id ),
			$source,
			false,
			Render_Mode::INITIAL,
			2,
			Collection_Kind::ALBUM,
		);

		[ $thumb_size ] = Image_Size_Manager::resolve_setting_slugs( $render_settings );
		$thumb_size     = $this->apply_layout_thumb_size( $thumb_size, $render_settings );

		$loaded_items = Album_Item_Loader::load( $child_gallery_ids, $thumb_size );
		$loaded_items = $this->resolve_captions( $loaded_items, $render_settings );

		return new Render_Context(
			$render_meta,
			$this->build_layout( $render_settings ),
			$this->build_behavior( $render_settings ),
			$render_settings,
			$loaded_items,
			array()
		);
	}

	/**
	 * Returns a request-scoped builder instance for public renders.
	 *
	 * @since   1.0.0
	 * @return  self
	 */
	public static function for_public(): self {
		static $instance = null;

		if ( null === $instance ) {
			$instance = new self( Instance_Id_Factory::instance() );
		}

		return $instance;
	}

	/**
	 * Returns a request-scoped builder instance for preview renders.
	 *
	 * @since   1.0.0
	 * @return  self
	 */
	public static function for_preview(): self {
		return self::for_public();
	}

	/**
	 * Applies server-side filters to the loaded items.
	 *
	 * An item must match every active source that has values in $active_filters.
	 *
	 * @since 1.0.0
	 * @param array<int, Item_View>           $items
	 * @param array<string, array<int,string>> $active_filters
	 * @param Render_Context                  $filter_context
	 * @return array<int, Item_View>
	 */
	private function apply_server_filters( array $items, array $active_filters, Render_Context $filter_context ): array {
		if ( empty( $items ) || empty( $active_filters ) ) {
			return $items;
		}

		$sources = Module_Registry::active_modules( 'filter_sources', $filter_context );
		if ( empty( $sources ) ) {
			return $items;
		}

		$source_predicates = array();
		foreach ( $sources as $source ) {
			$arg_key = $source->filter_arg_key();
			$values  = $active_filters[ $arg_key ] ?? null;
			if ( ! is_array( $values ) || empty( $values ) ) {
				continue;
			}
			$source_predicates[] = array(
				'source' => $source,
				'values' => array_values( array_map( 'strval', $values ) ),
			);
		}

		if ( empty( $source_predicates ) ) {
			return $items;
		}

		$filtered = array();
		foreach ( $items as $item ) {
			$passes = true;
			foreach ( $source_predicates as $entry ) {
				/** @var \FotoGrids\Render\Api\Filter_Source $source */
				$source = $entry['source'];
				if ( ! $source->matches( (int) $item->id, $entry['values'], $filter_context ) ) {
					$passes = false;
					break;
				}
			}
			if ( $passes ) {
				$filtered[] = $item;
			}
		}

		return $filtered;
	}

	/**
	 * Finds the highest-precedence active sorter and sorts the item IDs.
	 *
	 * Module_Registry returns sorters in precedence order, so the first wins.
	 * Returns the input order when no sorter is active.
	 *
	 * @since   1.0.0
	 * @param   array<int, int>  $item_ids     Attachment IDs in manual order.
	 * @param   Render_Context   $sort_context Context shell (no items yet).
	 * @return  array<int, int>                Sorted attachment IDs.
	 */
	private function apply_sorter( array $item_ids, Render_Context $sort_context ): array {
		$active = Module_Registry::active_modules( 'sorters', $sort_context );

		/** @var Sorter|null $sorter */
		$sorter = $active[0] ?? null;

		if ( null === $sorter ) {
			return $item_ids;
		}

		$sorted = $sorter->sort( $item_ids, $sort_context );

		return is_array( $sorted ) ? array_values( $sorted ) : $item_ids;
	}

	/**
	 * Builds normalized layout data from settings.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $render_settings Render settings.
	 * @return  Render_Layout
	 */
	private function build_layout( array $render_settings ): Render_Layout {
		$layout_id          = is_string( $render_settings['layout'] ?? null ) ? $render_settings['layout'] : 'grid';
		$columns_mode_value = is_string( $render_settings['columns_mode'] ?? null ) ? $render_settings['columns_mode'] : 'fixed';
		$columns_mode       = Columns_Mode::AUTO === $columns_mode_value ? Columns_Mode::AUTO : Columns_Mode::FIXED;

		return new Render_Layout(
			$layout_id,
			$columns_mode,
			is_array( $render_settings['columns'] ?? null ) ? $render_settings['columns'] : array(
				'desktop' => 4,
				'tablet'  => 3,
				'mobile'  => 1,
			),
			is_array( $render_settings['item_spacing'] ?? null ) ? $render_settings['item_spacing'] : array(
				'desktop' => array(
					'value' => 10,
					'unit'  => 'px',
				),
				'tablet'  => array(
					'value' => 8,
					'unit'  => 'px',
				),
				'mobile'  => array(
					'value' => 5,
					'unit'  => 'px',
				),
			),
			is_array( $render_settings['columns_auto_range'] ?? null ) ? $render_settings['columns_auto_range'] : array(),
			$this->resolve_item_aspect_ratio( $render_settings ),
			$this->resolve_item_object_fit( $render_settings ),
		);
	}

	/**
	 * Normalizes the object-fit setting into a CSS-ready string.
	 *
	 * Returns "cover", "contain", or '' to leave the stylesheet fallback.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $render_settings Render settings.
	 * @return  string
	 */
	private function resolve_item_object_fit( array $render_settings ): string {
		$raw = $render_settings['layout_item_object_fit'] ?? null;
		if ( 'cover' === $raw || 'contain' === $raw ) {
			return $raw;
		}
		return '';
	}

	/**
	 * Normalizes the aspect-ratio setting into a CSS-ready string.
	 *
	 * Returns "W / H" (e.g. "4 / 3"), or '' to leave the stylesheet fallback.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $render_settings Render settings.
	 * @return  string
	 */
	private function resolve_item_aspect_ratio( array $render_settings ): string {
		$raw = $render_settings['layout_item_aspect_ratio'] ?? null;

		if ( ! is_string( $raw ) || '' === $raw ) {
			return '';
		}

		// 'none' keeps the image's natural aspect ratio.
		if ( 'none' === $raw ) {
			return '';
		}

		if ( 'custom' === $raw ) {
			$w = absint( $render_settings['layout_item_aspect_ratio_w'] ?? 0 );
			$h = absint( $render_settings['layout_item_aspect_ratio_h'] ?? 0 );
			if ( $w < 1 || $h < 1 ) {
				return '';
			}
			return $w . ' / ' . $h;
		}

		if ( preg_match( '#^\s*(\d+)\s*/\s*(\d+)\s*$#', $raw, $m ) === 1 ) {
			return ( (int) $m[1] ) . ' / ' . ( (int) $m[2] );
		}

		return '';
	}

	/**
	 * Builds normalized behavior data from settings.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $render_settings Render settings.
	 * @return  Render_Behavior
	 */
	private function build_behavior( array $render_settings ): Render_Behavior {
		$click_behavior = is_string( $render_settings['item_click_behavior'] ?? null )
			? $render_settings['item_click_behavior']
			: 'lightbox';

		return new Render_Behavior(
			$click_behavior,
			is_string( $render_settings['pagination_type'] ?? null ) ? $render_settings['pagination_type'] : 'show_all',
			is_string( $render_settings['pagination_method'] ?? null ) ? $render_settings['pagination_method'] : 'load_more',
			is_string( $render_settings['hover_effect'] ?? null ) ? $render_settings['hover_effect'] : null,
			self::resolve_lightbox_variant( $render_settings, $click_behavior )
		);
	}

	/**
	 * Resolves the effective lightbox variant for a render.
	 *
	 * Featured Item always uses 'grid'. The saved `lightbox_variant` applies only
	 * to lightbox clicks on layouts offering the selector; otherwise 'full'.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $render_settings Render settings.
	 * @param   string               $click_behavior  Resolved click behaviour.
	 * @return  string 'full' | 'mini' | 'grid'.
	 */
	private static function resolve_lightbox_variant( array $render_settings, string $click_behavior ): string {
		$layout = is_string( $render_settings['layout'] ?? null ) ? $render_settings['layout'] : '';

		if ( 'featured-item' === $layout ) {
			return 'grid';
		}

		$selector_layouts = array( 'grid', 'masonry', 'justified', 'image-viewer', 'single-item', 'slider', 'instant-photos' );
		if ( 'lightbox' !== $click_behavior || ! in_array( $layout, $selector_layouts, true ) ) {
			return 'full';
		}

		$variant = is_string( $render_settings['lightbox_variant'] ?? null ) ? $render_settings['lightbox_variant'] : 'full';
		if ( ! in_array( $variant, array( 'full', 'mini', 'grid' ), true ) ) {
			return 'full';
		}

		// Instant Photos has no grid overlay.
		if ( 'grid' === $variant ) {
			$grid_layouts = array( 'grid', 'masonry', 'justified', 'image-viewer', 'single-item', 'slider' );
			if ( ! in_array( $layout, $grid_layouts, true ) ) {
				return 'full';
			}
		}

		return $variant;
	}

	/**
	 * Builds an Item_View for a Media Library video attachment.
	 *
	 * The poster URL fills thumb_url and full_url; the file URL goes in video_src.
	 *
	 * @since   1.1.0
	 * @param   int                    $attachment_id   The video attachment ID.
	 * @param   \WP_Post               $attachment_post The attachment post.
	 * @param   array<string, mixed>   $link_meta       external_url/link_target meta.
	 * @param   string                 $thumb_size      Resolved WP size slug for the poster.
	 * @return  \FotoGrids\Render\Api\Item_View
	 */
	private function build_file_video_item_view(
		int $attachment_id,
		\WP_Post $attachment_post,
		array $link_meta,
		string $thumb_size
	): Item_View {
		$custom_data = $this->load_item_custom_data( $attachment_id );
		$poster_url  = Video_Poster_Resolver::resolve(
			Video_Item_Helpers::TYPE_FILE,
			$attachment_id,
			$custom_data,
			$thumb_size
		);

		return new Item_View(
			$attachment_id,
			$poster_url,
			$poster_url,
			(string) get_post_meta( $attachment_id, '_wp_attachment_image_alt', true ),
			(string) $attachment_post->post_title,
			(string) $attachment_post->post_excerpt,
			(string) $attachment_post->post_content,
			'',
			'',
			null,
			null,
			$link_meta,
			array(),
			array(),
			array(),
			array(),
			array(),
			array(),
			array(),
			$thumb_size,
			null,
			null,
			Video_Item_Helpers::TYPE_FILE,
			$poster_url,
			(string) ( wp_get_attachment_url( $attachment_id ) ?: '' ),
			'',
			'',
			Video_Item_Helpers::playback_settings( $custom_data ),
		);
	}

	/**
	 * Builds an Item_View for a single embed post.
	 *
	 * @since   1.1.0
	 * @param   int    $embed_id   The fotogrids_embed post ID.
	 * @param   string $thumb_size Resolved WP size slug for custom posters.
	 * @return  \FotoGrids\Render\Api\Item_View|null
	 */
	private function build_embed_item_view( int $embed_id, string $thumb_size ): ?Item_View {
		$embed = \FotoGrids\Galleries\Embed_Store::get( $embed_id );
		if ( null === $embed ) {
			return null;
		}

		$item_type = (string) $embed['item_type'];
		$caption   = (string) $embed['caption'];

		$custom_data = array(
			'thumbnail_url' => (string) $embed['thumbnail_url'],
			'poster_id'     => (int) $embed['poster_id'],
			'poster_url'    => (string) $embed['poster_url'],
		);
		$poster      = Video_Poster_Resolver::resolve( $item_type, 0, $custom_data, $thumb_size );

		$settings = is_array( $embed['settings'] ?? null ) ? $embed['settings'] : array();

		return new Item_View(
			$embed_id,
			$poster,
			$poster,
			$caption,
			$caption,
			$caption,
			'',
			'',
			'',
			null,
			null,
			array(),
			array(),
			array(),
			array(),
			array(),
			array(),
			array(),
			array(),
			$thumb_size,
			null,
			null,
			$item_type,
			$poster,
			'',
			Video_Item_Helpers::provider_for_type( $item_type ),
			(string) $embed['video_id'],
			$settings,
		);
	}

	/**
	 * Reads and decodes the custom_data JSON for an item.
	 *
	 * @since   1.1.0
	 * @param   int $attachment_id Attachment ID.
	 * @return  array<string, mixed> Decoded custom_data, or empty array.
	 */
	private function load_item_custom_data( int $attachment_id ): array {
		$row = \FotoGrids\Galleries\Item_Meta::get( $attachment_id );
		if ( null === $row || empty( $row['custom_data'] ) ) {
			return array();
		}

		$decoded = json_decode( (string) $row['custom_data'], true );
		return is_array( $decoded ) ? $decoded : array();
	}

	/**
	 * Loads item view data through the configured loader callback.
	 *
	 * Without a custom loader, external_url and link_target are batch-loaded
	 * into Item_View::meta.
	 *
	 * @since   1.0.0
	 * @param   array<int, mixed> $collection_item_ids Item identifiers.
	 * @param   string            $thumb_size          Resolved WP size slug for thumbnails.
	 * @param   string            $full_size           Resolved WP size slug for full/lightbox images.
	 * @return  array<int, \FotoGrids\Render\Api\Item_View>
	 */
	private function load_items( array $collection_item_ids, string $thumb_size = 'large', string $full_size = 'full' ): array {
		if ( ! is_callable( $this->items_loader ) ) {
			$loaded_items = array();

			$valid_ids = array();
			foreach ( $collection_item_ids as $raw_id ) {
				$id = (int) $raw_id;
				if ( $id > 0 ) {
					$valid_ids[] = $id;
				}
			}

			$item_link_meta = $this->batch_load_link_meta( $valid_ids );

			foreach ( $valid_ids as $attachment_id ) {
				$item_post = get_post( $attachment_id );
				if ( ! $item_post ) {
					continue;
				}

				if ( \FotoGrids\Galleries\Embed_Store::POST_TYPE === $item_post->post_type ) {
					$embed_view = $this->build_embed_item_view( $attachment_id, $thumb_size );
					if ( null !== $embed_view ) {
						$loaded_items[] = $embed_view;
					}
					continue;
				}

				if ( 'attachment' !== $item_post->post_type ) {
					continue;
				}

				$attachment_post = $item_post;
				$link_meta       = $item_link_meta[ $attachment_id ] ?? array();
				$item_type       = Video_Item_Helpers::type_for_attachment( $attachment_id );

				if ( Video_Item_Helpers::TYPE_FILE === $item_type ) {
					$loaded_items[] = $this->build_file_video_item_view(
						$attachment_id,
						$attachment_post,
						$link_meta,
						$thumb_size
					);
					continue;
				}

				Image_Size_Manager::ensure_dimensions( $attachment_id );

				$resolved_thumb = Image_Size_Manager::resolve_size( $attachment_id, $thumb_size, 'thumbnail' );
				$resolved_full  = Image_Size_Manager::resolve_size( $attachment_id, $full_size, 'full' );

				$thumb_src = wp_get_attachment_image_src( $attachment_id, $resolved_thumb );
				$thumb_url = is_array( $thumb_src ) ? (string) ( $thumb_src[0] ?? '' ) : '';
				$thumb_w   = is_array( $thumb_src ) && isset( $thumb_src[1] ) ? (int) $thumb_src[1] : null;
				$thumb_h   = is_array( $thumb_src ) && isset( $thumb_src[2] ) ? (int) $thumb_src[2] : null;

				$full_src = wp_get_attachment_image_src( $attachment_id, $resolved_full );
				$full_url = is_array( $full_src ) ? (string) ( $full_src[0] ?? '' ) : '';
				$full_w   = is_array( $full_src ) && isset( $full_src[1] ) ? (int) $full_src[1] : null;
				$full_h   = is_array( $full_src ) && isset( $full_src[2] ) ? (int) $full_src[2] : null;

				$loaded_items[] = new Item_View(
					$attachment_id,
					$thumb_url,
					$full_url,
					(string) get_post_meta( $attachment_id, '_wp_attachment_image_alt', true ),
					(string) $attachment_post->post_title,
					(string) $attachment_post->post_excerpt,
					(string) $attachment_post->post_content,
					'',
					'',
					( null !== $thumb_w && $thumb_w > 0 ) ? $thumb_w : null,
					( null !== $thumb_h && $thumb_h > 0 ) ? $thumb_h : null,
					$link_meta,
					array(),
					array(),
					array(),
					array(),
					array(),
					array(),
					array(),
					$resolved_thumb,
					( null !== $full_w && $full_w > 0 ) ? $full_w : null,
					( null !== $full_h && $full_h > 0 ) ? $full_h : null,
				);
			}

			return $loaded_items;
		}

		$loaded_items = call_user_func( $this->items_loader, $collection_item_ids );

		return is_array( $loaded_items ) ? $loaded_items : array();
	}

	/**
	 * Resolves captions on externally supplied items, such as template-preview demos.
	 *
	 * @since  1.1.0
	 * @param  array<int, Item_View> $items           Item views.
	 * @param  array<string, mixed>  $render_settings Render settings.
	 * @return array<int, Item_View>
	 */
	public function resolve_captions_for( array $items, array $render_settings ): array {
		return $this->resolve_captions( $items, $render_settings );
	}

	/**
	 * Resolves caption_title and caption_description, as plain text, on every loaded item.
	 *
	 * @since  1.0.0
	 * @param  array<int, Item_View>  $items           Loaded items.
	 * @param  array<string, mixed>   $render_settings Gallery render settings.
	 * @return array<int, Item_View>
	 */
	private function resolve_captions( array $items, array $render_settings ): array {
		$builder  = new Caption_Content_Builder();
		$resolved = array();

		foreach ( $items as $item_view ) {
			$content    = $builder->resolve( $item_view, $render_settings );
			$resolved[] = $item_view->with(
				array(
					'caption_title'       => $content->title,
					'caption_description' => $content->description,
				)
			);
		}

		return $resolved;
	}

	/**
	 * Applies the active layout's preferred thumbnail size.
	 *
	 * A soft preference replaces only the default fotogrids_thumbnail; a
	 * mandatory one (requires_thumbnail_size()) also overrides a user pick.
	 *
	 * @since  1.0.0
	 * @param  string               $thumb_size      Currently resolved size slug.
	 * @param  array<string, mixed> $render_settings Render settings.
	 * @param  Render_Context|null  $context         Context shell; built from $render_settings when null.
	 * @return string
	 */
	private function apply_layout_thumb_size( string $thumb_size, array $render_settings, ?Render_Context $context = null ): string {
		if ( null === $context ) {
			$context = $this->build_minimal_context( $render_settings );
		}

		$active = Module_Registry::active_modules( 'layouts', $context );
		$layout = $active[0] ?? null;
		if ( null === $layout ) {
			return $thumb_size;
		}

		$preferred = $layout->preferred_thumbnail_size( $context );
		if ( ! is_string( $preferred ) || '' === $preferred ) {
			return $thumb_size;
		}

		if ( $layout->requires_thumbnail_size( $context ) ) {
			return $preferred;
		}

		return Image_Size_Manager::SLUG_THUMBNAIL === $thumb_size ? $preferred : $thumb_size;
	}

	/**
	 * Builds a settings-only Render_Context shell for module-registry lookups.
	 *
	 * @since  1.0.0
	 * @param  array<string, mixed> $render_settings
	 * @return Render_Context
	 */
	private function build_minimal_context( array $render_settings ): Render_Context {
		$meta = new Render_Meta(
			0,
			null,
			'shell',
			Request_Source::SHORTCODE,
			false,
			Render_Mode::INITIAL,
			2,
		);

		return new Render_Context(
			$meta,
			$this->build_layout( $render_settings ),
			$this->build_behavior( $render_settings ),
			$render_settings,
			array(),
			array(),
		);
	}

	/**
	 * Returns whether this render's layout cuts its own pages in the browser.
	 *
	 * @since 1.3.0
	 * @param array<string, mixed> $render_settings
	 * @param Render_Meta          $render_meta
	 * @return bool
	 */
	public static function is_slice_planned( array $render_settings, Render_Meta $render_meta ): bool {
		return ( $render_settings['layout'] ?? '' ) === 'justified'
			&& ( $render_settings['pagination_type'] ?? 'show_all' ) === 'paginated'
			&& Collection_Kind::GALLERY === $render_meta->collection_kind;
	}

	/**
	 * Whether a gallery that cuts its own pages needs pagination: when any
	 * breakpoint's target is smaller than the item count, or Max Rows caps pages.
	 *
	 * @since 1.3.0
	 * @param int                  $total_item_count
	 * @param int                  $page_size
	 * @param array<string, mixed> $render_settings
	 * @return bool
	 */
	public static function planned_should_paginate( int $total_item_count, int $page_size, array $render_settings ): bool {
		if ( $total_item_count <= 1 ) {
			return false;
		}
		if ( (int) ( $render_settings['layout_justified_max_rows'] ?? 0 ) > 0 ) {
			return true;
		}
		$smallest = $page_size;
		foreach ( array( 'desktop', 'tablet', 'mobile' ) as $breakpoint ) {
			$smallest = min( $smallest, Page_Size_Resolver::resolve_for_breakpoint( $render_settings, $breakpoint ) );
		}
		return Page_Size_Resolver::should_paginate( $total_item_count, $smallest );
	}

	/**
	 * Aspect ratios (width / height) of the items, rounded to 4 decimals; 1.5 when unknown.
	 *
	 * @since 1.3.0
	 * @param array<int, mixed> $items Item_Views in sequence order.
	 * @return array<int, float>
	 */
	public static function aspects_of( array $items ): array {
		$aspects = array();
		foreach ( $items as $item ) {
			$w         = $item->width ?? null;
			$h         = $item->height ?? null;
			$aspects[] = ( is_int( $w ) && $w > 0 && is_int( $h ) && $h > 0 ) ? round( $w / $h, 4 ) : 1.5;
		}
		return $aspects;
	}

	/**
	 * Cutting rules for a justified gallery at a page size.
	 *
	 * @since 1.3.0
	 * @param int                  $page_size
	 * @param array<string, mixed> $render_settings
	 * @return array<string, mixed>
	 */
	public static function cut_rules( int $page_size, array $render_settings ): array {
		$mode = ( $render_settings['layout_justified_page_trailing_row'] ?? 'fill' ) === 'match' ? 'match' : 'fill';
		return array(
			'mode'          => $mode,
			'target'        => $page_size,
			'window'        => (float) ( $render_settings['layout_justified_snap_window'] ?? 20 ),
			'threshold'     => (float) ( $render_settings['layout_justified_snap_fill_threshold'] ?? 85 ),
			'direction'     => (string) ( $render_settings['layout_justified_snap_direction'] ?? 'auto' ),
			'max_rows'      => max( 0, (int) ( $render_settings['layout_justified_max_rows'] ?? 0 ) ),
			'page_end_hide' => 'match' === $mode && ( $render_settings['layout_justified_last_row'] ?? '' ) === 'hide',
		);
	}

	/**
	 * Cuts the sequence into pages at the server's geometry: the client's
	 * measured width when it sent one, otherwise the breakpoint's assumed width.
	 *
	 * @since 1.3.0
	 * @param array<int, float>    $aspects
	 * @param int                  $page_size
	 * @param array<string, mixed> $render_settings
	 * @param Render_Meta          $render_meta
	 * @return array<int, array{ offset: int, size: int }>
	 */
	private static function cut_pages( array $aspects, int $page_size, array $render_settings, Render_Meta $render_meta ): array {
		$breakpoint = is_string( $render_meta->breakpoint ?? null ) && '' !== $render_meta->breakpoint
			? $render_meta->breakpoint
			: 'desktop';

		$width = null !== $render_meta->container_width && $render_meta->container_width > 0
			? (float) $render_meta->container_width
			: Snap_Resolver::assumed_width_for( $breakpoint );

		$pages = Page_Cutter::cut(
			$aspects,
			array(
				'width'      => $width,
				'gap'        => self::resolve_gap_for_breakpoint( $render_settings, $breakpoint ),
				'row_height' => self::resolve_row_height_for_breakpoint( $render_settings, $breakpoint ),
			),
			self::cut_rules( $page_size, $render_settings )
		);

		if ( empty( $pages ) ) {
			return array(
				array(
					'offset' => 0,
					'size'   => 0,
				),
			);
		}

		return $pages;
	}

	/**
	 * How many items page 1 renders so the browser can cut it at any geometry:
	 * the largest target plus its window, plus the longest row any width can pack.
	 *
	 * @since 1.3.0
	 * @param array<int, float>    $aspects
	 * @param int                  $page_size
	 * @param array<string, mixed> $render_settings
	 * @return int
	 */
	private static function page_one_pool( array $aspects, int $page_size, array $render_settings ): int {
		$targets = array( $page_size );
		$heights = array();
		foreach ( array( 'desktop', 'tablet', 'mobile' ) as $breakpoint ) {
			$targets[] = Page_Size_Resolver::resolve_for_breakpoint( $render_settings, $breakpoint );
			$heights[] = self::resolve_row_height_for_breakpoint( $render_settings, $breakpoint );
		}
		$target = max( $targets );
		$window = (int) round( $target * (float) ( $render_settings['layout_justified_snap_window'] ?? 20 ) / 100.0 );

		$longest = 1;
		foreach ( Page_Cutter::pack( $aspects, self::POOL_WIDTH, 0.0, min( $heights ) ) as $row ) {
			$longest = max( $longest, count( $row ) );
		}

		return min( count( $aspects ), $target + $window + $longest );
	}

	/**
	 * Marks items from `$from` on as overflow.
	 *
	 * @since 1.3.0
	 * @param array<int, Item_View> $items
	 * @param int                   $from
	 * @return array<int, Item_View>
	 */
	private static function mark_overflow( array $items, int $from ): array {
		foreach ( $items as $i => $item ) {
			if ( $i >= $from ) {
				$items[ $i ] = $item->with(
					array( 'data_attrs' => array_merge( $item->data_attrs, array( 'data-fg-overflow' => '1' ) ) )
				);
			}
		}
		return $items;
	}

	/**
	 * Resolves the per-breakpoint gap from item_spacing settings.
	 *
	 * @since 1.0.0
	 * @param array<string, mixed> $render_settings
	 * @param string               $breakpoint
	 * @return float
	 */
	private static function resolve_gap_for_breakpoint( array $render_settings, string $breakpoint ): float {
		$spacing  = is_array( $render_settings['item_spacing'] ?? null ) ? $render_settings['item_spacing'] : array();
		$fallback = array(
			'desktop' => 10.0,
			'tablet'  => 8.0,
			'mobile'  => 5.0,
		);

		$value = $spacing[ $breakpoint ] ?? null;
		if ( is_array( $value ) ) {
			$value = $value['value'] ?? null;
		}
		if ( is_numeric( $value ) && (float) $value >= 0 ) {
			return (float) $value;
		}

		return $fallback[ $breakpoint ] ?? 10.0;
	}

	/**
	 * Resolves the per-breakpoint justified row height in pixels.
	 *
	 * @since 1.0.0
	 * @param array<string, mixed> $render_settings
	 * @param string               $breakpoint
	 * @return float
	 */
	private static function resolve_row_height_for_breakpoint( array $render_settings, string $breakpoint ): float {
		$row_height = is_array( $render_settings['layout_justified_row_height'] ?? null ) ? $render_settings['layout_justified_row_height'] : array();
		$fallback   = array(
			'desktop' => 220.0,
			'tablet'  => 180.0,
			'mobile'  => 140.0,
		);

		$raw = $row_height[ $breakpoint ] ?? null;
		if ( is_array( $raw ) ) {
			$raw = $raw['value'] ?? null;
		}
		if ( is_numeric( $raw ) && (float) $raw > 0 ) {
			return (float) $raw;
		}

		return $fallback[ $breakpoint ] ?? 220.0;
	}

	/**
	 * Batch-fetches external_url and link_target for the given items.
	 *
	 * @since   1.0.0
	 * @param   array<int, int> $attachment_ids Attachment IDs to load.
	 * @return  array<int, array{external_url: string, link_target: string}>
	 */
	private function batch_load_link_meta( array $attachment_ids ): array {
		$result = array();
		foreach ( \FotoGrids\Galleries\Item_Meta::get_many( $attachment_ids ) as $aid => $row ) {
			$result[ $aid ] = array(
				'external_url' => (string) ( $row['external_url'] ?? '' ),
				'link_target'  => (string) ( $row['link_target'] ?? 'global' ),
			);
		}

		return $result;
	}

	/**
	 * Merges preview overrides into item meta maps.
	 *
	 * @since   1.0.0
	 * @param   array<int, Item_View>                        $collection_items Collection items.
	 * @param   array<int|string, array<string, mixed>>      $item_overrides Item overrides by ID.
	 * @return  array<int, Item_View>
	 */
	private function apply_item_overrides( array $collection_items, array $item_overrides ): array {
		$overridden_items = array();

		foreach ( $collection_items as $item_view ) {
			$override_data = $item_overrides[ $item_view->id ] ?? null;
			if ( ! is_array( $override_data ) ) {
				$overridden_items[] = $item_view;
				continue;
			}

			$overridden_items[] = $item_view->with(
				array(
					'meta' => array_merge( $item_view->meta, $override_data ),
				)
			);
		}

		return $overridden_items;
	}

	/**
	 * Forces settings a layout fixes, overriding values stored under a previous layout.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $render_settings Resolved settings.
	 * @return  array<string, mixed>
	 */
	private static function coerce_layout_settings( array $render_settings ): array {
		$layout = $render_settings['layout'] ?? '';

		if ( 'instant-photos' === $layout ) {
			$render_settings['caption_placement'] = 'bottom';
		}

		return $render_settings;
	}
}
