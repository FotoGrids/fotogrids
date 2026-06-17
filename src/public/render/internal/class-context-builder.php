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
	 * Creates a context for public rendering.
	 *
	 * @since   1.0.0
	 * @param   int                  $gallery_id Gallery identifier.
	 * @param   array<string, mixed> $render_settings Normalized settings.
	 * @param   array<int, mixed>    $collection_item_ids Item IDs.
	 * @param   Request_Source       $source Request source.
	 * @param   int|null             $album_id Album identifier.
	 * @param   array<string, mixed> $meta_overrides Optional Render_Meta field overrides.
	 *                                               Accepted keys: requested_page,
	 *                                               requested_per_page, breakpoint,
	 *                                               partial, view_page,
	 *                                               via_album_id. Used by the REST
	 *                                               /gallery/render endpoint to drive
	 *                                               pagination + partial rendering,
	 *                                               and by ViewCollections / album-ajax
	 *                                               flows to thread visit context.
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
		// Random sort seed.
		//   - If the caller (typically the paginated REST handler) supplied
		//     one, honour it so paginated requests draw from the same
		//     permutation that the initial render used.
		//   - Otherwise generate a fresh seed for this render. Even non-
		//     random-sort galleries get a seed (cheap), so toggling sort
		//     to random later wouldn't change the wire shape.
		// Capped at 2^31-1 (mt_rand's native range) so JavaScript's
		// 53-bit-float Number type can round-trip the value losslessly.
		// PHP_INT_MAX is 64-bit on most servers; seeds beyond ~9e15 lose
		// precision when sent as JSON and arrive at the server with the
		// last digits zeroed, producing a different shuffle and duplicate
		// items across paginated pages.
		$random_seed = isset( $meta_overrides['random_seed'] ) && null !== $meta_overrides['random_seed']
			? (int) $meta_overrides['random_seed']
			: random_int( 1, 2147483647 );

		// is_ajax_swap must be set explicitly by the caller. The /gallery/
		// render REST handler stamps it true on every payload it returns;
		// every other code path (shortcode, block, ViewCollections,
		// preview) leaves it false. We don't infer from Request_Source
		// here because legitimate non-AJAX renders can also legitimately
		// arrive with ALBUM_AJAX as their source (e.g. an embedded
		// gallery whose shortcode carries album_id="N").
		$is_ajax_swap = ! empty( $meta_overrides['is_ajax_swap'] );

		$view_page = ! empty( $meta_overrides['view_page'] );

		$render_meta = new Render_Meta(
			$gallery_id,
			$album_id,
			$this->instance_id_factory->generate( $gallery_id ),
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
		);

		// Visit-context album. Honour an explicit meta override (REST /
		// gallery/render path); otherwise read the `fg_via` query var
		// for normal page loads. Validation (does this album really
		// contain this gallery?) is deferred to Breadcrumb_Resolver.
		$via_album_id = null;
		if ( array_key_exists( 'via_album_id', $meta_overrides ) ) {
			$candidate    = (int) $meta_overrides['via_album_id'];
			$via_album_id = $candidate > 0 ? $candidate : null;
		} else { // phpcs:ignore Universal.ControlStructures.DisallowLonelyIf.Found -- else block wraps nonce-suppression pragmas; cannot collapse to elseif.
			// Public breadcrumb context hint read from a normal front-end page
			// view (no form submission, no state change), so nonce verification
			// does not apply. The (int) cast is the sanitization, and the value
			// is only validated/used as an album id by Breadcrumb_Resolver.
            // phpcs:disable WordPress.Security.NonceVerification.Recommended, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
			if ( isset( $_GET['fg_via'] ) ) {
				$candidate    = (int) wp_unslash( $_GET['fg_via'] );
				$via_album_id = $candidate > 0 ? $candidate : null;
			}
            // phpcs:enable WordPress.Security.NonceVerification.Recommended, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		}

		[ $thumb_size, $full_size ] = $this->resolve_size_settings( $render_settings );

		// Build a context shell (no items yet) so Module_Registry::active_modules()
		// can call supports() on each registered sorter. The sorter receives this
		// same context so it can read settings, gallery_id, is_preview, etc.
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

		// Single Item layout: only one item ever renders, picked by the
		// active sorter (so random sorter naturally gives a different image
		// per request, manual gives the first, etc). The slice happens
		// upstream of load_items so we only do attachment hydration for the
		// one item we're going to render. The full sorted-ID count is
		// captured separately below and stamped into Render_Meta so the
		// lightbox-extended path knows the real gallery size.
		$is_single_item         = ( $render_settings['layout'] ?? '' ) === 'single-item';
		$single_item_full_count = $is_single_item ? count( $sorted_ids ) : null;
		if ( $is_single_item ) {
			$sorted_ids = array_slice( $sorted_ids, 0, 1 );
		}

		$thumb_size = $this->apply_layout_thumb_size( $thumb_size, $render_settings, $sort_context );

		$loaded_items = $this->load_items( $sorted_ids, $thumb_size, $full_size );
		$loaded_items = $this->resolve_captions( $loaded_items, $render_settings );

		// Server-side filtering. Runs BEFORE pagination so the page index
		// is computed against the filtered set, not the raw item list.
		//
		// Filter sources implement matches() per item; we apply AND across
		// sources and rely on each source's own OR-within semantics. An
		// item must pass every source that has active values.
		//
		// Only applies when active_filters is non-empty (REST pagination
		// requests with filter state) - initial shortcode renders never
		// pass active_filters, so the client-side filter UI keeps full
		// control of which items are visually shown on page 1.
		if ( ! empty( $render_meta->active_filters ) && Collection_Kind::GALLERY === $render_meta->collection_kind ) {
			// Rebuild context so filter sources see the sorted + loaded
			// items (needed by their supports() checks).
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

		// Record the total BEFORE pagination slicing (but AFTER filtering)
		// so chrome modules emit data-fg-page-total against the filtered set.
		//
		// For Single Item layout, $loaded_items has length 1 because we
		// sliced the sorted-ID list upstream. The lightbox-extended path
		// still needs to know the real gallery size, so we substitute the
		// pre-slice count captured before load_items().
		$total_item_count = $single_item_full_count ?? count( $loaded_items );
		$render_meta      = $render_meta->with( array( 'total_item_count' => $total_item_count ) );

		// Pagination slicing. Runs after sorter selection (canonical order
		// already established) and after caption resolution + filtering (so
		// the slice contains fully-prepared Item_Views from the filtered set).
		// Layouts that opt out via the `paginates` capability (slider,
		// image-viewer) skip slicing entirely - their own navigation walks
		// the full item list.
		$paginates_capability = Layout_Capabilities::supports( $sort_context, 'paginates' );
		if ( ( $render_settings['pagination_type'] ?? 'show_all' ) === 'paginated'
			&& Collection_Kind::GALLERY === $render_meta->collection_kind
			&& $paginates_capability
		) {
			$per_page_override = $render_meta->requested_per_page;
			$page_size         = null !== $per_page_override && $per_page_override > 0
				? $per_page_override
				: Page_Size_Resolver::resolve_page_size( $render_settings, $sort_context );
			$page              = max( 1, (int) ( $render_meta->requested_page ?? 1 ) );

			if ( self::is_snap_pagination_active( $render_settings ) && Page_Size_Resolver::should_paginate( $total_item_count, $page_size ) ) {
				$snap         = self::resolve_justified_snap(
					$loaded_items,
					$page_size,
					$page,
					$render_settings,
					$render_meta
				);
				$loaded_items = array_slice( $loaded_items, $snap['offset'], $snap['page_size'] );
				$render_meta  = $render_meta->with(
					array(
						'pagination_page_size'   => $snap['page_size'],
						'pagination_total_pages' => $snap['total_pages'],
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
		}

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
		[ $thumb_size, $full_size ] = $this->resolve_size_settings( $render_settings );
		$thumb_size                 = $this->apply_layout_thumb_size( $thumb_size, $render_settings );
		$collection_items           = $this->load_items( $collection_item_ids, $thumb_size, $full_size );
		if ( ! empty( $item_overrides ) ) {
			$collection_items = $this->apply_item_overrides( $collection_items, $item_overrides );
		}
		$collection_items = $this->resolve_captions( $collection_items, $render_settings );

		if ( null !== $simulate_state && ! in_array( $simulate_state, array( 'ok', 'password_required', 'expired', 'unauthorized' ), true ) ) {
			$warnings[] = sprintf( 'Unsupported simulate_state: %s', $simulate_state );
		}

		return new Render_Context(
			new Render_Meta(
				$gallery_id,
				null,
				$this->instance_id_factory->generate( $gallery_id ),
				$source,
				true,
				Render_Mode::AJAX,
				2
			),
			$this->build_layout( $render_settings ),
			$this->build_behavior( $render_settings ),
			$render_settings,
			$collection_items,
			$warnings
		);
	}

	/**
	 * Creates a context for rendering an album as a collection.
	 *
	 * An album-as-collection renders one item per child gallery. Each
	 * Item_View is a gallery summary (featured-image-or-first-attachment
	 * thumbnail + gallery title as caption) supplied by Album_Item_Loader.
	 * The same Grid / Justified / Masonry layouts apply. Click-behaviour
	 * decorators specific to attachments (Lightbox, Direct_Link,
	 * External_Link) opt out via supports(); the album-specific click
	 * decorators (Album_To_View_Page, Album_To_Gallery_Ajax) opt in.
	 *
	 * No sorting: child galleries arrive in album-stored order. None of
	 * the existing sorters operate on gallery summaries; running them
	 * would be a no-op at best and misbehave at worst.
	 *
	 * @since   1.0.0
	 * @param   int                  $album_id            Album post identifier.
	 * @param   array<string, mixed> $render_settings     Resolved album settings.
	 * @param   array<int, mixed>    $child_gallery_ids   Child gallery post IDs in album-stored order.
	 * @param   Request_Source       $source              Request source.
	 * @return  Render_Context
	 */
	public function build_for_album(
		int $album_id,
		array $render_settings = array(),
		array $child_gallery_ids = array(),
		string $source = Request_Source::SHORTCODE
	): Render_Context {
		$render_settings = self::coerce_layout_settings( $render_settings );

		$render_meta = new Render_Meta(
			// gallery_id is intentionally 0 - the render's primary identity
			// is the album. instance_id_factory needs SOMETHING unique to
			// build an instance ID off; we feed it the album_id so the IDs
			// are stable per-album.
			0,
			$album_id,
			$this->instance_id_factory->generate( $album_id ),
			$source,
			false,
			Render_Mode::INITIAL,
			2,
			Collection_Kind::ALBUM,
		);

		[ $thumb_size ] = $this->resolve_size_settings( $render_settings );
		$thumb_size     = $this->apply_layout_thumb_size( $thumb_size, $render_settings );

		// Load gallery-summary items directly via Album_Item_Loader, bypassing
		// the attachment-flavoured items_loader path entirely.
		$loaded_items = Album_Item_Loader::load( $child_gallery_ids, $thumb_size );
		// Captions decorator picks up caption_title / caption_description
		// from the Item_View. For albums we always pass the gallery title
		// through as caption_title - call resolve_captions to handle the
		// normal caption_hide_title / source resolution logic too.
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
	 * For each filter source registered AND active for the context, if
	 * the source's REST arg key is present in $active_filters with a
	 * non-empty value list, every item is run through $source->matches().
	 * AND across sources (item must pass every source with active values).
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

		// Resolve sources that have active values supplied.
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
	 * Asks Module_Registry for all active 'sorters' modules for the given
	 * context (which already has settings and meta set). The registry returns
	 * them in origin-precedence order (fotogrids < fotogrids-pro < third-party)
	 * with replaces() already resolved, so we always call the first one.
	 *
	 * Falls back to the original order when no sorter is active (should not
	 * happen in practice because Manual_Sorter covers the default case, but
	 * this guards against a mis-configured registry).
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
	 * Returns "cover" | "contain" or an empty string. Empty means "do not
	 * emit the var" - the CSS fallback in the layout stylesheet takes over.
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
	 * Returns either a "W / H" string (e.g. "4 / 3") or an empty string.
	 * Empty means "do not emit the var" - the CSS fallback in the layout
	 * stylesheet takes over.
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

		// 'none' means "use the image's natural aspect ratio". Return the
		// empty string so style_vars() skips emitting --fg-item-aspect-ratio
		// and the .fg-item-media container has no enforced ratio.
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

		// Preset values arrive as "W/H" (e.g. "4/3"). Normalize to "W / H".
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
		return new Render_Behavior(
			// Admin saves as 'item_click_behavior'; fall back to legacy 'click_behavior' key.
			is_string( $render_settings['item_click_behavior'] ?? $render_settings['click_behavior'] ?? null ) ? ( $render_settings['item_click_behavior'] ?? $render_settings['click_behavior'] ) : 'lightbox',
			is_string( $render_settings['pagination_type'] ?? null ) ? $render_settings['pagination_type'] : 'show_all',
			is_string( $render_settings['pagination_method'] ?? null ) ? $render_settings['pagination_method'] : 'load_more',
			is_string( $render_settings['hover_effect'] ?? null ) ? $render_settings['hover_effect'] : null
		);
	}

	/**
	 * Build an Item_View for a Media Library video attachment.
	 *
	 * Video attachments produce no image src, so the grid thumbnail comes from
	 * the poster chain instead. The poster URL is used for both thumb_url and
	 * full_url so layout sizing and the lightbox poster work unchanged; the
	 * direct video file URL is carried in video_src for the player.
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
		$custom_data = $this->load_item_custom_data( $attachment_id, 0 );
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
			(string) get_post_meta( $attachment_id, '_wp_attachment_item_alt', true ),
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
		);
	}

	/**
	 * Build an Item_View for a single embed post.
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

		// Re-assemble the custom_data shape the poster resolver expects.
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
	 * Read and decode the custom_data JSON for a single item row.
	 *
	 * @since   1.1.0
	 * @param   int $attachment_id Attachment ID (0 for embeds).
	 * @param   int $gallery_id    Gallery scope for the row.
	 * @return  array<string, mixed> Decoded custom_data, or empty array.
	 */
	private function load_item_custom_data( int $attachment_id, int $gallery_id ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'fotogrids_item_meta';

		// $table is $wpdb->prefix.'fotogrids_item_meta' (trusted literal); all
		// values are bound via $wpdb->prepare(). Custom table: direct query, no cache.
        // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.Security.DirectDB.UnescapedDBParameter, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$raw = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT custom_data FROM {$table} WHERE attachment_id = %d AND gallery_id = %d LIMIT 1",
				$attachment_id,
				$gallery_id
			)
		);
        // phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.Security.DirectDB.UnescapedDBParameter, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared

		if ( empty( $raw ) ) {
			return array();
		}

		$decoded = json_decode( (string) $raw, true );
		return is_array( $decoded ) ? $decoded : array();
	}

	/**
	 * Loads item view data through the configured loader callback.
	 *
	 * When no custom loader is provided the method performs two queries:
	 *  1. Standard WP attachment data (get_post + image URLs + alt).
	 *  2. A single batch SELECT on fotogrids_item_meta to pull external_url and
	 *     link_target for every item at once, keyed by attachment_id.
	 *
	 * Both external_url and link_target are stored in Item_View::meta so
	 * decorators (Direct_Link, External_Link) can read them without coupling
	 * to the DB themselves.
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

			// Normalise IDs first so we can batch-query once.
			$valid_ids = array();
			foreach ( $collection_item_ids as $raw_id ) {
				$id = (int) $raw_id;
				if ( $id > 0 ) {
					$valid_ids[] = $id;
				}
			}

			// Batch-fetch external_url + link_target from fotogrids_item_meta.
			// Uses gallery_id = 0 rows (global item data written by the item edit modal).
			$item_link_meta = $this->batch_load_link_meta( $valid_ids );

			foreach ( $valid_ids as $attachment_id ) {
				$item_post = get_post( $attachment_id );
				if ( ! $item_post ) {
					continue;
				}

				// Embed posts are first-class list members; build their view
				// directly. Anything that is neither an attachment nor an embed
				// is skipped.
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
					(string) get_post_meta( $attachment_id, '_wp_attachment_item_alt', true ),
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
	 * Resolves caption_title and caption_description on every loaded item.
	 *
	 * Runs each Item_View through Caption_Content_Builder using the gallery
	 * settings, and returns a new array of Item_View instances with
	 * caption_title and caption_description populated.  Items coming from a
	 * custom items_loader will also go through this step so third-party loaders
	 * benefit automatically.
	 *
	 * @since  1.0.0
	 * @param  array<int, Item_View>  $items           Loaded items.
	 * @param  array<string, mixed>   $render_settings Gallery render settings.
	 * @return array<int, Item_View>
	 */
	private function resolve_captions( array $items, array $render_settings ): array {
		// Image Viewer renders only the caption title, in its control bar, and
		// hides Item Description and Limit Title Length in the admin. Neutralise
		// those hidden settings here so they can never apply at the frontend:
		// force the description off and the title-length limit to "no" before
		// the content builder reads them.
		$layout = is_string( $render_settings['layout'] ?? null ) ? $render_settings['layout'] : '';
		if ( 'image-viewer' === $layout ) {
			$render_settings['caption_hide_description']   = true;
			$render_settings['caption_limit_title_length'] = 'no';
		}

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
	 * Extract and resolve image size slugs from render settings.
	 *
	 * Handles custom sizes by registering them on the fly if needed.
	 * Returns a two-element array: [ $thumb_size_slug, $full_size_slug ].
	 *
	 * @since  1.0.0
	 * @param  array<string, mixed> $render_settings
	 * @return array{string, string}
	 */
	private function resolve_size_settings( array $render_settings ): array {
		$raw_thumb = is_string( $render_settings['thumbnail_size'] ?? null )
			? $render_settings['thumbnail_size']
			: Image_Size_Manager::SLUG_THUMBNAIL;

		$raw_full = is_string( $render_settings['full_image_size'] ?? null )
			? $render_settings['full_image_size']
			: Image_Size_Manager::SLUG_FULL;

		// If custom thumbnail size, register it and get the deterministic slug
		$thumb_slug = $raw_thumb;
		if ( 'custom' === $raw_thumb ) {
			$w          = max( 1, (int) ( $render_settings['thumbnail_custom_size_width'] ?? 400 ) );
			$h          = max( 0, (int) ( $render_settings['thumbnail_custom_size_height'] ?? 300 ) );
			$crop       = (bool) ( $render_settings['thumbnail_custom_size_crop'] ?? true );
			$alignment  = is_string( $render_settings['thumbnail_custom_size_crop_alignment'] ?? null )
				? $render_settings['thumbnail_custom_size_crop_alignment']
				: 'center';
			$thumb_slug = Image_Size_Manager::register_custom_size( $w, $h, $crop, $alignment );
		}

		// If custom full size, register it similarly
		$full_slug = $raw_full;
		if ( 'custom' === $raw_full ) {
			$w         = max( 1, (int) ( $render_settings['full_image_custom_size_width'] ?? 1920 ) );
			$h         = max( 0, (int) ( $render_settings['full_image_custom_size_height'] ?? 0 ) );
			$crop      = (bool) ( $render_settings['full_image_custom_size_crop'] ?? false );
			$alignment = is_string( $render_settings['full_image_custom_size_crop_alignment'] ?? null )
				? $render_settings['full_image_custom_size_crop_alignment']
				: 'center';
			$full_slug = Image_Size_Manager::register_custom_size( $w, $h, $crop, $alignment );
		}

		return array( $thumb_slug, $full_slug );
	}

	/**
	 * Asks the active layout module for its preferred thumbnail size and
	 * swaps in for it.
	 *
	 * Layouts express their preference via Layout::preferred_thumbnail_size().
	 * Returning null means "no preference" and the configured value is
	 * returned unchanged. A soft preference only replaces the default
	 * fotogrids_thumbnail, leaving an explicit user pick untouched. A
	 * mandatory preference (Layout::requires_thumbnail_size() === true, used
	 * by Justified and Masonry) overrides the user pick too, because those
	 * layouts cannot render with an arbitrary cropped derivative. The
	 * returned slug still flows through Image_Size_Manager's fallback chain
	 * so a missing derivative degrades to fotogrids_thumbnail → thumbnail →
	 * medium → full.
	 *
	 * @since  1.0.0
	 * @param  string               $thumb_size      Currently resolved size slug.
	 * @param  array<string, mixed> $render_settings Render settings.
	 * @param  Render_Context|null  $context         Optional pre-built context shell. When omitted a minimal one is constructed from $render_settings.
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

		// A mandatory preference (Justified, Masonry) overrides even an
		// explicit user-picked size - those layouts cannot render with an
		// arbitrary cropped derivative. A soft preference only applies when
		// the user has left thumbnail_size on its default, so explicit
		// choices still win for layouts that can honour them.
		if ( $layout->requires_thumbnail_size( $context ) ) {
			return $preferred;
		}

		return Image_Size_Manager::SLUG_THUMBNAIL === $thumb_size ? $preferred : $thumb_size;
	}

	/**
	 * Builds a settings-only Render_Context shell for callers that need to
	 * consult the module registry before they have item data. Used by the
	 * preview and album code paths where the full pre-sort context shell
	 * doesn't exist yet.
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
	 * Whether snap pagination is active for the given settings. Snap
	 * applies to paginated justified galleries when the page-trailing-row
	 * mode is set to 'fill'.
	 *
	 * @since 1.0.0
	 * @param array<string, mixed> $render_settings
	 */
	private static function is_snap_pagination_active( array $render_settings ): bool {
		if ( ( $render_settings['layout'] ?? '' ) !== 'justified' ) {
			return false;
		}
		if ( ( $render_settings['layout_justified_page_trailing_row'] ?? '' ) !== 'fill' ) {
			return false;
		}
		return true;
	}

	/**
	 * Build aspect ratios + invoke the snap resolver.
	 *
	 * @since 1.0.0
	 * @param array<int, \FotoGrids\Render\Api\Item_View> $items
	 * @param int                                          $target_page_size
	 * @param int                                          $requested_page
	 * @param array<string, mixed>                         $render_settings
	 * @param \FotoGrids\Render\Api\Render_Meta            $render_meta
	 * @return array{ page_size: int, offset: int, total_pages: int }
	 */
	private static function resolve_justified_snap(
		array $items,
		int $target_page_size,
		int $requested_page,
		array $render_settings,
		Render_Meta $render_meta
	): array {
		$breakpoint = is_string( $render_meta->breakpoint ?? null ) && '' !== $render_meta->breakpoint
			? $render_meta->breakpoint
			: 'desktop';

		$aspect_ratios = array();
		foreach ( $items as $item ) {
			$w               = $item->width ?? null;
			$h               = $item->height ?? null;
			$aspect_ratios[] = ( is_int( $w ) && $w > 0 && is_int( $h ) && $h > 0 )
				? ( $w / $h )
				: 1.5;
		}

		$container_width = null !== $render_meta->container_width && $render_meta->container_width > 0
			? (float) $render_meta->container_width
			: Snap_Resolver::assumed_width_for( $breakpoint );

		return Snap_Resolver::resolve(
			array(
				'aspect_ratios'     => $aspect_ratios,
				'target_page_size'  => $target_page_size,
				'requested_page'    => $requested_page,
				'container_width'   => $container_width,
				'gap'               => self::resolve_gap_for_breakpoint( $render_settings, $breakpoint ),
				'target_row_height' => self::resolve_row_height_for_breakpoint( $render_settings, $breakpoint ),
				'window_percent'    => (float) ( $render_settings['layout_justified_snap_window'] ?? 20 ),
				'fill_threshold'    => (float) ( $render_settings['layout_justified_snap_fill_threshold'] ?? 60 ),
				'direction'         => (string) ( $render_settings['layout_justified_snap_direction'] ?? 'auto' ),
			)
		);
	}

	/**
	 * Resolve the per-breakpoint --fg-gap value from item_spacing settings.
	 *
	 * @since 1.0.0
	 * @param array<string, mixed> $render_settings
	 * @param string               $breakpoint
	 * @return float
	 */
	private static function resolve_gap_for_breakpoint( array $render_settings, string $breakpoint ): float {
		$spacing = $render_settings['item_spacing'] ?? null;
		if ( ! is_array( $spacing ) ) {
			return 10.0;
		}

		$cascade = array( $breakpoint, 'tablet', 'desktop' );
		foreach ( $cascade as $bp ) {
			if ( ! isset( $spacing[ $bp ] ) ) {
				continue;
			}
			$value = is_array( $spacing[ $bp ] ) ? ( $spacing[ $bp ]['value'] ?? null ) : $spacing[ $bp ];
			if ( is_numeric( $value ) && (float) $value >= 0 ) {
				return (float) $value;
			}
		}

		return 10.0;
	}

	/**
	 * Resolve the per-breakpoint justified row height in pixels.
	 *
	 * @since 1.0.0
	 * @param array<string, mixed> $render_settings
	 * @param string               $breakpoint
	 * @return float
	 */
	private static function resolve_row_height_for_breakpoint( array $render_settings, string $breakpoint ): float {
		$row_height = $render_settings['layout_justified_row_height'] ?? null;
		if ( ! is_array( $row_height ) ) {
			return 220.0;
		}

		$cascade  = array( $breakpoint, 'tablet', 'desktop' );
		$fallback = array(
			'desktop' => 220.0,
			'tablet'  => 180.0,
			'mobile'  => 140.0,
		);

		foreach ( $cascade as $bp ) {
			$raw = $row_height[ $bp ] ?? null;
			if ( is_array( $raw ) ) {
				$raw = $raw['value'] ?? null;
			}
			if ( is_numeric( $raw ) && (float) $raw > 0 ) {
				return (float) $raw;
			}
		}

		return $fallback[ $breakpoint ] ?? 220.0;
	}

	/**
	 * Batch-fetches external_url and link_target from fotogrids_item_meta.
	 *
	 * Queries gallery_id = 0 rows, which are the global per-item records written
	 * by the item edit modal. Returns a map of attachment_id → meta array so the
	 * caller can look up each item in O(1).
	 *
	 * @since   1.0.0
	 * @param   array<int, int> $attachment_ids Attachment IDs to load.
	 * @return  array<int, array{external_url: string, link_target: string}>
	 */
	private function batch_load_link_meta( array $attachment_ids ): array {
		if ( empty( $attachment_ids ) ) {
			return array();
		}

		global $wpdb;

		$table        = $wpdb->prefix . 'fotogrids_item_meta';
		$placeholders = implode( ',', array_fill( 0, count( $attachment_ids ), '%d' ) );

		// Fetch global item rows (gallery_id = 0) only; these carry the
		// external_url / link_target set via the item edit modal.
		// $table is $wpdb->prefix.'fotogrids_item_meta' (trusted literal); the
		// IN() list is built from generated %d placeholders and bound through
		// $wpdb->prepare(). Custom table, so direct query + no object cache.
        // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, WordPress.Security.DirectDB.UnescapedDBParameter, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
		$sql  = "SELECT attachment_id, external_url, link_target FROM {$table} WHERE gallery_id = 0 AND attachment_id IN ({$placeholders})";
		$rows = $wpdb->get_results(
			$wpdb->prepare( $sql, ...$attachment_ids ),
			ARRAY_A
		);
        // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, WordPress.Security.DirectDB.UnescapedDBParameter, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare

		$result = array();
		if ( is_array( $rows ) ) {
			foreach ( $rows as $row ) {
				$aid            = (int) $row['attachment_id'];
				$result[ $aid ] = array(
					'external_url' => (string) ( $row['external_url'] ?? '' ),
					'link_target'  => (string) ( $row['link_target'] ?? 'global' ),
				);
			}
		}

		return $result;
	}

	/**
	 * Merge preview overrides into item meta maps.
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
	 * Apply layout-driven coercions to the resolved settings array before
	 * decorators and the layout consume it.
	 *
	 * Some layouts treat individual settings as fixed by design (e.g. Instant
	 * Photos always renders captions below the image). The admin UI hides the
	 * picker but stored values from a previous layout choice can persist on
	 * a gallery that was switched over. Coercing here means every consumer
	 * (Captions decorator, layout class, REST handlers) sees the layout's
	 * intended value without each having to special-case it.
	 *
	 * @since   1.0.0
	 * @param   array<string, mixed> $render_settings Resolved settings.
	 * @return  array<string, mixed>
	 */
	private static function coerce_layout_settings( array $render_settings ): array {
		$layout = $render_settings['layout'] ?? '';

		if ( 'instant-photos' === $layout ) {
			// The Instant Photos layout always renders the caption below the
			// image; the placement picker is hidden in the admin for this
			// layout. Force the value here so the Captions decorator stamps
			// data-fg-caption="bottom" regardless of what's stored.
			$render_settings['caption_placement'] = 'bottom';
		}

		return $render_settings;
	}
}
