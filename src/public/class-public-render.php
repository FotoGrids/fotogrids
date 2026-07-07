<?php
namespace FotoGrids;

use FotoGrids\Hooks\Actions_Cache;
use FotoGrids\Hooks\Filters_Page_Builders;
use FotoGrids\Render\Api\Request_Source;
use FotoGrids\Render\Api\Item_View;
use FotoGrids\Render\Internal\Context_Builder;
use FotoGrids\Render\Internal\Inline_Asset_Emitter;
use FotoGrids\Render\Internal\Render_Controller;
use FotoGrids\Render\Internal\Render_Result;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Public Render Class
 *
 * Handles frontend rendering for FotoGrids
 */
class Public_Render {

	/**
	 * Thread-local flag: when true, every gallery/album shortcode call made
	 * during this request lands in Render_Meta with `view_page=true`.
	 * Set by ViewCollections\Renderer::gallery_html() around its call to
	 * gallery_shortcode() / album_shortcode() so the Collection_Header
	 * feature can gate its "view_pages" placement.
	 *
	 * @var bool
	 * @since 1.0.0
	 */
	private static bool $view_page_context = false;

	/**
	 * Toggle the view-page context flag. ViewCollections wraps its
	 * shortcode call in `set_view_page_context(true)` … `set_view_page_context(false)`
	 * so a single page render can have view-page chrome on the gallery and
	 * still rely on plain `gallery_shortcode()` for normal embeds (which
	 * stay context-free).
	 *
	 * @since 1.0.0
	 * @param bool $is_view_page
	 * @return void
	 */
	public static function set_view_page_context( bool $is_view_page ): void {
		self::$view_page_context = $is_view_page;
	}

	/**
	 * @since 1.0.0
	 * @return bool
	 */
	public static function is_view_page_context(): bool {
		return self::$view_page_context;
	}

	/**
	 * Initialize the public rendering
	 */
	public static function init() {
		add_shortcode( 'fotogrids_gallery', array( __CLASS__, 'gallery_shortcode' ) );
		add_shortcode( 'fotogrids_album', array( __CLASS__, 'album_shortcode' ) );

		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_frontend_scripts' ) );
	}

	/**
	 * Get gallery settings with defaults
	 *
	 * @param int $gallery_id Gallery ID
	 * @return array Gallery settings
	 */
	private static function get_gallery_settings( $gallery_id ) {
		return \FotoGrids\Galleries\Gallery_Repository::get_settings( (int) $gallery_id );
	}

	/**
	 * Re-enqueue the CSS and JS assets that were collected during the original render.
	 *
	 * On a cache hit the render pipeline never runs, so Asset_Resolver never
	 * collects module assets. This method replays both stored maps directly,
	 * mirroring Asset_Resolver::flush() for both sides.
	 *
	 * @since  1.0.0
	 * @param  array<string, string>                             $css Handle → URL map.
	 * @param  array<string, array{src: string, in_footer: bool}> $js  Handle → metadata map.
	 * @return void
	 */
	private static function replay_cached_assets( array $css, array $js ): void {
		$resolver        = \FotoGrids\Render\Internal\Asset_Resolver::instance();
		$already_css     = $resolver->get_css_asset_urls();
		$already_js      = $resolver->get_js_asset_data();
		$new_css_handles = array();

		foreach ( $css as $handle => $src ) {
			if ( isset( $already_css[ $handle ] ) ) {
				continue;
			}
			wp_register_style( $handle, $src, array(), FOTOGRIDS_VERSION );
			wp_enqueue_style( $handle );
			$new_css_handles[] = $handle;
		}

		if ( ! empty( $new_css_handles ) && ( did_action( 'wp_head' ) > 0 || did_action( 'admin_head' ) > 0 ) ) {
			wp_print_styles( $new_css_handles );
		}

		foreach ( $js as $handle => $meta ) {
			if ( isset( $already_js[ $handle ] ) ) {
				continue;
			}
			wp_register_script( $handle, $meta['src'], array(), FOTOGRIDS_VERSION, $meta['in_footer'] );
			wp_enqueue_script( $handle );
		}
	}

	/**
	 * Render one gallery through the render controller pipeline.
	 *
	 * @param int   $gallery_id Gallery ID.
	 * @param array $settings Gallery settings.
	 * @param array $item_ids Ordered gallery item IDs.
	 * @param array $atts Shortcode attributes.
	 * @return string
	 */
	private static function render_gallery_with_pipeline( $gallery_id, $settings, $item_ids, $atts, $source = Request_Source::SHORTCODE, $is_preview = false, $meta_overrides = array() ) {
		if ( ! class_exists( Context_Builder::class ) || ! class_exists( Render_Controller::class ) ) {
			return '';
		}

		$settings_overlay = array();
		if ( ! empty( $atts['template'] ) && is_string( $atts['template'] ) ) {
			$settings_overlay['layout'] = sanitize_text_field( $atts['template'] );
		}

		if ( ! empty( $atts['cols'] ) ) {
			$cols = absint( $atts['cols'] );
			if ( $cols > 0 ) {
				$settings_overlay['columns'] = array(
					'desktop' => $cols,
					'tablet'  => $cols,
					'mobile'  => $cols,
				);
			}
		}

		if ( isset( $atts['captions'] ) ) {
			$settings_overlay['captions'] = 'true' === $atts['captions'];
		}

		if ( isset( $atts['lightbox'] ) ) {
			$settings_overlay['lightbox'] = 'true' === $atts['lightbox'];
		}

		$settings_overlay['_show_render_errors'] = current_user_can( 'edit_posts' );

		$context_builder = $is_preview ? Context_Builder::for_preview() : Context_Builder::for_public();
		if ( $is_preview ) {
			$render_context = $context_builder->build_for_preview(
				(int) $gallery_id,
				is_array( $settings ) ? $settings : array(),
				$settings_overlay,
				is_array( $item_ids ) ? array_map( 'absint', $item_ids ) : array(),
				array(),
				Request_Source::is_valid( $source ) ? $source : Request_Source::PREVIEW_UNSAVED,
				null
			);
		} else {
			$render_settings          = array_replace_recursive( is_array( $settings ) ? $settings : array(), $settings_overlay );
			$effective_meta_overrides = is_array( $meta_overrides ) ? $meta_overrides : array();
			// Promote the request-scoped view-page flag into the per-render
			// meta overrides so downstream features (Collection_Header) can
			// gate behaviour on it. Caller-supplied overrides win.
			if ( self::is_view_page_context() && ! array_key_exists( 'view_page', $effective_meta_overrides ) ) {
				$effective_meta_overrides['view_page'] = true;
			}
			$render_context = $context_builder->build_for_public(
				(int) $gallery_id,
				$render_settings,
				is_array( $item_ids ) ? array_map( 'absint', $item_ids ) : array(),
				Request_Source::is_valid( $source ) ? $source : Request_Source::SHORTCODE,
				absint( $atts['album_id'] ?? 0 ) ?: null,
				$effective_meta_overrides
			);
		}

		$render_result            = Render_Controller::factory()->render( $render_context );
		self::$last_render_meta   = $render_context->meta;
		self::$last_render_result = $render_result;

		// Direct page renders enqueue their per-render inline CSS/JS; REST/AJAX
		// and preview renders skip this (the emitter self-gates on the request
		// context) and expose the assets via last_render_result() instead.
		if ( ! $is_preview ) {
			Inline_Asset_Emitter::enqueue( $render_result );
		}

		return (string) $render_result->html;
	}

	/**
	 * Holds the Render_Meta of the most recent render_gallery_with_pipeline()
	 * call within this request. REST handlers read it to surface
	 * pagination metadata (snap-aware page size and total page count)
	 * that Context_Builder resolved during the render.
	 *
	 * @since 1.0.0
	 * @var \FotoGrids\Render\Api\Render_Meta|null
	 */
	private static ?\FotoGrids\Render\Api\Render_Meta $last_render_meta = null;

	/**
	 * Holds the full Render_Result of the most recent render in this request.
	 * REST/AJAX handlers read it to return the per-render inline CSS/JS/JSON-LD
	 * (which are no longer embedded in the markup) for the client to inject.
	 *
	 * @since 1.0.0
	 * @var Render_Result|null
	 */
	private static ?Render_Result $last_render_result = null;

	/**
	 * Returns the Render_Meta from the most recent gallery render in this
	 * request, or null when no render has run yet.
	 *
	 * @since  1.0.0
	 */
	public static function last_render_meta(): ?\FotoGrids\Render\Api\Render_Meta {
		return self::$last_render_meta;
	}

	/**
	 * Returns the full Render_Result from the most recent gallery render in this
	 * request, or null when no render has run yet.
	 *
	 * @since  1.0.0
	 */
	public static function last_render_result(): ?Render_Result {
		return self::$last_render_result;
	}

	/**
	 * REST entry point for rendering a gallery with pagination + partial
	 * options.
	 *
	 * Used by the /fotogrids/v1/gallery/render REST endpoint. Unlike the
	 * shortcode path, this bypasses caching (per-(gallery, page, breakpoint)
	 * cache keys are a v2 concern - see PLAN.md §8.5) and never re-enters
	 * the shortcode atts parser. Returns the raw rendered HTML - the REST
	 * handler still owns the CSS-handle map and the pagination metadata
	 * envelope.
	 *
	 * @since 1.0.0
	 * @param int                  $gallery_id     Gallery ID.
	 * @param array<string, mixed> $meta_overrides Optional Render_Meta overrides:
	 *                                             requested_page, requested_per_page,
	 *                                             breakpoint, partial.
	 * @param Request_Source       $source         Request source (defaults to ALBUM_AJAX
	 *                                             because the existing /gallery/render
	 *                                             callers use it that way; the REST handler
	 *                                             can override).
	 * @return string Rendered HTML (or empty string when the gallery cannot be rendered).
	 */
	public static function render_gallery_for_rest( int $gallery_id, array $meta_overrides = array(), string $source = Request_Source::ALBUM_AJAX ): string {
		$gallery = \FotoGrids\Galleries\Gallery_Repository::get( $gallery_id );
		if ( ! $gallery || 'publish' !== $gallery->post_status ) {
			return '';
		}

		$settings = self::get_gallery_settings( $gallery_id );
		$item_ids = \FotoGrids\Galleries\Gallery_Repository::get_item_ids( $gallery_id );
		if ( empty( $item_ids ) ) {
			return '';
		}

		// Synthetic atts mirroring what the shortcode produces - the
		// pipeline reads a small subset and the rest are inert.
		$atts = array(
			'id'       => $gallery_id,
			'album_id' => 0,
			'template' => '',
			'cols'     => 0,
			'captions' => 'true',
			'lightbox' => 'true',
		);

		return (string) self::render_gallery_with_pipeline(
			$gallery_id,
			$settings,
			$item_ids,
			$atts,
			$source,
			false,
			$meta_overrides
		);
	}

	/**
	 * Gallery shortcode handler
	 *
	 * @param array $atts Shortcode attributes
	 * @return string Rendered gallery HTML
	 */
	public static function gallery_shortcode( $atts ) {
		$atts = shortcode_atts(
			array(
				'id'                => 0,
				'template'          => '',
				'cols'              => 0,
				'lazy'              => 'true',
				'lightbox'          => 'true',
				'captions'          => 'true',
				'template_preview'  => 'false', // Template preview mode
				'template_settings' => '', // JSON-encoded template settings
				'template_items'    => '', // JSON-encoded template items
				'album_id'          => 0, // Album ID if gallery is accessed from album context
				'_source'           => '', // Internal source discriminator
			),
			$atts,
			'fotogrids_gallery'
		);

		// Template preview mode - use provided settings and items
		if ( 'true' === $atts['template_preview'] ) {
			$settings = array();
			if ( ! empty( $atts['template_settings'] ) ) {
				$decoded = json_decode( $atts['template_settings'], true );
				if ( is_array( $decoded ) ) {
					$defaults = \FotoGrids\Collection_Defaults::resolve_gallery();
					$settings = array_merge( $defaults, $decoded );
				}
			} else {
				$settings = \FotoGrids\Collection_Defaults::resolve_gallery();
			}

			$items = array();
			if ( ! empty( $atts['template_items'] ) ) {
				$decoded = json_decode( $atts['template_items'], true );
				if ( is_array( $decoded ) ) {
					$items = $decoded;
				}
			}

			return self::render_template_preview( $items, '', array(), array(), $settings, $atts );
		}

		$gallery_id = absint( $atts['id'] );
		if ( ! $gallery_id ) {
			return '<div class="fotogrids-error">FotoGrids: No gallery ID specified. Usage: [fotogrids_gallery id="1"]</div>';
		}

		$gallery = \FotoGrids\Galleries\Gallery_Repository::get( $gallery_id );
		if ( ! $gallery ) {
			return '<div class="fotogrids-error">FotoGrids: Gallery with ID ' . esc_html( (string) $gallery_id ) . ' not found.</div>';
		}

		if ( 'publish' !== $gallery->post_status ) {
			return '<div class="fotogrids-error">FotoGrids: Gallery with ID ' . esc_html( (string) $gallery_id ) . ' is not published (status: ' . esc_html( $gallery->post_status ) . ').</div>';
		}

		$settings = self::get_gallery_settings( $gallery_id );

		$item_ids = \FotoGrids\Galleries\Gallery_Repository::get_item_ids( $gallery_id );
		if ( empty( $item_ids ) ) {
			return '<div class="fotogrids-error">FotoGrids: Gallery with ID ' . esc_html( (string) $gallery_id ) . ' exists but has no items.</div>';
		}

		$source = Request_Source::SHORTCODE;
		if ( Request_Source::BLOCK === $atts['_source'] ) {
			$source = Request_Source::BLOCK;
		}
		if ( Request_Source::ELEMENTOR === $atts['_source'] ) {
			$source = Request_Source::ELEMENTOR;
		}
		if ( Request_Source::DIVI === $atts['_source'] ) {
			$source = Request_Source::DIVI;
		}
		if ( Request_Source::ALBUM_AJAX === $atts['_source'] ) {
			$source = Request_Source::ALBUM_AJAX;
		}
		if ( absint( $atts['album_id'] ) > 0 ) {
			$source = Request_Source::ALBUM_AJAX;
		}

		$cache_key = null;
		if ( \FotoGrids\FotoGrids_Cache::should_cache( $settings, $gallery_id ) ) {
			$cache_key = \FotoGrids\FotoGrids_Cache::make_key( $gallery_id, $settings, $item_ids, $atts );
			$cached    = \FotoGrids\FotoGrids_Cache::get( $gallery_id, $cache_key );
			if ( false !== $cached ) {
				self::replay_cached_assets( $cached['css'], $cached['js'] );
				do_action( Actions_Cache::HIT, $gallery_id, $cache_key );
				return $cached['html'];
			}
		}

		$html = self::render_gallery_with_pipeline( $gallery_id, $settings, $item_ids, $atts, $source, false );

		if ( null !== $cache_key ) {
			$duration = max( 1, absint( $settings['cache_duration'] ?? 24 ) );
			$resolver = \FotoGrids\Render\Internal\Asset_Resolver::instance();
			$css      = $resolver->get_css_asset_urls();
			$js       = $resolver->get_js_asset_data();
			\FotoGrids\FotoGrids_Cache::put( $gallery_id, $cache_key, $html, $css, $js, $duration );
			do_action( Actions_Cache::WRITTEN, $gallery_id, $cache_key );
		}

		return $html;
	}

	/**
	 * Album shortcode handler.
	 *
	 * Albums render through the same Render_Controller pipeline as
	 * galleries, with collection_kind = ALBUM. Each "item" in the render
	 * context is a child gallery summary (Album_Item_Loader). The same
	 * Grid / Justified / Masonry layouts and the visual decorators
	 * (Captions, Border, Shadow, Hover_Effects, Image_Filters) apply
	 * uniformly. Click behaviour is supplied by Album_To_View_Page or
	 * Album_To_Gallery_Ajax depending on the use_ajax_from_album setting.
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string Rendered album HTML.
	 */
	public static function album_shortcode( $atts ) {
		$atts = shortcode_atts(
			array(
				'id'       => 0,
				'template' => '',
			),
			$atts,
			'fotogrids_album'
		);

		$album_id = absint( $atts['id'] );
		if ( ! $album_id ) {
			return '';
		}

		$album = \FotoGrids\Albums\Album_Repository::get( $album_id );
		if ( ! $album || 'publish' !== $album->post_status ) {
			return '';
		}

		$child_galleries = Gallery_Album_Relations::get_galleries_for_album(
			$album_id,
			array(
				'orderby' => 'position',
				'order'   => 'ASC',
			)
		);

		if ( empty( $child_galleries ) ) {
			return '';
		}

		// Reduce to bare IDs in album-stored order.
		$child_gallery_ids = array_values(
			array_filter(
				array_map(
					static fn ( $gallery_post ) => (int) ( is_object( $gallery_post ) ? $gallery_post->ID : 0 ),
					$child_galleries
				)
			)
		);

		if ( empty( $child_gallery_ids ) ) {
			return '';
		}

		if ( ! class_exists( Context_Builder::class ) || ! class_exists( Render_Controller::class ) ) {
			return '';
		}

		$album_settings = \FotoGrids\Albums\Album_Repository::get_settings( $album_id );

		// Allow the shortcode's `template` attribute to override the
		// layout (e.g. [fotogrids_album id=42 template=masonry]).
		if ( ! empty( $atts['template'] ) && is_string( $atts['template'] ) ) {
			$album_settings['layout'] = $atts['template'];
		}

		$context = Context_Builder::for_public()->build_for_album(
			$album_id,
			$album_settings,
			$child_gallery_ids,
		);

		$result                   = Render_Controller::factory()->render( $context );
		self::$last_render_result = $result;
		Inline_Asset_Emitter::enqueue( $result );

		return $result->html;
	}

	/**
	 * Enqueue frontend scripts and styles.
	 *
	 * After the frontend refactor, almost everything reaches the page via
	 * the render pipeline (Asset_Resolver). The only assets enqueued here
	 * are:
	 *
	 *   • fg-tooltip JS/CSS - still globally enqueued because multiple
	 *     modules (sharing, filter UI, lightbox) bind tooltips and
	 *     fg-tooltip is not yet wrapped as a render module dependency.
	 *     Task 15 of the refactor will move this.
	 *   • fotogrids-errors.css - tiny always-on stylesheet for the
	 *     `.fotogrids-error` block. Lives outside the render pipeline
	 *     because error markup can be emitted before any layout module
	 *     runs (e.g. "gallery not found"), so collection-base.css is
	 *     never enqueued for those paths.
	 *
	 * The window.fotogrids localize payload is pre-registered against the
	 * `fotogrids-runtime` handle here, even though the runtime asset
	 * itself is enqueued by Asset_Resolver from Runtime_Bootstrap during
	 * the render. wp_register_script() at this stage means the localize
	 * data is associated with the handle so it prints when the script is
	 * enqueued later in wp_footer.
	 */
	public static function enqueue_frontend_scripts() {
		if ( ! self::has_fotogrids_content() ) {
			return;
		}

		// Pre-register the runtime handle so wp_localize_script can attach
		// its payload. Asset_Resolver will later call wp_register_script
		// for the same handle; WordPress treats a duplicate registration
		// as a no-op, so this is safe.
		wp_register_script(
			'fotogrids-runtime',
			FOTOGRIDS_PLUGIN_URL . 'assets/js/fotogrids-runtime.js',
			array(),
			FOTOGRIDS_VERSION,
			true
		);

		// fg-tooltip and deep-linking are NOT enqueued here anymore.
		// • fg-tooltip is declared as a dep by Sharing_Decorator and
		//   Lightbox features; Asset_Resolver pulls it in when either is
		//   active on the page.
		// • deep-linking is declared by Sharing_Decorator (task 16). On
		//   the View Page it's pulled in directly by Renderer::enqueue_assets
		//   because a ?fg-item URL can arrive even when sharing is off.

		wp_enqueue_style(
			'fotogrids-errors',
			FOTOGRIDS_PLUGIN_URL . 'public/assets/fotogrids-errors.css',
			array(),
			FOTOGRIDS_VERSION
		);

		$sharing = \FotoGrids\Settings\Sharing_Settings_Store::get();

		// window.fotogrids carries only the sharing-related deep-link
		// settings now. REST URLs and nonces are per-render: Stats and
		// Album_To_Gallery_Ajax write their own URL/nonce into per-element
		// data attributes. Lazy-load is gated by the per-gallery
		// data-fg-lazy attribute, not a global.
		wp_localize_script(
			'fotogrids-runtime',
			'fotogrids',
			array(
				'deep_linking_enabled'  => (bool) $sharing['deep_linking_enabled'],
				'embedded_share_target' => $sharing['embedded_share_target'],
			)
		);
	}

	/**
	 * Render gallery preview (for admin)
	 *
	 * Similar to gallery_shortcode but allows previewing unpublished galleries
	 *
	 * @param int $gallery_id Gallery ID
	 * @param array $atts Optional attributes to override settings
	 * @return string Rendered gallery HTML
	 */
	public static function render_gallery_preview( $gallery_id, $atts = array() ) {
		$gallery_id = absint( $gallery_id );
		if ( ! $gallery_id ) {
			return '<div class="fotogrids-error">FotoGrids: No gallery ID specified.</div>';
		}

		$gallery = get_post( $gallery_id );
		if ( ! $gallery || 'fotogrids_gallery' !== $gallery->post_type ) {
			return '<div class="fotogrids-error">FotoGrids: Gallery with ID ' . esc_html( (string) $gallery_id ) . ' not found.</div>';
		}

		$settings = self::get_gallery_settings( $gallery_id );

		$atts = shortcode_atts(
			array(
				'lazy'     => 'true',
				'lightbox' => 'true',
				'captions' => 'true',
			),
			$atts,
			'fotogrids_gallery'
		);

		$item_ids = \FotoGrids\Galleries\Gallery_Repository::get_item_ids( $gallery_id );
		if ( empty( $item_ids ) ) {
			return '<div class="fotogrids-error">FotoGrids: Gallery with ID ' . esc_html( (string) $gallery_id ) . ' exists but has no items.</div>';
		}

		return self::render_gallery_with_pipeline( $gallery_id, $settings, $item_ids, $atts, Request_Source::PREVIEW_SAVED, true );
	}

	/**
	 * Render template preview
	 *
	 * Public method to render a gallery preview with custom items and settings
	 * Used for template previews in admin
	 *
	 * @param array $items Gallery items
	 * @param string $layout Layout type
	 * @param array $columns Responsive columns
	 * @param array $spacing Responsive spacing
	 * @param array $settings Gallery settings
	 * @param array $atts Shortcode attributes
	 * @return string Rendered gallery HTML
	 */
	public static function render_template_preview( $items, $layout, $columns, $spacing, $settings, $atts = array() ) {
		if ( ! class_exists( Context_Builder::class ) || ! class_exists( Render_Controller::class ) ) {
			return '';
		}

		$atts = shortcode_atts(
			array(
				'template' => '',
				'cols'     => 0,
				'captions' => 'true',
				'lightbox' => 'true',
				'album_id' => 0,
			),
			$atts,
			'fotogrids_gallery'
		);

		$settings_overlay = array();
		if ( ! empty( $layout ) && is_string( $layout ) ) {
			$settings_overlay['layout'] = sanitize_text_field( $layout );
		} elseif ( ! empty( $atts['template'] ) && is_string( $atts['template'] ) ) {
			$settings_overlay['layout'] = sanitize_text_field( $atts['template'] );
		}
		if ( ! empty( $columns ) && is_array( $columns ) ) {
			$settings_overlay['columns'] = $columns;
		}
		if ( ! empty( $spacing ) && is_array( $spacing ) ) {
			$settings_overlay['item_spacing'] = $spacing;
		}
		if ( ! empty( $atts['cols'] ) ) {
			$col_count = absint( $atts['cols'] );
			if ( $col_count > 0 ) {
				$settings_overlay['columns'] = array(
					'desktop' => $col_count,
					'tablet'  => $col_count,
					'mobile'  => $col_count,
				);
			}
		}
		if ( isset( $atts['captions'] ) ) {
			$settings_overlay['captions'] = 'true' === $atts['captions'];
		}
		if ( isset( $atts['lightbox'] ) ) {
			$settings_overlay['lightbox'] = 'true' === $atts['lightbox'];
		}
		if ( isset( $atts['lazy'] ) ) {
			$settings_overlay['lazy_load'] = 'true' === $atts['lazy'];
		}
		$settings_overlay['_show_render_errors'] = current_user_can( 'edit_posts' );

		$render_settings = array_replace_recursive( is_array( $settings ) ? $settings : array(), $settings_overlay );
		$render_context  = Context_Builder::for_preview()->build_for_preview(
			0,
			$render_settings,
			array(),
			array(),
			array(),
			Request_Source::TEMPLATE_PREVIEW,
			null
		);

		$item_views = self::build_template_item_views( is_array( $items ) ? $items : array() );
		// Run demo items through the same caption resolver as real items so
		// caption_title / caption_description honour the template's caption
		// settings (source, hide, length) instead of staying blank.
		$item_views = Context_Builder::for_preview()->resolve_captions_for( $item_views, $render_settings );

		$render_context = $render_context->with(
			array(
				'items' => $item_views,
			)
		);

		$result = Render_Controller::factory()->render( $render_context );

		// Template previews render into a self-contained document (admin
		// picker iframe / REST preview) that has no wp_head/wp_footer to
		// enqueue into, so the per-render CSS/JS are embedded here - in the
		// document-assembly layer, not in the render pipeline - alongside the
		// pure markup the controller returns.
		$head = '' !== $result->inline_css
			? '<style class="fotogrids-inline-css">' . $result->inline_css . '</style>'
			: '';

		$foot = '';
		if ( '' !== $result->inline_js ) {
			$foot .= '<script>' . $result->inline_js . '</script>';
		}
		if ( '' !== $result->json_ld ) {
			$foot .= '<script type="application/ld+json">' . str_replace( '</', '<\/', $result->json_ld ) . '</script>';
		}

		return $head . $result->html . $foot;
	}

	/**
	 * Convert template preview payload to item value objects.
	 *
	 * @param array $items Template preview items.
	 * @return array
	 */
	private static function build_template_item_views( $items ) {
		$item_views = array();

		foreach ( $items as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}

			$width       = isset( $item['width'] ) && $item['width'] ? (int) $item['width'] : null;
			$height      = isset( $item['height'] ) && $item['height'] ? (int) $item['height'] : null;
			$full_width  = isset( $item['full_width'] ) && $item['full_width'] ? (int) $item['full_width'] : null;
			$full_height = isset( $item['full_height'] ) && $item['full_height'] ? (int) $item['full_height'] : null;

			// Demo preview items are not media-library attachments. Passing id 0
			// keeps the item renderer from resolving an attachment srcset off a
			// colliding ID, which would pull real gallery images into the preview.
			$item_view = new Item_View(
				0,
				(string) ( $item['medium'] ?? $item['thumb'] ?? $item['full'] ?? '' ),
				(string) ( $item['full'] ?? $item['medium'] ?? '' ),
				(string) ( $item['alt'] ?? '' ),
				(string) ( $item['title'] ?? '' ),
				(string) ( $item['caption'] ?? '' ),
				(string) ( $item['description'] ?? '' ),
				'',
				'',
				$width,
				$height,
				array()
			);

			$item_views[] = $item_view->with(
				array(
					'full_width'  => $full_width,
					'full_height' => $full_height,
				)
			);
		}

		return $item_views;
	}


	// render_album() removed - album rendering now goes through the
	// standard Render_Controller pipeline. See album_shortcode() above.

	/**
	 * Check if current page has FotoGrids content.
	 *
	 * Gates the pre-registration of `fotogrids-runtime` (so wp_localize_script
	 * can attach the `window.fotogrids` payload) and the always-on
	 * `fotogrids-errors.css` stylesheet. Per-render module CSS/JS is owned
	 * by Asset_Resolver and ships regardless of this gate.
	 *
	 * Page-builder integrations (Elementor, Divi, Bricks, …) store their
	 * widget trees outside `$post->post_content`, so the default
	 * shortcode + block detection cannot see them. They hook the
	 * {@see Filters_Page_Builders::HAS_CONTENT} filter to opt the page in.
	 *
	 * @since 1.0.0
	 * @return bool
	 */
	private static function has_fotogrids_content() {
		global $post;

		$detected = false;

		if ( $post ) {
			if ( has_shortcode( $post->post_content, 'fotogrids_gallery' ) ||
				has_shortcode( $post->post_content, 'fotogrids_album' ) ) {
				$detected = true;
			}
			// Block detection lives on the page-builders filter (see
			// PageBuilders\Builders\Gutenberg\Module::detect_in_gutenberg),
			// mirroring how Elementor / Divi / Bricks opt their pages
			// in. Every host stays self-contained and this method
			// doesn't grow per-builder branches.
		}

		return (bool) apply_filters( Filters_Page_Builders::HAS_CONTENT, $detected, $post );
	}
}
