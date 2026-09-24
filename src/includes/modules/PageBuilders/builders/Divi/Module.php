<?php
/**
 * Divi builder sub-module (native Divi 5).
 *
 * @package FotoGrids\Modules\PageBuilders\Builders\Divi
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Modules\PageBuilders\Builders\Divi;

use FotoGrids\Hooks\Filters_Page_Builders;
use FotoGrids\Hooks\Filters_Render;
use FotoGrids\Render\Api\Render_Context;
use FotoGrids\Render\Api\Request_Source;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Divi sub-module of Page Builders - native Divi 5 implementation.
 *
 * Ships two native Divi 5 modules (gallery + album) built on Divi 5's
 * module API: a TypeScript/React Visual Builder bundle plus a PHP render
 * callback, registered through `ModuleRegistration::register_module()`.
 * Native modules edit directly inside the Visual Builder.
 *
 * The render callback delegates to the existing shortcode pipeline
 * (`Public_Render::gallery_shortcode()` / `album_shortcode()`) stamped
 * with `Request_Source::DIVI`, so every decorator / feature / layout
 * module works inside Divi with no further glue, as in the Elementor and
 * Gutenberg sub-modules.
 *
 * Block names (Divi 5 modules are WP blocks under the hood):
 *   - `fotogrids/fotogrids-gallery`
 *   - `fotogrids/fotogrids-album`
 *
 * Activation gates on Divi 5's module framework being present
 * (`ET\Builder\Packages\ModuleLibrary\ModuleRegistration`). Divi 4 is not
 * supported.
 *
 * This sub-module does not register itself with `Module_Registry`. The
 * parent PageBuilders module owns the registry slot and dispatches
 * `init()` to each builder.
 *
 * @since 1.0.0
 */
final class Module {

	/**
	 * Block name for the native FotoGrids gallery module.
	 *
	 * @var string
	 */
	public const GALLERY_BLOCK = 'fotogrids/fotogrids-gallery';

	/**
	 * Block name for the native FotoGrids album module.
	 *
	 * @var string
	 */
	public const ALBUM_BLOCK = 'fotogrids/fotogrids-album';

	/**
	 * Script handle for the Visual Builder module bundle (the compiled
	 * TypeScript/TSX `edit` components + `registerModule` wiring).
	 *
	 * @var string
	 */
	public const VB_SCRIPT_HANDLE = 'fotogrids-pb-divi-vb';

	/**
	 * Style handle for the Visual Builder bundle's CSS.
	 *
	 * @var string
	 */
	public const VB_STYLE_HANDLE = 'fotogrids-pb-divi-vb';

	/**
	 * Filesystem base for the native module package, relative to this
	 * file. The compiled VB bundle lands in `native/build/`; each
	 * module's `module.json` lives in `native/modules-json/<name>/`.
	 *
	 * @var string
	 */
	private const NATIVE_DIR = __DIR__ . '/native';

	/**
	 * Whether Divi 5's native module framework is present. Checks
	 * `ModuleRegistration` rather than `ET_Builder_Element`, which also exists
	 * in Divi 4 compat mode.
	 *
	 * @since 1.0.0
	 * @return bool
	 */
	public static function is_active(): bool {
		return class_exists( '\ET\Builder\Packages\ModuleLibrary\ModuleRegistration' );
	}

	/**
	 * Boot the Divi sub-module.
	 *
	 * Native modules register their PHP render side by adding
	 * `DependencyInterface` instances to Divi's module dependency tree on
	 * `divi_module_library_modules_dependency_tree`. The VB bundle is
	 * enqueued on Divi's builder-script hook.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function init(): void {
		if ( ! self::is_active() ) {
			return;
		}

		// The dependency-tree and VB asset hooks are attached in boot_early() on
		// plugins_loaded: Divi fires them from `init` priority 0, before this
		// init:5 dispatch. The render-pipeline filters below fire during a gallery
		// render, so init:5 is in time for them.

		// The module's frontend stylesheet (layout chrome for the rendered
		// gallery wrapper) ships on every page - cheap, and the gallery's
		// own per-render CSS is owned by Asset_Resolver as usual.
		add_action( 'wp_enqueue_scripts', array( self::class, 'enqueue_frontend_style' ) );

		// Opt every Divi-built page that contains a FotoGrids module into
		// the page-global asset bootstrap. Divi 5 stores its layout as
		// serialized blocks in `post_content`, so a cheap block-name scan
		// catches our modules.
		add_filter( Filters_Page_Builders::HAS_CONTENT, array( self::class, 'detect_in_divi' ), 10, 2 );

		// Suppress Divi's global overlay/lightbox over FotoGrids anchors
		// during a Divi-sourced render.
		add_filter( Filters_Render::ANCHOR_ATTRS, array( self::class, 'disable_divi_overlay' ), 10, 2 );

		// Force inline asset emission inside the Visual Builder, where
		// wp_head / wp_footer don't fire the way the renderer's default
		// heuristic expects.
		add_filter( Filters_Render::SHOULD_INLINE_ASSETS, array( self::class, 'inline_assets_in_builder' ) );
	}

	/**
	 * Attach the Divi-bootstrap-sensitive hooks early (on `plugins_loaded`).
	 *
	 * Divi fires `divi_module_library_modules_dependency_tree` from
	 * `et_setup_builder_5` on `init` priority 0, so the listener is attached from
	 * the plugin bootstrap on `plugins_loaded` rather than the init:5 dispatch.
	 * Safe to call unconditionally; exits early when Divi 5 isn't present.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function boot_early(): void {
		// Runs before the Divi theme loads its builder framework, so is_active()
		// cannot be checked yet. The hooks are attached unconditionally and each
		// callback checks for Divi itself.

		// Native modules' PHP render side. The dependency-tree action is
		// Divi-only, so attaching its listener is a no-op when Divi isn't
		// installed.
		add_action(
			'divi_module_library_modules_dependency_tree',
			array( self::class, 'register_native_modules' )
		);

		// Visual Builder bundle registration on `et_fb_framework_loaded`, the hook
		// Divi uses for its own packages. It fires before
		// PackageBuildManager::enqueue_scripts captures the app-window script list.
		add_action( 'et_fb_framework_loaded', array( self::class, 'register_vb_package' ) );
		// Fallback: also attach to the before-enqueue hook in case
		// `et_fb_framework_loaded` has already fired in some flow. The
		// method is idempotent (PackageBuildManager keyed by name).
		add_action( 'divi_visual_builder_assets_before_enqueue_scripts', array( self::class, 'register_vb_package' ) );

		// Direct wp_enqueue_script into the app window at priority 20, after
		// PackageBuildManager::enqueue_scripts (priority 10) has registered the
		// `divi-module-library` and `divi-hooks` deps; register_package_build does
		// not reliably land the handle in $wp_scripts.
		add_action( 'wp_enqueue_scripts', array( self::class, 'enqueue_vb_bundle_directly' ), 20 );
	}

	/**
	 * Deterministically enqueue the VB bundle via plain wp_enqueue_script.
	 *
	 * Bypasses Divi's PackageBuildManager. Runs on the app-window request only,
	 * after Divi has registered its own package handles.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function enqueue_vb_bundle_directly(): void {
		if ( ! function_exists( 'et_core_is_fb_enabled' ) || ! et_core_is_fb_enabled() ) {
			return;
		}
		// App window only - the module library + registration store live in the
		// app window, not the top window. Read-only detection of Divi's own
		// ?app_window marker on an editor request; no state change, so nonce
		// verification does not apply.
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( ! isset( $_GET['app_window'] ) ) {
			return;
		}

		global $wp_scripts;
		$deps = array();
		// Only registered deps are declared, so WordPress does not drop the
		// script over a missing dependency.
		foreach ( array( 'divi-module-library', 'divi-hooks' ) as $dep ) {
			if ( isset( $wp_scripts->registered[ $dep ] ) ) {
				$deps[] = $dep;
			}
		}

		$base_url = FOTOGRIDS_PLUGIN_URL . 'includes/modules/PageBuilders/builders/Divi/native/';

		wp_enqueue_script(
			self::VB_SCRIPT_HANDLE,
			$base_url . 'build/bundle.js',
			$deps,
			FOTOGRIDS_VERSION,
			true
		);

		wp_enqueue_style(
			self::VB_STYLE_HANDLE . '-direct',
			$base_url . 'styles/bundle.css',
			array(),
			FOTOGRIDS_VERSION
		);

		wp_localize_script(
			self::VB_SCRIPT_HANDLE,
			'fotogridsPbDivi',
			self::build_localize_payload()
		);
	}

	/**
	 * Add the native module dependency instances to Divi's module
	 * dependency tree. Each class' `load()` performs the actual
	 * `ModuleRegistration::register_module()` call.
	 *
	 * @since 1.0.0
	 * @param object $dependency_tree Divi's module dependency tree.
	 * @return void
	 */
	public static function register_native_modules( $dependency_tree ): void {
		if ( ! is_object( $dependency_tree ) || ! method_exists( $dependency_tree, 'add_dependency' ) ) {
			return;
		}

		require_once self::NATIVE_DIR . '/php/class-gallery-module.php';
		require_once self::NATIVE_DIR . '/php/class-album-module.php';

		$dependency_tree->add_dependency( new Native\Gallery_Module() );
		$dependency_tree->add_dependency( new Native\Album_Module() );
	}

	/**
	 * Register the compiled Visual Builder module bundle with Divi 5's
	 * package build manager.
	 *
	 * `PackageBuildManager::register_package_build()` is the canonical
	 * way a third-party D5 module ships its builder JS: it loads into the
	 * builder's app window with Divi's own packages (`divi-module-library`,
	 * `divi-vendor-wp-hooks`) declared as deps. The bundle externalises
	 * `@divi/*` off those globals, so it carries only the FotoGrids `edit`
	 * components + `registerModule` wiring.
	 *
	 * Gated on `et_builder_d5_enabled() && et_core_is_fb_enabled()` so it
	 * only loads in the Divi 5 Visual Builder, never on the frontend.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function register_vb_package(): void {
		if ( ! class_exists( '\ET\Builder\VisualBuilder\Assets\PackageBuildManager' ) ) {
			return;
		}
		if ( ! function_exists( 'et_builder_d5_enabled' ) || ! et_builder_d5_enabled() ) {
			return;
		}
		if ( ! function_exists( 'et_core_is_fb_enabled' ) || ! et_core_is_fb_enabled() ) {
			return;
		}

		$base_url = FOTOGRIDS_PLUGIN_URL . 'includes/modules/PageBuilders/builders/Divi/native/';

		\ET\Builder\VisualBuilder\Assets\PackageBuildManager::register_package_build(
			array(
				'name'    => self::VB_SCRIPT_HANDLE,
				'version' => FOTOGRIDS_VERSION,
				'script'  => array(
					'src'                => $base_url . 'build/bundle.js',
					// The wp-hooks handle is `divi-hooks` in Divi 5; an unregistered
					// dep makes WordPress drop the script.
					'deps'               => array(
						'divi-module-library',
						'divi-hooks',
					),
					'enqueue_top_window' => false,
					'enqueue_app_window' => true,
				),
			)
		);

		\ET\Builder\VisualBuilder\Assets\PackageBuildManager::register_package_build(
			array(
				'name'    => self::VB_STYLE_HANDLE,
				'version' => FOTOGRIDS_VERSION,
				'style'   => array(
					'src'                => $base_url . 'styles/vb-bundle.css',
					'deps'               => array(),
					'enqueue_top_window' => false,
					'enqueue_app_window' => true,
				),
			)
		);

		// REST base, nonce and deep links for the edit components, attached to
		// Divi's module-library script so they exist before registerModule runs.
		wp_localize_script(
			'divi-module-library',
			'fotogridsPbDivi',
			self::build_localize_payload()
		);
	}

	/**
	 * Enqueue the native modules' frontend stylesheet.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function enqueue_frontend_style(): void {
		if ( wp_style_is( self::VB_STYLE_HANDLE . '-frontend', 'enqueued' ) ) {
			return;
		}

		wp_enqueue_style(
			self::VB_STYLE_HANDLE . '-frontend',
			FOTOGRIDS_PLUGIN_URL . 'includes/modules/PageBuilders/builders/Divi/native/styles/bundle.css',
			array(),
			FOTOGRIDS_VERSION
		);
	}

	/**
	 * Build the `window.fotogridsPbDivi` payload the VB `edit`
	 * components read - REST base + nonce for the preview / picker
	 * endpoints, and edit/create deep links. Mirrors the Elementor
	 * sub-module's payload shape so the shared PickerModal component
	 * works identically across hosts.
	 *
	 * @since 1.0.0
	 * @return array<string, mixed>
	 */
	private static function build_localize_payload(): array {
		require_once self::NATIVE_DIR . '/php/class-collection-options.php';

		return array(
			'restUrl'          => esc_url_raw( rest_url( 'fotogrids/v1/' ) ),
			'restNonce'        => wp_create_nonce( 'wp_rest' ),
			'galleryCreateUrl' => admin_url( 'post-new.php?post_type=fotogrids_gallery' ),
			'albumCreateUrl'   => admin_url( 'post-new.php?post_type=fotogrids_album' ),
			'galleryEditBase'  => admin_url( 'post.php?action=edit&post=' ),
			'albumEditBase'    => admin_url( 'post.php?action=edit&post=' ),
			// divi/select reads options from the bundle's static module.json, where
			// they are empty; the live option maps are passed here and injected
			// before registerModule. Shape: `value => { label }`.
			'galleryOptions'   => Native\Collection_Options::map( 'gallery' ),
			'albumOptions'     => Native\Collection_Options::map( 'album' ),
		);
	}

	/**
	 * Filter callback: detect FotoGrids native modules in a Divi 5 page.
	 *
	 * Divi 5 serialises its layout as block comments in `post_content`
	 * (`<!-- wp:fotogrids/fotogrids-gallery ... -->`), so a substring scan for
	 * the block names catches them without parsing the whole block tree.
	 *
	 * @since 1.0.0
	 * @param bool          $detected Previous detection result.
	 * @param \WP_Post|null $post     Current post.
	 * @return bool
	 */
	public static function detect_in_divi( bool $detected, $post ): bool {
		if ( $detected ) {
			return true;
		}

		if ( ! $post instanceof \WP_Post ) {
			return false;
		}

		$content = (string) $post->post_content;
		if ( '' === $content ) {
			return false;
		}

		return strpos( $content, 'wp:' . self::GALLERY_BLOCK ) !== false
			|| strpos( $content, 'wp:' . self::ALBUM_BLOCK ) !== false;
	}

	/**
	 * Stamp a Divi-overlay opt-out attribute on every anchor a FotoGrids
	 * decorator emits during a Divi-sourced render.
	 *
	 * @since 1.0.0
	 * @param array<string,string> $attrs  Anchor attribute map.
	 * @param Render_Context       $render Render context.
	 * @return array<string,string>
	 */
	public static function disable_divi_overlay( array $attrs, Render_Context $render ): array {
		if ( Request_Source::DIVI !== $render->meta->source ) {
			return $attrs;
		}

		$attrs['data-fg-no-divi-overlay'] = 'true';
		return $attrs;
	}

	/**
	 * Opt the renderer into inline-emitting CSS+JS whenever the current
	 * request is a Divi builder / preview context.
	 *
	 * @since 1.0.0
	 * @param bool $should_inline Existing filter value.
	 * @return bool
	 */
	public static function inline_assets_in_builder( bool $should_inline ): bool {
		if ( $should_inline ) {
			return true;
		}

		if ( function_exists( 'et_core_is_fb_enabled' ) && et_core_is_fb_enabled() ) {
			return true;
		}

        // phpcs:disable WordPress.Security.NonceVerification.Recommended
		if ( isset( $_GET['et_fb'] ) && (string) '1' === $_GET['et_fb'] ) {
			return true;
		}

		if ( isset( $_GET['et_pb_preview'] ) && (string) 'true' === $_GET['et_pb_preview'] ) {
			return true;
		}
        // phpcs:enable WordPress.Security.NonceVerification.Recommended

		return false;
	}
}
