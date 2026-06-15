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
 * Divi sub-module of Page Builders — native Divi 5 implementation.
 *
 * Ships two native Divi 5 modules (gallery + album) built on Divi 5's
 * module API: a TypeScript/React Visual Builder bundle plus a PHP render
 * callback, registered through `ModuleRegistration::register_module()`.
 * Unlike the legacy `ET_Builder_Module` path (removed), native modules do
 * NOT carry the "Legacy" badge and edit natively inside the Visual
 * Builder.
 *
 * The render callback delegates to the existing shortcode pipeline
 * (`Public_Render::gallery_shortcode()` / `album_shortcode()`) stamped
 * with `Request_Source::DIVI`, so every decorator / feature / layout
 * module works inside Divi with no further glue — identical in spirit to
 * the Elementor and Gutenberg sub-modules.
 *
 * Block names (Divi 5 modules are WP blocks under the hood):
 *   - `fotogrids/fotogrids-gallery`
 *   - `fotogrids/fotogrids-album`
 *
 * Activation gates on Divi 5's module framework being present
 * (`ET\Builder\Packages\ModuleLibrary\ModuleRegistration`). Divi 4-only
 * sites get nothing — by design; the legacy fallback was intentionally
 * dropped.
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
	 * Whether Divi 5's native module framework is present. We check for
	 * `ModuleRegistration` specifically (not `ET_Builder_Element`, which
	 * also exists in Divi 4 compat mode) so native registration is only
	 * attempted when Divi 5's block-module pipeline is actually available.
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

		// NOTE on timing: the two Divi-bootstrap-sensitive hooks
		// (`divi_module_library_modules_dependency_tree` and the VB asset
		// registration) are NOT attached here. Divi fires the dependency
		// tree from `et_setup_builder_5` on `init` priority 0, and this
		// `init()` runs from Module_Registry::boot() on `init` priority 5
		// — five levels too late, so an `add_action` here would miss the
		// dispatch entirely and the modules would never register. Those
		// hooks are attached in {@see boot_early()}, called from the
		// plugin bootstrap on `plugins_loaded` (before `init`). See the
		// wiring in fotogrids.php.

		// The render-pipeline filters below DO belong here — they fire
		// later in the request (during a gallery render), well after
		// `init`, so `init:5` registration is in time.

		// The module's frontend stylesheet (layout chrome for the rendered
		// gallery wrapper) ships on every page — cheap, and the gallery's
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
	 * `et_setup_builder_5` on `init` priority 0. To be on that bus, our
	 * listener must be registered before `init` runs at all — hence this
	 * method is called from the plugin bootstrap on `plugins_loaded`,
	 * NOT from the `init:5` module dispatch.
	 *
	 * Safe to call unconditionally — exits early when Divi 5 isn't present.
	 * Idempotent enough for a single bootstrap call.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function boot_early(): void {
		// IMPORTANT timing note: this runs on `plugins_loaded`, which is
		// BEFORE the Divi *theme* loads its builder framework (themes load
		// on `after_setup_theme`, and Divi boots Divi 5 from
		// `et_setup_builder_5` on `init` priority 0). So we must NOT gate
		// on `is_active()` here — `ModuleRegistration` / `ET_Builder_Element`
		// don't exist yet and the check would always fail.
		//
		// Instead we attach the hooks unconditionally. They're harmless
		// when Divi is absent: `divi_module_library_modules_dependency_tree`
		// only ever fires if Divi 5 is present, and `register_vb_package`
		// self-guards on the Divi classes/functions. The Divi-presence
		// check happens INSIDE the callbacks, which run at `init:0` and
		// later — by which point Divi has loaded.

		// Native modules' PHP render side. The dependency-tree action is
		// Divi-only, so attaching its listener is a no-op when Divi isn't
		// installed.
		add_action(
			'divi_module_library_modules_dependency_tree',
			array( self::class, 'register_native_modules' )
		);

		// Visual Builder bundle registration (canonical D5 mechanism).
		//
		// CRITICAL timing: register on `et_fb_framework_loaded` — the SAME
		// hook Divi uses for its own package registrations
		// (`PackageBuildManager::register_divi_package_builds`). This fires
		// BEFORE `PackageBuildManager::enqueue_scripts` captures the
		// app-window script list. The previously-used
		// `divi_visual_builder_assets_before_enqueue_scripts` hook fires
		// from *inside* enqueue_scripts and proved too late for the script
		// (the style happened to survive by ordering luck, the script did
		// not — confirmed via enqueue-state diagnostics). Self-guards on
		// Divi's PackageBuildManager + VB-active checks.
		add_action( 'et_fb_framework_loaded', array( self::class, 'register_vb_package' ) );
		// Fallback: also attach to the before-enqueue hook in case
		// `et_fb_framework_loaded` has already fired in some flow. The
		// method is idempotent (PackageBuildManager keyed by name).
		add_action( 'divi_visual_builder_assets_before_enqueue_scripts', array( self::class, 'register_vb_package' ) );

		// DETERMINISTIC fallback: enqueue the bundle ourselves via plain
		// `wp_enqueue_script` directly into the app window, AFTER Divi's
		// own PackageBuildManager::enqueue_scripts (priority 10) has run
		// and registered its package handles. PackageBuildManager's
		// register_package_build proved unreliable at landing our handle
		// in $wp_scripts on this Divi build regardless of registration
		// hook timing, so we don't depend on it. Priority 20 ensures our
		// deps (`divi-module-library`, `divi-hooks`) are registered first.
		add_action( 'wp_enqueue_scripts', array( self::class, 'enqueue_vb_bundle_directly' ), 20 );
	}

	/**
	 * Deterministically enqueue the VB bundle via plain wp_enqueue_script.
	 *
	 * Bypasses Divi's PackageBuildManager (which never landed our handle
	 * in $wp_scripts on this build). Runs on the app-window request only,
	 * after Divi has registered its own package handles.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function enqueue_vb_bundle_directly(): void {
		// Only in a VB context.
		if ( ! function_exists( 'et_core_is_fb_enabled' ) || ! et_core_is_fb_enabled() ) {
			return;
		}
		// App window only — the module library + registration store live in the
		// app window, not the top window. Read-only detection of Divi's own
		// ?app_window marker on an editor request; no state change, so nonce
		// verification does not apply.
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( ! isset( $_GET['app_window'] ) ) {
			return;
		}

		global $wp_scripts;
		$deps = array();
		// Only declare deps that are actually registered, so WordPress
		// doesn't silently drop our script over a missing dependency.
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
	 * `@divi/*` off those globals, so it carries only our `edit`
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
					// NOTE: the wp-hooks dependency handle is `divi-hooks`
					// in this Divi version (the example repo's
					// `divi-vendor-wp-hooks` does not exist here, and an
					// unregistered dep makes WordPress silently DROP the
					// script — which is exactly why the bundle never
					// loaded). Verified against PackageBuildManager's
					// registered handle list.
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

		// Bridge the REST base + nonce + deep-links the edit components
		// need. Attached to Divi's module-library script so it's present
		// before our registerModule callback runs.
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
	 * components read — REST base + nonce for the preview / picker
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
			// The VB `divi/select` reads its options from the static
			// module.json shipped in the JS bundle (where they're empty).
			// PHP-side `register_module` attribute injection only affects
			// the server render. So we pass the live option maps here and
			// the bundle injects them into each module's metadata before
			// calling `registerModule`. Shape matches divi/select:
			// `value => { label }`.
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
