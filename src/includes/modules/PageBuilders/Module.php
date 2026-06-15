<?php
/**
 * Page Builders module.
 *
 * @package FotoGrids\Modules\PageBuilders
 * @since   1.0.0
 */

declare(strict_types=1);

namespace FotoGrids\Modules\PageBuilders;

use FotoGrids\Modules\Abstract_Module;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Umbrella module for all page-builder integrations.
 *
 * Owns one shared `core/` (REST endpoints, Pro-guard, picker UI, live-preview
 * UI, inspector primitives) and one sub-module per builder under `builders/`:
 *
 *   - builders/Gutenberg/  - the Gutenberg blocks (gallery + album)
 *   - builders/Elementor/  - Elementor widgets (gallery + album)
 *   - builders/Divi/       - Divi modules (gallery + album)
 *   - builders/Bricks/     - FUTURE
 *
 * Each sub-module decides its own activation (e.g. the Elementor and Divi
 * sub-modules only boot when their builder is present). Gutenberg always
 * boots.
 *
 * The shared `core/` REST endpoints (`/preview/gallery/{id}`,
 * `/preview/album/{id}`, `/picker/items`) are registered once here, regardless
 * of which builders are active - any builder, present or future, consumes
 * them. Endpoints self-register on `rest_api_init` so module boot timing is
 * decoupled from REST timing.
 *
 * @since 1.0.0
 */
class Module extends Abstract_Module {

	/**
	 * Stable WP style handle for the aggregated shared-component
	 * stylesheet (Modal + Button + Checkbox + FormField + Icon).
	 *
	 * Registered by this module once on `init` (and again
	 * defensively on every enqueue hook a builder editor might fire
	 * on) so every builder sub-module that uses FG components — the
	 * Gutenberg block editor, the Elementor editor, future Divi /
	 * Bricks — declares ONE style dep and gets the whole library.
	 *
	 * Adding a new shared component: drop its SCSS in the matching
	 * `styles/fg-foo/` folder, add an `@use` line to
	 * `fg-shared/fg-shared.scss`, and the page-builder editors pick
	 * it up automatically — no PHP edit, no per-host enqueue dep.
	 *
	 * @var string
	 */
	public const FG_SHARED_STYLE_HANDLE = 'fotogrids-fg-shared';

	/**
	 * Stable WP script handle for the `window.FotoGridsIcons` payload
	 * the `<Icon>` component reads. Already enqueued on FotoGrids
	 * admin pages by `class-admin-init`; the page-builder editors
	 * register the same handle here so the global is also present in
	 * the Gutenberg / Elementor editor contexts.
	 *
	 * @var string
	 */
	public const FG_ICONS_SCRIPT_HANDLE = 'fotogrids-icons';

	/**
	 * Companion script handle: the loading-icons module that the
	 * `fotogrids-icons` payload depends on. Registered here so the
	 * dep is satisfied in builder editor contexts too.
	 *
	 * @var string
	 */
	public const FG_LOADING_ICONS_SCRIPT_HANDLE = 'fotogrids-loading-icons';

	public function get_id(): string {
		return 'page-builders';
	}

	public function get_name(): string {
		return __( 'Page Builders', 'fotogrids' );
	}

	public function get_description(): string {
		return __( 'Insert FotoGrids galleries and albums from Gutenberg, Elementor, Divi and Bricks.', 'fotogrids' );
	}

	/**
	 * Admin (block editor + preview REST) and REST (route registration). The
	 * block's frontend render is dispatched by WordPress through the block's
	 * own render.php; this module never boots on a non-admin frontend page.
	 */
	public function get_contexts(): array {
		return array( 'admin', 'rest' );
	}

	/**
	 * Boot the shared core (REST + Pro guard) and each builder sub-module
	 * whose activation conditions are satisfied.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public function init(): void {
		// Shared core helpers used by every builder sub-module. Loaded
		// up-front so builders can reference them at `init` time without
		// each one repeating the require_once.
		require_once __DIR__ . '/core/class-preview-options.php';
		require_once __DIR__ . '/core/class-preview-renderer.php';

		// Shared core - REST endpoints self-register on rest_api_init.
		add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );

		// Register the shared-component stylesheet AND the icons JS on
		// every enqueue cycle a builder editor might fire on. The deps
		// MUST exist at the moment `wp_enqueue_style` / `wp_enqueue_script`
		// reference them, otherwise WP refuses to enqueue the dependent
		// asset (Elementor's `elementor/editor/before_enqueue_scripts`
		// can fire before our hooks resolve, so a single `init:6`
		// registration is not safe). All registrations are guarded with
		// `wp_*_is( ..., 'registered' )` so repeat calls are no-ops.
		$register_shared = array( $this, 'register_shared_assets' );
		add_action( 'init', $register_shared, 6 );
		add_action( 'wp_enqueue_scripts', $register_shared, 1 );
		add_action( 'admin_enqueue_scripts', $register_shared, 1 );
		add_action( 'enqueue_block_editor_assets', $register_shared, 1 );
		add_action( 'elementor/editor/before_enqueue_scripts', $register_shared, 1 );

		// Gutenberg is always available in WordPress 5.0+, so its sub-module
		// boots unconditionally. Other builders gate themselves.
		require_once __DIR__ . '/builders/Gutenberg/Module.php';
		Builders\Gutenberg\Module::init();

		// Elementor sub-module — no-ops internally when Elementor isn't
		// loaded, so safe to require unconditionally.
		require_once __DIR__ . '/builders/Elementor/Module.php';
		Builders\Elementor\Module::init();

		// Divi sub-module — no-ops internally when Divi isn't loaded, so
		// safe to require unconditionally. Registers its modules on
		// `et_builder_ready` once Divi's framework is up.
		require_once __DIR__ . '/builders/Divi/Module.php';
		Builders\Divi\Module::init();
	}

	/**
	 * Register the shared-component stylesheet + icons JS payload.
	 *
	 * Both halves are idempotent — each registration is guarded by
	 * `wp_*_is( ..., 'registered' )` so repeat hook firings are
	 * no-ops. The two halves live in one callback because they're
	 * always wanted together: every shared FG component except the
	 * lightest renders at least one icon.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public function register_shared_assets(): void {
		// CSS — Modal + Button + Checkbox + FormField + Icon base rules.
		if ( ! wp_style_is( self::FG_SHARED_STYLE_HANDLE, 'registered' ) ) {
			wp_register_style(
				self::FG_SHARED_STYLE_HANDLE,
				FOTOGRIDS_PLUGIN_URL . 'assets/css/fg-shared-styles.css',
				array(),
				FOTOGRIDS_VERSION
			);
		}

		// JS — `window.FotoGridsIcons` payload + its loading-icons
		// dependency. Same handles class-admin-init uses for FotoGrids
		// admin pages; re-registered here so they're available in
		// builder editor contexts too. `wp_register_script` with an
		// already-registered handle is a no-op, so re-registration is
		// safe if class-admin-init has already run.
		if ( ! wp_script_is( self::FG_LOADING_ICONS_SCRIPT_HANDLE, 'registered' ) ) {
			wp_register_script(
				self::FG_LOADING_ICONS_SCRIPT_HANDLE,
				FOTOGRIDS_PLUGIN_URL . 'assets/admin/plain/loading-icons.js',
				array(),
				FOTOGRIDS_VERSION,
				true
			);
		}

		if ( ! wp_script_is( self::FG_ICONS_SCRIPT_HANDLE, 'registered' ) ) {
			wp_register_script(
				self::FG_ICONS_SCRIPT_HANDLE,
				FOTOGRIDS_PLUGIN_URL . 'assets/admin/plain/icons.js',
				array( self::FG_LOADING_ICONS_SCRIPT_HANDLE ),
				FOTOGRIDS_VERSION,
				true
			);
		}
	}

	/**
	 * Register the shared Page Builders REST routes.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public function register_rest_routes(): void {
		// Pro_Guard is referenced by Preview_Data; load it first so the
		// REST handler can resolve the class without relying on an
		// autoloader (we don't ship one).
		require_once __DIR__ . '/core/class-pro-guard.php';

		require_once __DIR__ . '/core/rest/preview-permissions.php';
		require_once __DIR__ . '/core/rest/preview-data.php';
		require_once __DIR__ . '/core/rest/register-preview-routes.php';

		REST\Register_Preview_Routes::register();
	}

	/**
	 * Enqueue admin assets for the block editor screens.
	 *
	 * Per-builder sub-modules handle their own block-editor enqueues. This
	 * method is reserved for future shared admin chrome (e.g. a picker that
	 * mounts in a non-block-editor surface).
	 *
	 * @since 1.0.0
	 * @param string $hook Current admin page hook suffix.
	 * @return void
	 */
	public function enqueue_assets( string $hook ): void {
		// Delegated to per-builder sub-modules for now.
		Builders\Gutenberg\Module::enqueue_assets( $hook );
	}
}
