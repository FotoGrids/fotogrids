<?php
/**
 * Elementor builder sub-module.
 *
 * @package FotoGrids\Modules\PageBuilders\Builders\Elementor
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Modules\PageBuilders\Builders\Elementor;

use FotoGrids\Hooks\Filters_Page_Builders;
use FotoGrids\Hooks\Filters_Render;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Request_Source;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Elementor sub-module of Page Builders.
 *
 * Registers FotoGrids Elementor widgets (gallery + album). v1 ships a minimal
 * widget per collection type: a single picker control that selects a
 * published gallery/album by ID, with the actual render delegated to the
 * existing shortcode pipeline (Public_Render::gallery_shortcode /
 * album_shortcode). This keeps the render path identical to Gutenberg and
 * the [fotogrids_*] shortcodes, so every decorator/feature/layout module
 * works automatically inside Elementor.
 *
 * Activation gates on whether Elementor is loaded. The sub-module is safe
 * to require unconditionally - init() exits early if Elementor isn't present.
 *
 * This sub-module does not register itself with `Module_Registry`. The
 * parent PageBuilders module owns the registry slot and dispatches `init()`
 * to each builder.
 *
 * @since 1.0.0
 */
final class Module {

	/**
	 * Elementor widget category slug. All FotoGrids Elementor widgets land
	 * in this category in the editor panel.
	 *
	 * @var string
	 */
	public const CATEGORY = 'fotogrids';

	/**
	 * Script handle for the Elementor editor bundle (control views,
	 * Select2 wiring, React PickerModal mount).
	 *
	 * @var string
	 */
	public const EDITOR_SCRIPT_HANDLE = 'fotogrids-pb-elementor-editor';

	/**
	 * Style handle for the editor bundle's SCSS output.
	 *
	 * @var string
	 */
	public const EDITOR_STYLE_HANDLE = 'fotogrids-pb-elementor-editor';

	/**
	 * Whether the Elementor plugin is present and loaded. We check for the
	 * `\Elementor\Plugin` class rather than `did_action( 'elementor/loaded' )`
	 * because our init runs from inside Module_Registry's `init:5` dispatch,
	 * which is earlier than `elementor/loaded`. The class is defined the
	 * moment Elementor's own plugin file is required, which happens at
	 * `plugins_loaded`, so the class-exists check is reliable here.
	 *
	 * @since 1.0.0
	 * @return bool
	 */
	public static function is_active(): bool {
		return did_action( 'elementor/loaded' ) > 0
			|| class_exists( '\Elementor\Plugin' );
	}

	/**
	 * Boot the Elementor sub-module.
	 *
	 * Registration happens on Elementor's own hooks:
	 *   - `elementor/elements/categories_registered` adds the FotoGrids panel
	 *     category before any widgets attempt to use it.
	 *   - `elementor/widgets/register` is where widget classes are
	 *     instantiated and handed to Elementor's widgets manager.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function init(): void {
		if ( ! self::is_active() ) {
			return;
		}

		add_action( 'elementor/elements/categories_registered', array( self::class, 'register_category' ) );
		add_action( 'elementor/widgets/register', array( self::class, 'register_widgets' ) );

		// Register the custom Marionette control views (rich Select2 +
		// Browse-all modal trigger) - fires inside the editor only.
		add_action( 'elementor/controls/register', array( self::class, 'register_controls' ) );

		// Enqueue the editor bundle whenever Elementor's editor chrome
		// loads. The bundle defines the Marionette views referenced by
		// the control types above.
		add_action( 'elementor/editor/before_enqueue_scripts', array( self::class, 'enqueue_editor_assets' ) );

		// Opt every Elementor-built page that contains a FotoGrids widget
		// into the page-global asset bootstrap (runtime localize +
		// errors stylesheet). Without this hook Public_Render's
		// `has_fotogrids_content()` would miss us - Elementor stores its
		// widget tree in post meta, not post_content.
		add_filter( Filters_Page_Builders::HAS_CONTENT, array( self::class, 'detect_in_elementor' ), 10, 2 );

		// Suppress Elementor's global lightbox over FotoGrids anchors.
		// Elementor scans every `<a>` whose href looks like an image and
		// hijacks the click - we need to stamp `data-elementor-open-lightbox="no"`
		// on the anchor itself (ancestor opt-out doesn't cascade into
		// arbitrary widget HTML). The renderer doesn't know about
		// Elementor; this filter is the decoupling point.
		add_filter( Filters_Render::ANCHOR_ATTRS, array( self::class, 'disable_elementor_lightbox' ), 10, 2 );

		// Inside Elementor's preview iframe neither `wp_head` nor
		// `wp_footer` fire in the normal way - Elementor's preview pipeline
		// owns the chrome. Force the renderer to emit its CSS+JS inline
		// immediately so widget HTML and its assets reach the iframe
		// together. The renderer doesn't know about Elementor; it just
		// asks "should I inline?" and our hook answers.
		add_filter( Filters_Render::SHOULD_INLINE_ASSETS, array( self::class, 'inline_assets_in_preview' ) );
	}

	/**
	 * Filter callback: detect FotoGrids widgets in Elementor's
	 * serialized widget tree.
	 *
	 * Elementor stores its layout as JSON in the `_elementor_data` post
	 * meta. We do a cheap substring scan for the widget names rather
	 * than json_decode-ing the whole tree on every front-end request.
	 *
	 * @since 1.0.0
	 * @param bool         $detected Previous detection result.
	 * @param \WP_Post|null $post    Current post (may be null on
	 *                               theme-builder parts).
	 * @return bool
	 */
	public static function detect_in_elementor( bool $detected, $post ): bool {
		if ( $detected ) {
			return true;
		}

		if ( ! $post instanceof \WP_Post ) {
			return false;
		}

		$data = get_post_meta( $post->ID, '_elementor_data', true );
		if ( ! is_string( $data ) || '' === $data ) {
			return false;
		}

		return strpos( $data, '"fotogrids-gallery"' ) !== false
			|| strpos( $data, '"fotogrids-album"' ) !== false;
	}

	/**
	 * Add the FotoGrids category to Elementor's panel.
	 *
	 * @since 1.0.0
	 * @param \Elementor\Elements_Manager $elements_manager
	 * @return void
	 */
	public static function register_category( $elements_manager ): void {
		$elements_manager->add_category(
			self::CATEGORY,
			array(
				'title' => __( 'FotoGrids', 'fotogrids' ),
				'icon'  => 'eicon-gallery-grid',
			)
		);
	}

	/**
	 * Register each FotoGrids widget with Elementor.
	 *
	 * @since 1.0.0
	 * @param \Elementor\Widgets_Manager $widgets_manager
	 * @return void
	 */
	public static function register_widgets( $widgets_manager ): void {
		require_once __DIR__ . '/widgets/class-widget-gallery.php';
		require_once __DIR__ . '/widgets/class-widget-album.php';

		$widgets_manager->register( new Widgets\Widget_Gallery() );
		$widgets_manager->register( new Widgets\Widget_Album() );
	}

	/**
	 * Register the FotoGrids gallery + album picker control types.
	 *
	 * @since 1.0.0
	 * @param \Elementor\Controls_Manager $controls_manager
	 * @return void
	 */
	public static function register_controls( $controls_manager ): void {
		require_once __DIR__ . '/controls/class-base-collection-picker.php';
		require_once __DIR__ . '/controls/class-gallery-picker.php';
		require_once __DIR__ . '/controls/class-album-picker.php';

		$controls_manager->register( new Controls\Gallery_Picker() );
		$controls_manager->register( new Controls\Album_Picker() );
	}

	/**
	 * Enqueue the editor bundle on Elementor editor screens.
	 *
	 * The bundle registers Marionette control views for the two
	 * picker types and ships the React PickerModal it mounts when
	 * "Browse all" is clicked. CSS lives alongside the JS in the same
	 * webpack entry (`editor.jsx` imports `./editor.scss`), and is
	 * emitted next to the JS by MiniCssExtractPlugin.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function enqueue_editor_assets(): void {
		$base_url = FOTOGRIDS_PLUGIN_URL . 'includes/modules/PageBuilders/builders/Elementor/assets/';

		wp_enqueue_script(
			self::EDITOR_SCRIPT_HANDLE,
			$base_url . 'editor.js',
			array(
				'jquery',
				'elementor-editor',
				'wp-element',
				'wp-components',
				'wp-i18n',
				// `window.FotoGridsIcons` payload - see the Gutenberg
				// sub-module for the full rationale; Button uses the
				// shared <Icon /> component which reads from this
				// global.
				\FotoGrids\Modules\PageBuilders\Module::FG_ICONS_SCRIPT_HANDLE,
			),
			FOTOGRIDS_VERSION,
			true
		);

		wp_enqueue_style(
			self::EDITOR_STYLE_HANDLE,
			$base_url . 'editor.css',
			array(
				'elementor-editor',
				'wp-components',
				// Aggregated shared-component stylesheet - Modal,
				// Button, Checkbox, FormField, Icon. Registered once
				// by the parent PageBuilders module so the same CSS
				// ships to the Gutenberg block editor too.
				\FotoGrids\Modules\PageBuilders\Module::FG_SHARED_STYLE_HANDLE,
			),
			FOTOGRIDS_VERSION
		);

		wp_localize_script(
			self::EDITOR_SCRIPT_HANDLE,
			'fotogridsPbElementor',
			self::build_localize_payload()
		);
	}

	/**
	 * Build the `window.fotogridsPbElementor` localize payload.
	 *
	 * Mirrors the Gutenberg sub-module's payload shape so the shared
	 * PickerModal component works identically across hosts. Adds
	 * gallery/album edit base URLs so the inline "Edit" link in the
	 * control can build a deep link to the right post editor.
	 *
	 * @since 1.0.0
	 * @return array<string, mixed>
	 */
	private static function build_localize_payload(): array {
		return array(
			'restUrl'          => esc_url_raw( rest_url( 'fotogrids/v1/' ) ),
			'restNonce'        => wp_create_nonce( 'wp_rest' ),
			'galleryCreateUrl' => admin_url( 'post-new.php?post_type=fotogrids_gallery' ),
			'albumCreateUrl'   => admin_url( 'post-new.php?post_type=fotogrids_album' ),
			'galleryEditBase'  => admin_url( 'post.php?action=edit&post=' ),
			'albumEditBase'    => admin_url( 'post.php?action=edit&post=' ),
		);
	}

	/**
	 * Stamp `data-elementor-open-lightbox="no"` on every anchor a
	 * FotoGrids decorator emits during an Elementor-sourced render.
	 *
	 * Gated on `Request_Source::ELEMENTOR` so non-Elementor renders are
	 * untouched (a shortcode in a regular post should not pay the cost
	 * of carrying an Elementor-specific attribute).
	 *
	 * @since 1.0.0
	 * @param array<string,string> $attrs  Anchor attribute map.
	 * @param Render_Context       $render Render context.
	 * @return array<string,string>
	 */
	public static function disable_elementor_lightbox( array $attrs, Render_Context $render ): array {
		if ( Request_Source::ELEMENTOR !== $render->meta->source ) {
			return $attrs;
		}

		$attrs['data-elementor-open-lightbox'] = 'no';
		return $attrs;
	}

	/**
	 * Opt the renderer into inline-emitting CSS+JS whenever the current
	 * request is an Elementor preview iframe load. Two detection paths:
	 *
	 *   1. `?elementor-preview=…` query var - the iframe URL Elementor
	 *      uses to load the preview document.
	 *   2. `Plugin::$instance->preview->is_preview_mode()` - Elementor's
	 *      own canonical check, available once Elementor has booted.
	 *
	 * Either is sufficient; we OR them so the earliest-firing path still
	 * lights up. Returning `true` short-circuits the renderer's default
	 * `did_action('wp_head')` heuristic which is unreliable inside the
	 * preview iframe.
	 *
	 * @since 1.0.0
	 * @param bool $should_inline Existing filter value.
	 * @return bool
	 */
	public static function inline_assets_in_preview( bool $should_inline ): bool {
		if ( $should_inline ) {
			return true;
		}

		if ( isset( $_GET['elementor-preview'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return true;
		}

		if ( ! class_exists( '\Elementor\Plugin' ) ) {
			return false;
		}

		$plugin = \Elementor\Plugin::$instance;

		if ( isset( $plugin->preview )
			&& method_exists( $plugin->preview, 'is_preview_mode' )
			&& $plugin->preview->is_preview_mode() ) {
			return true;
		}

		if ( isset( $plugin->editor )
			&& method_exists( $plugin->editor, 'is_edit_mode' )
			&& $plugin->editor->is_edit_mode() ) {
			return true;
		}

		if ( wp_doing_ajax()
			&& isset( $_REQUEST['action'] ) // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			&& str_starts_with( (string) sanitize_text_field( wp_unslash( $_REQUEST['action'] ) ), 'elementor' ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return true;
		}

		return false;
	}
}
