<?php
declare(strict_types=1);

namespace FotoGrids\Render\Internal\Runtime;

use FotoGrids\Render\Api\Asset_Decl;
use FotoGrids\Render\Api\Feature;
use FotoGrids\Render\Api\Module_Assets;
use FotoGrids\Render\Api\Render_Context;

if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Runtime Bootstrap.
 *
 * Always-on feature module whose only job is to enqueue the frontend
 * runtime (window.FotoGrids) on any page that renders a gallery. Every
 * other JS module declares the runtime as a dependency, so this module's
 * presence in the registry is what makes the per-module JS extraction
 * possible at all.
 *
 * See public/render/internal/runtime/README.md for the runtime contract.
 *
 * @package FotoGrids\Render\Internal\Runtime
 * @since   1.0.0
 */
final class Runtime_Bootstrap implements Feature {

	public function id(): string {
		return 'fotogrids/runtime';
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
	 * Always active. The runtime is the floor every other JS module
	 * builds on; there is no rendered gallery for which it is not
	 * needed.
	 *
	 * @since 1.0.0
	 * @param Render_Context $render_context Render context.
	 * @return bool
	 */
	public function supports( Render_Context $render_context ): bool {
		return true;
	}

	public function html_before( Render_Context $render_context ): string {
		return '';
	}

	public function html_appendix( Render_Context $render_context ): string {
		return '';
	}

	public function html_after( Render_Context $render_context ): string {
		return '';
	}

	public function wrapper_data_attrs( Render_Context $render_context ): array {
		return array();
	}

	public function style_vars( Render_Context $render_context ): array {
		return array();
	}

	/**
	 * Enqueues the runtime JS.
	 *
	 * Handle: `fotogrids-runtime`. Every other module's JS declares this
	 * handle in its `deps`, so the runtime is guaranteed to evaluate
	 * first and `window.FotoGrids` is defined by the time module code
	 * runs.
	 *
	 * @since 1.0.0
	 * @param Render_Context $render_context Render context.
	 * @return Module_Assets
	 */
	public function assets( Render_Context $render_context ): Module_Assets {
		return new Module_Assets(
			array(),
			array(
				'fotogrids-runtime' => new Asset_Decl(
					'../../assets/js/fotogrids-runtime.js',
					array(),
					true,
				),
			),
		);
	}

	/**
	 * Registers the runtime handle and attaches the window.fotogrids payload.
	 *
	 * The payload prints with fotogrids-runtime wherever the render pipeline
	 * enqueues or inline-prints the handle. Runs once per request.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function localize(): void {
		static $localized = false;

		if ( $localized ) {
			return;
		}
		$localized = true;

		// Asset_Resolver will later call wp_register_script for the same
		// handle; WordPress treats a duplicate registration as a no-op.
		wp_register_script(
			'fotogrids-runtime',
			FOTOGRIDS_PLUGIN_URL . 'assets/js/fotogrids-runtime.js',
			array(),
			FOTOGRIDS_VERSION,
			true
		);

		$sharing = \FotoGrids\Settings\Sharing_Settings_Store::get();

		// window.fotogrids carries the sharing-related deep-link settings,
		// the REST root and, for signed-in visitors only, a REST nonce.
		// Per-render nonces in data attributes can come from the render
		// cache, so they are not tied to the current visitor.
		wp_localize_script(
			'fotogrids-runtime',
			'fotogrids',
			array(
				'deep_linking_enabled'  => (bool) $sharing['deep_linking_enabled'],
				'embedded_share_target' => $sharing['embedded_share_target'],
				'restUrl'               => esc_url_raw( rest_url() ),
				'restNonce'             => is_user_logged_in() ? wp_create_nonce( 'wp_rest' ) : '',
			)
		);
	}
}
