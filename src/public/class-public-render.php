<?php
namespace FotoGrids;

use FotoGrids\Hooks\Actions_Cache;
use FotoGrids\Hooks\Filters_Page_Builders;
use FotoGrids\Hooks\Filters_Cache;
use FotoGrids\Render\Api\Font_Resolver;
use FotoGrids\Render\Api\Request_Source;
use FotoGrids\Render\Api\Item_View;
use FotoGrids\Render\Internal\Asset_Resolver;
use FotoGrids\Render\Internal\Context_Builder;
use FotoGrids\Render\Internal\Inline_Asset_Emitter;
use FotoGrids\Render\Internal\Instance_Id_Factory;
use FotoGrids\Render\Internal\Render_Controller;
use FotoGrids\Render\Internal\Render_Result;
use FotoGrids\Render\Sorters\Random\Random_Sorter;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Renders galleries and albums on the front end.
 */
class Public_Render {

	/**
	 * Whether gallery renders in this request get `view_page=true` in Render_Meta.
	 *
	 * @var bool
	 * @since 1.0.0
	 */
	private static bool $view_page_context = false;

	/**
	 * Sets the view-page context flag. Callers must reset it to false after rendering.
	 *
	 * @since 1.0.0
	 * @param bool $is_view_page
	 * @return void
	 */
	public static function set_view_page_context( bool $is_view_page ): void {
		self::$view_page_context = $is_view_page;
	}

	/**
	 * Returns the view-page context flag.
	 *
	 * @since 1.0.0
	 * @return bool
	 */
	public static function is_view_page_context(): bool {
		return self::$view_page_context;
	}

	/**
	 * Registers the shortcodes and front-end hooks.
	 */
	public static function init() {
		add_shortcode( 'fotogrids_gallery', array( __CLASS__, 'gallery_shortcode' ) );
		add_shortcode( 'fotogrids_album', array( __CLASS__, 'album_shortcode' ) );

		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_frontend_scripts' ) );

		if ( function_exists( 'wp_start_template_enhancement_output_buffer' ) ) {
			add_action( 'wp_before_include_template', array( __CLASS__, 'hold_template_output' ), 1001 );
		} else {
			add_filter( 'template_include', array( __CLASS__, 'hold_template_output_on_include' ), PHP_INT_MAX );
		}
	}

	/**
	 * Buffer the template output when WordPress does not, so headers set
	 * while a collection renders still reach the response.
	 *
	 * @since  1.2.0
	 * @return void
	 */
	public static function hold_template_output(): void {
		if ( did_action( 'wp_template_enhancement_output_buffer_started' ) ) {
			return;
		}

		ob_start();
	}

	/**
	 * template_include callback for WordPress before 6.9.
	 *
	 * @since  1.2.0
	 * @param  string $template Template path, passed through unchanged.
	 * @return string
	 */
	public static function hold_template_output_on_include( $template ) {
		self::hold_template_output();

		return $template;
	}

	/**
	 * Returns gallery settings merged with defaults.
	 *
	 * @param int $gallery_id Gallery ID
	 * @return array Gallery settings
	 */
	private static function get_gallery_settings( $gallery_id ) {
		return \FotoGrids\Galleries\Gallery_Repository::get_settings( (int) $gallery_id );
	}

	/**
	 * Opts the current page out of page caching when the
	 * fotogrids/cache/bypass_page_cache filter asks for it.
	 *
	 * @since  1.0.0
	 * @param  array $settings   Gallery settings.
	 * @param  int   $gallery_id Gallery ID.
	 * @return void
	 */
	private static function maybe_bypass_page_cache( array $settings, int $gallery_id ): void {
		$bypass = Random_Sorter::is_server_randomized( $settings );

		if ( ! apply_filters( Filters_Cache::BYPASS_PAGE_CACHE, $bypass, $settings, $gallery_id ) ) {
			return;
		}

		self::send_no_cache_headers();
	}

	/**
	 * Opts the current page out of host, page-builder and CDN caching.
	 *
	 * @since  1.3.0
	 * @return void
	 */
	private static function send_no_cache_headers(): void {
		if ( ! defined( 'DONOTCACHEPAGE' ) ) {
			define( 'DONOTCACHEPAGE', true ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- De-facto constant read by host and plugin page caches; the name is fixed, not plugin-owned.
		}

		if ( ! headers_sent() ) {
			header( 'Cache-Control: no-store, no-cache, must-revalidate, max-age=0' );
		}
	}

	/**
	 * Re-enqueues the CSS and JS assets stored with a cache entry.
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
	 * Re-emits the inline CSS, inline JS and JSON-LD stored with a cache entry.
	 *
	 * @since  1.0.0
	 * @param  array{inline_css: string, inline_js: string, json_ld: string} $cached Decoded cache entry.
	 * @return void
	 */
	private static function replay_cached_inline_assets( array $cached ): void {
		Inline_Asset_Emitter::enqueue(
			new Render_Result(
				'',
				'',
				array(),
				200,
				(string) ( $cached['inline_css'] ?? '' ),
				(string) ( $cached['inline_js'] ?? '' ),
				(string) ( $cached['json_ld'] ?? '' )
			)
		);
	}

	/**
	 * Renders one gallery through the render controller pipeline.
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

		// Preview renders expose inline assets via last_render_result() instead.
		if ( ! $is_preview ) {
			Inline_Asset_Emitter::enqueue( $render_result );
		}

		return (string) $render_result->html;
	}

	/**
	 * Render_Meta of the most recent gallery render in this request.
	 *
	 * @since 1.0.0
	 * @var \FotoGrids\Render\Api\Render_Meta|null
	 */
	private static ?\FotoGrids\Render\Api\Render_Meta $last_render_meta = null;

	/**
	 * Render_Result of the most recent render in this request.
	 *
	 * @since 1.0.0
	 * @var Render_Result|null
	 */
	private static ?Render_Result $last_render_result = null;

	/**
	 * Returns the Render_Meta of the most recent gallery render, or null.
	 *
	 * @since  1.0.0
	 */
	public static function last_render_meta(): ?\FotoGrids\Render\Api\Render_Meta {
		return self::$last_render_meta;
	}

	/**
	 * Returns the Render_Result of the most recent render, or null.
	 *
	 * @since  1.0.0
	 */
	public static function last_render_result(): ?Render_Result {
		return self::$last_render_result;
	}

	/**
	 * Renders a published gallery for the /fotogrids/v1/gallery/render endpoint.
	 *
	 * Bypasses the render cache.
	 *
	 * @since 1.0.0
	 * @param int                            $gallery_id     Gallery ID.
	 * @param array<string, mixed>           $meta_overrides Optional Render_Meta overrides:
	 *                                                       requested_page, requested_per_page,
	 *                                                       breakpoint, partial.
	 * @param value-of<Request_Source::ALL>  $source         Request source.
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

		$atts = array(
			'id'       => $gallery_id,
			'album_id' => 0,
			'template' => '',
			'cols'     => 0,
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
	 * Handles the [fotogrids_gallery] shortcode.
	 *
	 * @param array $atts Shortcode attributes
	 * @return string Rendered gallery HTML
	 */
	public static function gallery_shortcode( $atts ) {
		return self::render_gallery_embed( $atts );
	}

	/**
	 * Renders one gallery embed from shortcode attributes.
	 *
	 * @since 1.3.0
	 * @param array|string $atts        Shortcode attributes.
	 * @param string       $instance_id Instance ID to render with. Empty takes the next one.
	 * @return string Rendered gallery HTML
	 */
	public static function render_gallery_embed( $atts, string $instance_id = '' ) {
		$atts = shortcode_atts(
			array(
				'id'                => 0,
				'template'          => '',
				'cols'              => 0,
				'template_preview'  => 'false',
				'template_settings' => '', // JSON.
				'template_items'    => '', // JSON.
				'album_id'          => 0,
				'_source'           => '', // Internal Request_Source value.
			),
			$atts,
			'fotogrids_gallery'
		);

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
			return self::error_notice( __( 'No gallery ID specified. Usage: [fotogrids_gallery id="1"]', 'fotogrids' ) );
		}

		$gallery = \FotoGrids\Galleries\Gallery_Repository::get( $gallery_id );
		if ( ! $gallery ) {
			return self::error_notice(
				sprintf(
					/* translators: %d: gallery ID. */
					__( 'Gallery with ID %d not found.', 'fotogrids' ),
					$gallery_id
				)
			);
		}

		$readable = 'publish' === $gallery->post_status
			|| ( 'private' === $gallery->post_status && current_user_can( 'read_post', $gallery_id ) );
		if ( ! $readable ) {
			return self::error_notice(
				sprintf(
					/* translators: 1: gallery ID, 2: post status. */
					__( 'Gallery with ID %1$d is not published (status: %2$s).', 'fotogrids' ),
					$gallery_id,
					$gallery->post_status
				)
			);
		}

		$settings = self::get_gallery_settings( $gallery_id );

		$item_ids = \FotoGrids\Galleries\Gallery_Repository::get_item_ids( $gallery_id );
		if ( empty( $item_ids ) ) {
			return self::error_notice(
				sprintf(
					/* translators: %d: gallery ID. */
					__( 'Gallery with ID %d exists but has no items.', 'fotogrids' ),
					$gallery_id
				)
			);
		}

		self::maybe_bypass_page_cache( $settings, $gallery_id );

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
		if ( Request_Source::BRICKS === $atts['_source'] ) {
			$source = Request_Source::BRICKS;
		}
		if ( Request_Source::BEAVER_BUILDER === $atts['_source'] ) {
			$source = Request_Source::BEAVER_BUILDER;
		}
		if ( Request_Source::ALBUM_AJAX === $atts['_source'] ) {
			$source = Request_Source::ALBUM_AJAX;
		}
		if ( absint( $atts['album_id'] ) > 0 ) {
			$source = Request_Source::ALBUM_AJAX;
		}

		if ( ! Instance_Id_Factory::matches( $gallery_id, $instance_id ) ) {
			$instance_id = Instance_Id_Factory::instance()->generate( $gallery_id );
		}

		$cache_key = null;
		if ( \FotoGrids\FotoGrids_Cache::should_cache( $settings, $gallery_id ) ) {
			$cache_key = \FotoGrids\FotoGrids_Cache::make_key( $gallery_id, $settings, $item_ids, $atts, $instance_id );
			$cached    = \FotoGrids\FotoGrids_Cache::get( $gallery_id, $cache_key );
			if ( false !== $cached ) {
				// Order matters: replay_cached_assets() registers
				// fotogrids-runtime, which the inline JS attaches to.
				self::replay_cached_assets( $cached['css'], $cached['js'] );
				self::replay_cached_inline_assets( $cached );
				Font_Resolver::instance()->collect_families( $cached['fonts'] );
				do_action( Actions_Cache::HIT, $gallery_id, $cache_key );
				return wp_kses( $cached['html'], \FotoGrids\Kses::rules( $cached['html'] ) );
			}
		}

		Font_Resolver::instance()->begin_capture();
		$html  = self::render_gallery_with_pipeline( $gallery_id, $settings, $item_ids, $atts, $source, false, array( 'instance_id' => $instance_id ) );
		$fonts = Font_Resolver::instance()->end_capture();

		if ( null !== $cache_key ) {
			$duration = max( 1, absint( $settings['cache_duration'] ?? 24 ) );
			$resolver = \FotoGrids\Render\Internal\Asset_Resolver::instance();
			$css      = $resolver->get_css_asset_urls();
			$js       = $resolver->get_js_asset_data();
			$rendered = self::$last_render_result;
			\FotoGrids\FotoGrids_Cache::put(
				$gallery_id,
				$cache_key,
				$html,
				$css,
				$js,
				null !== $rendered ? $rendered->inline_css : '',
				null !== $rendered ? $rendered->inline_js : '',
				null !== $rendered ? $rendered->json_ld : '',
				$duration,
				$fonts
			);
			do_action( Actions_Cache::WRITTEN, $gallery_id, $cache_key );
		}

		return wp_kses( $html, \FotoGrids\Kses::rules( $html ) );
	}

	/**
	 * Handles the [fotogrids_album] shortcode.
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string Rendered album HTML.
	 */
	public static function album_shortcode( $atts ) {
		return self::render_album_embed( $atts );
	}

	/**
	 * Renders one album embed from shortcode attributes.
	 *
	 * @since 1.3.0
	 * @param array|string $atts        Shortcode attributes.
	 * @param string       $instance_id Instance ID to render with. Empty takes the next one.
	 * @return string Rendered album HTML.
	 */
	public static function render_album_embed( $atts, string $instance_id = '' ) {
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
		if ( ! $album || ( 'publish' !== $album->post_status && ! current_user_can( 'read_post', $album_id ) ) ) {
			return '';
		}

		$child_galleries = Gallery_Album_Relations::get_visible_galleries_for_album(
			$album_id,
			array(
				'orderby' => 'position',
				'order'   => 'ASC',
			)
		);

		if ( empty( $child_galleries ) ) {
			return '';
		}

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

		if ( ! in_array( $album->post_status, array( 'publish', 'private' ), true ) ) {
			$album_settings['enable_statistics'] = false;
		}

		if ( ! empty( $atts['template'] ) && is_string( $atts['template'] ) ) {
			$album_settings['layout'] = $atts['template'];
		}

		if ( ! Instance_Id_Factory::matches( $album_id, $instance_id ) ) {
			$instance_id = '';
		}

		$context = Context_Builder::for_public()->build_for_album(
			$album_id,
			$album_settings,
			$child_gallery_ids,
			Request_Source::SHORTCODE,
			$instance_id
		);

		if ( Render_Controller::has_active_gates( $context ) ) {
			self::send_no_cache_headers();
		}

		$result                   = Render_Controller::factory()->render( $context );
		self::$last_render_result = $result;
		Inline_Asset_Emitter::enqueue( $result );

		return wp_kses( $result->html, \FotoGrids\Kses::rules( $result->html ) );
	}

	/**
	 * Localizes the runtime and enqueues the error stylesheet on pages with FotoGrids content.
	 *
	 * Gallery assets are enqueued by the render pipeline, not here. Error blocks
	 * rendered outside the post content enqueue the stylesheet themselves.
	 */
	public static function enqueue_frontend_scripts() {
		\FotoGrids\Render\Internal\Runtime\Runtime_Bootstrap::localize();

		if ( ! self::has_fotogrids_content() ) {
			return;
		}

		wp_enqueue_style(
			'fotogrids-errors',
			FOTOGRIDS_PLUGIN_URL . 'public/assets/fotogrids-errors.css',
			array(),
			FOTOGRIDS_VERSION
		);
	}

	/**
	 * Returns the error block for a gallery that cannot be rendered.
	 *
	 * Only users who can edit posts see the message; others get a hidden block.
	 * A visible block enqueues its stylesheet, so it is styled wherever the
	 * shortcode runs: post content, template parts or widgets.
	 *
	 * @since 1.3.0
	 * @param string $message Translated message.
	 * @return string
	 */
	private static function error_notice( string $message ): string {
		if ( ! current_user_can( 'edit_posts' ) ) {
			return '<div class="fotogrids-error" hidden></div>';
		}

		$resolver = Asset_Resolver::instance();
		$resolver->collect( Render_Result::error_assets(), 'fotogrids' );
		$resolver->flush();

		return '<div class="fotogrids-error">FotoGrids: ' . esc_html( $message ) . '</div>';
	}

	/**
	 * Renders an admin preview of a gallery in any post status.
	 *
	 * @param int $gallery_id Gallery ID
	 * @param array $atts Optional attributes to override settings
	 * @return string Rendered gallery HTML
	 */
	public static function render_gallery_preview( $gallery_id, $atts = array() ) {
		$gallery_id = absint( $gallery_id );
		if ( ! $gallery_id ) {
			return self::error_notice( __( 'No gallery ID specified.', 'fotogrids' ) );
		}

		$gallery = get_post( $gallery_id );
		if ( ! $gallery || Post_Types::GALLERY !== $gallery->post_type ) {
			return self::error_notice(
				sprintf(
					/* translators: %d: gallery ID. */
					__( 'Gallery with ID %d not found.', 'fotogrids' ),
					$gallery_id
				)
			);
		}

		$settings = self::get_gallery_settings( $gallery_id );

		$item_ids = \FotoGrids\Galleries\Gallery_Repository::get_item_ids( $gallery_id );
		if ( empty( $item_ids ) ) {
			return self::error_notice(
				sprintf(
					/* translators: %d: gallery ID. */
					__( 'Gallery with ID %d exists but has no items.', 'fotogrids' ),
					$gallery_id
				)
			);
		}

		return self::render_gallery_with_pipeline( $gallery_id, $settings, $item_ids, $atts, Request_Source::PREVIEW_SAVED, true );
	}

	/**
	 * Renders a template preview from supplied items and settings.
	 *
	 * Returns a self-contained fragment with inline CSS, JS and JSON-LD embedded.
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
		// Demo items carry no resolved captions until this runs.
		$item_views = Context_Builder::for_preview()->resolve_captions_for( $item_views, $render_settings );

		$render_context = $render_context->with(
			array(
				'items' => $item_views,
			)
		);

		$result = Render_Controller::factory()->render( $render_context );

		// The preview document has no wp_head/wp_footer, so inline assets are embedded.
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
	 * Converts template preview items to Item_View objects.
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

			// ID 0: demo items are not attachments, so no srcset is resolved from a colliding ID.
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

	/**
	 * Checks whether the current page has FotoGrids content.
	 *
	 * Detects shortcodes only; blocks and page builders opt in through
	 * {@see Filters_Page_Builders::HAS_CONTENT}.
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
		}

		return (bool) apply_filters( Filters_Page_Builders::HAS_CONTENT, $detected, $post );
	}
}
