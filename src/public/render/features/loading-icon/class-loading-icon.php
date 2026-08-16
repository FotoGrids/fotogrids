<?php
declare(strict_types=1);

namespace FotoGrids\Render\Features\Loading_Icon;

use FotoGrids\Hooks\Actions_Render;
use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Feature;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Loading Icon feature module.
 *
 * Responsible for:
 *
 * 1. Emitting window.fotogridsLoadingIcon = { name, svg, animate } as a
 *    plain inline <script> in the page body, immediately after the first
 *    gallery wrapper (via html_after). This runs synchronously as the
 *    browser parses the page - before any images finish loading from cache
 *    and before DOMContentLoaded - so the global is always available when
 *    the per-gallery animate calls immediately follow in the same script.
 *
 *    `animate` is a raw WAAPI function (pre-built from loading-icons-waapi.json
 *    at build time). It accepts an SVG element and returns an array of
 *    Animation / rAF-cancel handles.
 *
 *    The same global is also registered via wp_add_inline_script (footer)
 *    for JS-built surfaces that need it after the page load - lightbox
 *    spinner, AJAX-loaded album items.
 *
 * 2. Writing data-fg-loading-icon="{icon_name}" on the gallery wrapper so
 *    JS can read which icon is active if needed.
 *
 * 3. Providing the --fg-loader-color CSS variable so gallery owners can tint
 *    the spinner via settings.
 *
 * 4. Starting WAAPI animations on all loader SVGs inside each gallery via
 *    an inline <script> in html_after, scoped to that gallery's instance ID.
 *    loading-icon.js (footer) handles state: it cancels animations and sets
 *    data-fg-media-state="loaded" when images settle.
 *
 * __FG_ID__ placeholder
 * ----------------------
 * The icon SVGs use __FG_ID__ as a placeholder for unique ID suffixes so
 * gradient / clipPath IDs don't collide across items. Item_Renderer replaces
 * it per item; the global svg template leaves it raw so JS can replace it
 * when injecting dynamically (lightbox spinner, AJAX items).
 *
 * @package FotoGrids\Render\Features\Loading_Icon
 * @since   1.0.0
 */
final class Loading_Icon implements Feature {

	/**
	 * Default icon name when no setting is configured.
	 *
	 * @since 1.0.0
	 */
	private const DEFAULT_ICON = '12-dots';

	/**
	 * Icon names whose animate-fn has already been published to the page map.
	 *
	 * @since 1.0.0
	 * @var array<string, true>
	 */
	private static array $published_icons = array();

	/**
	 * Monotonic counter guaranteeing a unique inline-script handle per icon.
	 *
	 * @since 1.0.0
	 * @var int
	 */
	private static int $map_seq = 0;

	/**
	 * Whether a single-icon window.fotogridsLoadingIcon has been published yet.
	 *
	 * @since 1.0.0
	 * @var bool
	 */
	private static bool $default_published = false;

	public function id(): string {
		return 'fotogrids/loading-icon';
	}

	public function origin(): string {
		return 'fotogrids';
	}

	public function replaces(): ?string {
		return null;
	}

	public function extends_id(): ?string {
		return null;
	}

	/**
	 * Always active - every gallery shows a loader while images are fetched.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  bool
	 */
	public function supports( Render_Context $render_context ): bool {
		return true;
	}

	/**
	 * No markup before the layout content.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  string
	 */
	public function html_before( Render_Context $render_context ): string {
		return '';
	}

	/**
	 * No extra markup appended inside the gallery wrapper.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  string
	 */
	public function html_appendix( Render_Context $render_context ): string {
		return '';
	}

	/**
	 * No markup appended after the gallery wrapper.
	 *
	 * The loader animations were previously started by an inline <script>
	 * emitted here. That script was removed so the gallery markup can pass
	 * through wp_kses(); loading-icon.js now starts the animations per gallery
	 * from the runtime's onGallery hook, using the icon map published by
	 * publish_icon_map() during assets().
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  string
	 */
	public function html_after( Render_Context $render_context ): string {
		return '';
	}

	/**
	 * Writes data-fg-loading-icon onto the gallery wrapper.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  array<string, string>
	 */
	public function wrapper_data_attrs( Render_Context $render_context ): array {
		return array(
			'data-fg-loading-icon' => $this->resolve_icon_name( $render_context ),
		);
	}

	/**
	 * Provides --fg-loader-color from the loading_icon_color setting.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  array<string, string>
	 */
	public function style_vars( Render_Context $render_context ): array {
		$color = $render_context->settings['loading_icon_color'] ?? '';

		if ( ! is_string( $color ) || '' === $color ) {
			return array();
		}

		return array(
			'--fg-loader-color' => $color,
		);
	}

	/**
	 * Declares the loading-icon JS and CSS assets and schedules the footer
	 * global for JS-built surfaces (lightbox spinner, AJAX album items).
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  Module_Assets
	 */
	public function assets( Render_Context $render_context ): Module_Assets {
		// Publish this gallery's icon into the page-level map. Done here (during
		// render, before Asset_Resolver force-prints loading-icon.js) so the map
		// reaches the page ahead of the script that reads it.
		$this->publish_icon_map( $this->resolve_icon_name( $render_context ) );

		return new Module_Assets(
			array(
				'fotogrids-loading-icon' => new Asset_Decl(
					'../../assets/css/loading-icon-styles.css',
					array(),
					false,
				),
			),
			array(
				'fotogrids-loading-icon' => new Asset_Decl(
					'../../assets/js/loading-icon.js',
					array( 'fotogrids-runtime' ),
					true,
				),
			)
		);
	}

	/**
	 * Resolves the icon name from settings, falling back to the default.
	 *
	 * @since   1.0.0
	 * @param   Render_Context $render_context Render context.
	 * @return  string
	 */
	private function resolve_icon_name( Render_Context $render_context ): string {
		$icon = $render_context->settings['loading_icon'] ?? '';
		return ( is_string( $icon ) && '' !== $icon ) ? $icon : self::DEFAULT_ICON;
	}

	/**
	 * Builds the JS object literal for one icon: its svg template and pre-built
	 * WAAPI animate function, e.g. `{svg:"...",animate:function animate(svg){...}}`.
	 *
	 * @since   1.0.0
	 * @param   string $icon_name Icon name.
	 * @return  string Raw JS object literal (no <script> tags).
	 */
	private static function build_icon_entry_js( string $icon_name ): string {
		$svg        = \FotoGrids\Assets\Loading_Icon_Library::svg( $icon_name, '' );
		$animate_fn = \FotoGrids\Assets\Loading_Icon_Library::animate_fn( $icon_name );
		if ( '' === $animate_fn ) {
			$animate_fn = 'function animate(){return [];}';
		}

		return sprintf(
			'{svg:%s,animate:%s}',
			wp_json_encode( $svg ),
			$animate_fn
		);
	}

	/**
	 * Publishes one gallery's loading icon into the page-level icon map.
	 *
	 * The map (window.fotogridsLoadingIcons) carries the icon svg + its WAAPI
	 * animate function, which loading-icon.js reads to start the loader
	 * animations. It cannot ride inside the gallery markup: the animate
	 * functions contain &&, <, > that the_content filters (wptexturize etc.)
	 * would mangle, and the markup is destined for wp_kses(). It also cannot be
	 * attached to loading-icon.js as a 'before' inline, because Asset_Resolver
	 * force-prints that handle mid-content and a later inline addition is lost.
	 *
	 * So each distinct icon is emitted through its own src-less script handle,
	 * force-printed immediately when the document head has already rendered
	 * (the normal shortcode-in-the_content case) - the same pattern
	 * Inline_Asset_Emitter uses for per-render CSS. The assignment is additive
	 * (Object.assign) so multiple galleries with different icons each contribute
	 * without clobbering. A unique handle per icon keeps each independently
	 * printable. When the head has not rendered yet (REST preview / very early
	 * render) the handle is enqueued and flushed on wp_footer + late_assets.
	 *
	 * @since   1.0.0
	 * @param   string $icon_name Icon name for the gallery being rendered.
	 * @return  void
	 */
	private function publish_icon_map( string $icon_name ): void {
		if ( isset( self::$published_icons[ $icon_name ] ) ) {
			return;
		}
		self::$published_icons[ $icon_name ] = true;

		$entry = self::build_icon_entry_js( $icon_name );
		$js    = 'window.fotogridsLoadingIcons=Object.assign(window.fotogridsLoadingIcons||{},{'
			. wp_json_encode( $icon_name ) . ':' . $entry . '});';

		// Keep the single-icon window.fotogridsLoadingIcon (first icon seen) for
		// lightbox.js and other callers that use that shorthand.
		if ( ! self::$default_published ) {
			self::$default_published = true;
			$js                     .= 'window.fotogridsLoadingIcon=Object.assign({name:'
				. wp_json_encode( $icon_name ) . '},' . $entry . ');';
		}

		$handle = 'fotogrids-loading-icons-' . (string) ++self::$map_seq;
		wp_register_script( $handle, false, array(), FOTOGRIDS_VERSION, false );
		wp_enqueue_script( $handle );
		wp_add_inline_script( $handle, $js );

		if ( did_action( 'wp_head' ) > 0 || did_action( 'admin_head' ) > 0 ) {
			wp_print_scripts( $handle );
			return;
		}

		// Head not rendered yet (REST preview / very early render): flush on
		// wp_footer and on the preview endpoint's late_assets action.
		$flush = static function () use ( $handle ): void {
			wp_print_scripts( $handle );
		};
		add_action( 'wp_footer', $flush, 10 );
		add_action( Actions_Render::LATE_ASSETS, $flush, 10 );
	}

	/**
	 * Resets per-request static state for tests.
	 *
	 * @since   1.0.0
	 * @return  void
	 */
	public static function reset_for_tests(): void {
		self::$published_icons   = array();
		self::$map_seq           = 0;
		self::$default_published = false;
	}
}
